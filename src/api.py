import re
import yaml
import logging
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit
import datetime

from fastapi import FastAPI, HTTPException, Request
from fastapi import responses as fastapi_responses
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

import sys
# Resolve project base (directory containing sites.yaml)
BASE_DIR = Path(__file__).resolve().parent
while BASE_DIR != BASE_DIR.parent and not (BASE_DIR / 'sites.yaml').exists():
    BASE_DIR = BASE_DIR.parent
SRC_DIR = BASE_DIR / 'src'
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from get_crawler import get_webpage_content
from js_crawler import get_webpage_content_js
from parser import parse_html
from llm import llm, generate_parser_selectors
from utils import normalize_url, extract_domain
from storage import (
    list_opportunities,
    get_opportunity_by_id,
    insert_opportunity,
    update_opportunity as storage_update_opportunity,
    delete_opportunity as storage_delete_opportunity,
)
from bson import ObjectId

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

SITES_CONFIG_PATH = BASE_DIR / 'sites.yaml'

app = FastAPI(title="Volunteer Scraper API", version="0.1.0")

# CORS (allow file:// null origin and localhost origins)
origins = [
    "http://localhost",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "null",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SAFE_DOMAIN_REGEX = re.compile(r'^[A-Za-z0-9.-]+$')

# -------------------- Pydantic Models -------------------- #

class ScrapeRequest(BaseModel):
    url: str
    model: Optional[str] = 'gemini'

    @field_validator('url', mode='before')
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not v or len(v) > 2048:
            raise ValueError('Invalid URL length')
        norm = normalize_url(v)
        parts = urlsplit(norm)
        if parts.scheme not in {'http', 'https'}:
            raise ValueError('Unsupported URL scheme')
        if not SAFE_DOMAIN_REGEX.match(parts.netloc):
            raise ValueError('Invalid domain')
        return norm

    @field_validator('model')
    @classmethod
    def validate_model(cls, v: str) -> str:
        if v not in {'gemini', 'gpt'}:
            raise ValueError('model must be gemini or gpt')
        return v

class GenerateConfigRequest(BaseModel):
    url: str
    raw_html: str

    @field_validator('url', mode='before')
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not v or len(v) > 2048:
            raise ValueError('Invalid URL length')
        norm = normalize_url(v)
        parts = urlsplit(norm)
        if parts.scheme not in {'http', 'https'}:
            raise ValueError('Unsupported URL scheme')
        if not SAFE_DOMAIN_REGEX.match(parts.netloc):
            raise ValueError('Invalid domain')
        return norm

    @field_validator('raw_html')
    @classmethod
    def validate_html(cls, v: str) -> str:
        if not isinstance(v, str) or not v.strip():
            raise ValueError('raw_html must be a non-empty string')
        return v

class SaveConfigRequest(BaseModel):
    domain: str
    include: str
    exclude: str

    @field_validator('domain', mode='before')
    @classmethod
    def validate_domain(cls, v: str) -> str:
        if not SAFE_DOMAIN_REGEX.match(v):
            raise ValueError('Invalid domain')
        return v.lower()

    @field_validator('include')
    @classmethod
    def validate_include(cls, v: str) -> str:
        if len(v) > 1000:
            raise ValueError('Selector too long')
        return v.strip()

    @field_validator('exclude')
    @classmethod
    def validate_exclude(cls, v: str) -> str:
        if len(v) > 1000:
            raise ValueError('Selector too long')
        return v.strip()

class Opportunity(BaseModel):
    id: str
    title: str
    organization: str
    tags: list[str] = []
    location: str = ""
    description: Optional[str] = None
    activityType: Optional[str] = None
    timeSlot: Optional[str] = None
    dateStart: Optional[str] = None
    dateEnd: Optional[str] = None
    url: str
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None
    createdAt: str
    updatedAt: str

class OpportunityCreate(BaseModel):
    title: Optional[str] = None
    organization: Optional[str] = None
    tags: Optional[list[str]] = None
    location: Optional[str] = None
    description: Optional[str] = None
    activityType: Optional[str] = None
    timeSlot: Optional[str] = None
    dateStart: Optional[str] = None
    dateEnd: Optional[str] = None
    url: Optional[str] = None
    contactEmail: Optional[str] = None
    contactPhone: Optional[str] = None

class OpportunityUpdate(OpportunityCreate):
    pass

class Paginated(BaseModel):
    items: list[Opportunity]
    total: int
    page: int
    pageSize: int

# -------------------- Load & Persist Config -------------------- #

def load_sites_config() -> dict:
    if not SITES_CONFIG_PATH.exists():
        return {}
    with SITES_CONFIG_PATH.open('r', encoding='utf-8') as f:
        data = yaml.safe_load(f) or {}
    if not isinstance(data, dict):
        raise HTTPException(status_code=500, detail='Corrupted configuration file.')
    return data


def save_sites_config(data: dict) -> None:
    tmp_path = SITES_CONFIG_PATH.with_suffix('.yaml.tmp')
    with tmp_path.open('w', encoding='utf-8') as f:
        yaml.safe_dump(data, f, sort_keys=False, allow_unicode=True)
    tmp_path.replace(SITES_CONFIG_PATH)

# -------------------- Endpoint Implementations -------------------- #

async def _scrape_url(url: str, model: str):
    sites_config = load_sites_config()
    domain = extract_domain(url)
    if domain not in sites_config:
        raise HTTPException(status_code=404, detail='No configuration for this domain')
    cfg = sites_config[domain]
    crawler_type = cfg.get('crawler', 'get')
    instructions = cfg.get('instructions', {})
    if crawler_type == 'get':
        cleaned_content = get_webpage_content(url, instructions)
    elif crawler_type == 'js':
        cleaned_content = get_webpage_content_js(url, instructions)
    else:
        raise HTTPException(status_code=400, detail='Unsupported crawler type in config')
    if not cleaned_content:
        raise HTTPException(status_code=502, detail='Failed to retrieve or parse content')
    data = llm(cleaned_content, url, model_name=model)
    return data


@app.post('/api/scrape')
async def scrape(req: ScrapeRequest):
    try:
        return await _scrape_url(req.url, str(req.model))
    except HTTPException:
        raise
    except Exception:
        logging.exception('Unhandled scrape error')
        raise HTTPException(status_code=500, detail='Internal server error')


@app.get('/api/scrape')
async def scrape_get(url: str, model: str = 'gemini'):
    try:
        req = ScrapeRequest(url=url, model=model)
        return await _scrape_url(req.url, req.model)
    except HTTPException:
        raise
    except Exception:
        logging.exception('Unhandled scrape error (GET)')
        raise HTTPException(status_code=500, detail='Internal server error')


@app.post('/api/generate-config')
async def generate_config(req: GenerateConfigRequest):
    try:
        selectors = generate_parser_selectors(req.raw_html, req.url)
        cleaned_text = parse_html(req.raw_html, selectors)
        return { 'selectors': selectors, 'cleaned_text': cleaned_text }
    except HTTPException:
        raise
    except Exception:
        logging.exception('Unhandled generate-config error')
        raise HTTPException(status_code=500, detail='Internal server error')


@app.post('/api/save-config')
async def save_config(req: SaveConfigRequest):
    try:
        sites_config = load_sites_config()
        sites_config[req.domain] = {
            'crawler': 'get',
            'instructions': {
                'include': req.include,
                'exclude': req.exclude
            }
        }
        save_sites_config(sites_config)
        return { 'status': 'ok', 'domain': req.domain }
    except HTTPException:
        raise
    except Exception:
        logging.exception('Unhandled save-config error')
        raise HTTPException(status_code=500, detail='Internal server error')


def _map_doc_to_opportunity(doc: dict) -> Opportunity:
    def _pick(*keys: str, default: Optional[str] = None) -> Optional[str]:
        for k in keys:
            v = doc.get(k)
            if isinstance(v, str) and v.strip():
                return v
        return default
    def _pick_list(*keys: str) -> list[str]:
        for k in keys:
            v = doc.get(k)
            if isinstance(v, list) and all(isinstance(x, str) for x in v):
                return v
        return []
    created = _pick('createdAt') or _pick('created_at') or llm.__name__ and ''  # placeholder
    if not created:
        created = doc.get('createdAt') or doc.get('created_at') or ''
    if not created:
        created = doc.get('_id') and ObjectId(doc['_id']).generation_time.isoformat()
    updated = _pick('updatedAt') or created
    oid = doc.get('_id')
    id_str = str(oid) if oid else str(doc.get('id', ''))
    return Opportunity(
        id=id_str,
        title=_pick('title', 'activity_type', 'activityType', default='Untitled') or 'Untitled',
        organization=_pick('organization', 'organization_name', default='') or '',
        tags=_pick_list('tags'),
        location=_pick('location', default='') or '',
        description=_pick('description', 'extra'),
        activityType=_pick('activityType', 'activity_type'),
        timeSlot=_pick('timeSlot', 'time_slot'),
        dateStart=_pick('dateStart', 'date_start'),
        dateEnd=_pick('dateEnd', 'date_end'),
        url=_pick('url', default='') or '',
        contactEmail=_pick('contactEmail', 'contact_email'),
        contactPhone=_pick('contactPhone', 'contact_number'),
        createdAt=created or '',
        updatedAt=updated or created or '',
    )

@app.get('/api/opportunities', response_model=Paginated)
async def opportunities_list(
    page: int = 1,
    pageSize: int = 10,
    q: Optional[str] = None,
    tag: Optional[str] = None,
    location: Optional[str] = None,
    dateFrom: Optional[str] = None,
    dateTo: Optional[str] = None,
):
    page = max(1, page)
    pageSize = max(1, min(100, pageSize))
    docs, total = list_opportunities(page=page, page_size=pageSize, q=q, tag=tag, location=location, date_from=dateFrom, date_to=dateTo)
    items = [_map_doc_to_opportunity(d) for d in docs]
    return Paginated(items=items, total=total, page=page, pageSize=pageSize)

@app.post('/api/opportunities', response_model=Opportunity)
async def opportunity_create(body: OpportunityCreate):
    now = body.__dict__
    doc = {
        'title': (body.title or 'Untitled'),
        'organization': body.organization or '',
        'tags': body.tags or [],
        'location': body.location or '',
        'description': body.description or '',
        'activityType': body.activityType or '',
        'timeSlot': body.timeSlot or '',
        'dateStart': body.dateStart,
        'dateEnd': body.dateEnd,
        'url': body.url or '',
        'contactEmail': body.contactEmail,
        'contactPhone': body.contactPhone,
        'createdAt': llm.__name__ and '' or '',  # placeholder overwritten below
        'updatedAt': llm.__name__ and '' or '',
    }
    # actual timestamp
    ts = datetime.datetime.now(datetime.UTC).isoformat()
    doc['createdAt'] = ts
    doc['updatedAt'] = ts
    inserted = insert_opportunity(doc)
    if not inserted:
        raise HTTPException(status_code=500, detail='Insert failed')
    return _map_doc_to_opportunity(inserted)

@app.get('/api/opportunities/{id}', response_model=Opportunity)
async def opportunity_get(id: str):
    doc = get_opportunity_by_id(id)
    if not doc:
        raise HTTPException(status_code=404, detail='Not found')
    return _map_doc_to_opportunity(doc)

@app.put('/api/opportunities/{id}', response_model=Opportunity)
async def opportunity_update(id: str, body: OpportunityUpdate):
    update_doc = {k: v for k, v in body.__dict__.items() if v is not None}
    update_doc['updatedAt'] = datetime.datetime.now(datetime.UTC).isoformat()
    updated = storage_update_opportunity(id, update_doc)
    if not updated:
        raise HTTPException(status_code=404, detail='Not found')
    return _map_doc_to_opportunity(updated)

@app.delete('/api/opportunities/{id}')
async def opportunity_delete(id: str):
    ok = storage_delete_opportunity(id)
    if not ok:
        raise HTTPException(status_code=404, detail='Not found')
    return { 'ok': True }

@app.get('/')
async def root():
    return { 'message': 'Volunteer Scraper API running' }


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return fastapi_responses.JSONResponse(status_code=exc.status_code, content={'detail': exc.detail})

# Run with: uvicorn src.api:app --reload
