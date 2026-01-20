import re
import logging
import asyncio
from typing import Optional
from urllib.parse import urlsplit
import datetime

from fastapi import FastAPI, HTTPException, Request, Query
from fastapi import responses as fastapi_responses
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from contextlib import asynccontextmanager
from bs4 import BeautifulSoup

from src.get_crawler import get_webpage_content
from src.js_crawler import get_webpage_content_js
from src.parser import parse_html
from src.llm import llm, generate_parser_selectors
from src.utils import normalize_url, extract_domain
from src.storage import (
    list_opportunities,
    get_opportunity_by_id,
    get_opportunity_by_url,
    insert_opportunity,
    update_opportunity as storage_update_opportunity,
    delete_opportunity as storage_delete_opportunity,
    create_indexes,
    list_site_configs,
    get_site_config_by_domain,
    update_site_config,
    delete_site_config,
    list_users,
    get_user_by_id,
    get_user_by_email,
    insert_user,
    update_user,
    delete_user
)
from bson import ObjectId

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.info("Application starting up...")
    create_indexes()
    logging.info("Application startup complete.")
    yield
    logging.info("Application shutting down...")

app = FastAPI(title="Volunteer Scraper API", version="0.1.0", lifespan=lifespan)

# Configure CORS
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SAFE_DOMAIN_REGEX = re.compile(r'^[A-Za-z0-9.-]+$')

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
    crawler: Optional[str] = 'get'

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

    @field_validator('crawler')
    @classmethod
    def validate_crawler(cls, v: str) -> str:
        if v not in {'get', 'js'}:
            raise ValueError('crawler must be get or js')
        return v

class Opportunity(BaseModel):
    id: str
    title: str
    organization: str
    tags: list[str] = []
    location: str = ""
    description: Optional[str] = None
    activityType: Optional[str] = None
    timeSlot: Optional[str] = None
    slotAvailability: Optional[list[str]] = None
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
    slotAvailability: Optional[list[str]] = None
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

class GenerateConfigFromUrlRequest(BaseModel):
    url: str
    model: Optional[str] = None

    @field_validator('url', mode='before')
    @classmethod
    def validate_url_only(cls, v: str) -> str:
        if not v or len(v) > 2048:
            raise ValueError('Invalid URL length')
        norm = normalize_url(v)
        parts = urlsplit(norm)
        if parts.scheme not in {'http', 'https'}:
            raise ValueError('Unsupported URL scheme')
        if not SAFE_DOMAIN_REGEX.match(parts.netloc):
            raise ValueError('Invalid domain')
        return norm

def _extract_visible_text(raw_html: str) -> str:
    try:
        soup = BeautifulSoup(raw_html, 'html.parser')
        for tag in soup(['script', 'style', 'noscript']):
            tag.decompose()
        text = soup.get_text(separator='\n', strip=True)
        lines = [l.strip() for l in text.splitlines()]
        cleaned = "\n".join([l for l in lines if l])
        return cleaned
    except Exception:
        return raw_html

async def _scrape_url(url: str, model: str):
    domain = extract_domain(url)
    cfg_doc = get_site_config_by_domain(domain)
    instructions = { 'include': '', 'exclude': '' }
    crawler_pref: str | None = None
    if cfg_doc:
        crawler_pref = cfg_doc.get('crawler') or None
        instructions['include'] = cfg_doc.get('include', '')
        instructions['exclude'] = cfg_doc.get('exclude', '')
    else:
        instructions = { 'include': 'body', 'exclude': 'script, style, nav, footer, header, aside' }

    cleaned_content = ''
    try_get_first = (crawler_pref is None) or (crawler_pref == 'get')

    async def _safe_get():
        try:
            # Run blocking get_webpage_content in a thread pool
            return await asyncio.to_thread(get_webpage_content, url, instructions) or ''
        except Exception:
            return ''

    async def _safe_js():
        try:
            # Run blocking get_webpage_content_js in a thread pool
            return await asyncio.to_thread(get_webpage_content_js, url, instructions) or ''
        except Exception:
            return ''

    if try_get_first:
        cleaned_content = await _safe_get()
        # If GET request returns very little content (< 500 chars), likely a JS-rendered site
        if not cleaned_content or len(cleaned_content) < 500:
            logging.info(f"GET request returned insufficient content ({len(cleaned_content)} chars), trying JS crawler")
            cleaned_content = await _safe_js()
    else:
        cleaned_content = await _safe_js()
        if not cleaned_content:
            cleaned_content = await _safe_get()

    if not cleaned_content:
        raise HTTPException(status_code=502, detail='Failed to retrieve or parse content')

    # Run blocking LLM call in a thread pool
    data = await asyncio.to_thread(llm, cleaned_content, url, model)
    return data


@app.post('/api/scrape-and-save', response_model=Opportunity)
async def scrape_and_save(req: ScrapeRequest):
    existing_opportunity = get_opportunity_by_url(req.url)
    if existing_opportunity:
        logging.info(f"URL {req.url} already exists. Returning existing document.")
        return _map_doc_to_opportunity(existing_opportunity)

    try:
        scraped_data = await _scrape_url(req.url, str(req.model))
    except HTTPException:
        raise
    except Exception:
        logging.exception('Unhandled scrape error during scrape-and-save')
        raise HTTPException(status_code=500, detail='Internal server error during scraping')

    if not scraped_data:
        raise HTTPException(status_code=502, detail='Failed to extract any data from the URL.')

    # Use titlecase library
    from titlecase import titlecase

    now = datetime.datetime.now(datetime.UTC).isoformat()
    raw_title = scraped_data.get("activity_type", "")

    doc_to_insert = {
        "title": titlecase(raw_title) if raw_title else "Untitled Opportunity",
        "organization": scraped_data.get("organization_name"),
        "tags": [tag.lower() for tag in scraped_data.get("tags", [])],
        "location": scraped_data.get("location"),
        "description": scraped_data.get("extra"),
        "activityType": scraped_data.get("mode", "Onsite"), # Use mode from LLM
        "timeSlot": scraped_data.get("time_slot"),
        "slotAvailability": scraped_data.get("slot_availability"),
        "url": scraped_data.get("url"),
        "contactEmail": scraped_data.get("contact_email") if scraped_data.get("contact_email") != "N/A" else None,
        "contactPhone": str(scraped_data.get("contact_number")) if scraped_data.get("contact_number") else None,
        "createdAt": now,
        "updatedAt": now,
        "rawScrapedData": scraped_data,
    }

    try:
        inserted = insert_opportunity(doc_to_insert)
        if not inserted:
            raise HTTPException(status_code=500, detail='Database insert failed.')
    except Exception as e:
        logging.error(f"Failed to insert opportunity for URL {req.url}: {e}")
        existing = get_opportunity_by_url(req.url)
        if existing:
            return _map_doc_to_opportunity(existing)
        raise HTTPException(status_code=500, detail=f"An error occurred during database insertion: {e}")

    return _map_doc_to_opportunity(inserted)


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
        # Run blocking LLM call in a thread pool
        selectors = await asyncio.to_thread(generate_parser_selectors, req.raw_html, req.url)
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
        config_doc = {
            'domain': req.domain,
            'crawler': req.crawler or 'get',
            'include': req.include,
            'exclude': req.exclude,
            'updatedAt': datetime.datetime.now(datetime.UTC).isoformat()
        }
        update_site_config(req.domain, config_doc)
        return { 'status': 'ok', 'domain': req.domain }
    except HTTPException:
        raise
    except Exception:
        logging.exception('Unhandled save-config error')
        raise HTTPException(status_code=500, detail='Internal server error')


@app.get('/api/site-configs')
async def list_configs():
    try:
        configs = list_site_configs()
        for c in configs:
            c['_id'] = str(c['_id'])
        return {'configs': configs}
    except Exception:
        logging.exception('Failed to list site configs')
        raise HTTPException(status_code=500, detail='Internal server error')


@app.get('/api/site-configs/{domain}')
async def get_config(domain: str):
    try:
        config = get_site_config_by_domain(domain)
        if not config:
            raise HTTPException(status_code=404, detail='Config not found')
        config['_id'] = str(config['_id'])
        return config
    except HTTPException:
        raise
    except Exception:
        logging.exception('Failed to get site config')
        raise HTTPException(status_code=500, detail='Internal server error')


@app.delete('/api/site-configs/{domain}')
async def delete_config(domain: str):
    try:
        ok = delete_site_config(domain)
        if not ok:
            raise HTTPException(status_code=404, detail='Config not found')
        return {'ok': True}
    except HTTPException:
        raise
    except Exception:
        logging.exception('Failed to delete site config')
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
    created = _pick('createdAt') or _pick('created_at')
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
        slotAvailability=_pick_list('slotAvailability', 'slot_availability'),
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
    doc = {
        'title': (body.title or 'Untitled'),
        'organization': body.organization or '',
        'tags': body.tags or [],
        'location': body.location or '',
        'description': body.description or '',
        'activityType': body.activityType or '',
        'timeSlot': body.timeSlot or '',
        'slotAvailability': body.slotAvailability or [],
        'dateStart': body.dateStart,
        'dateEnd': body.dateEnd,
        'url': body.url or '',
        'contactEmail': body.contactEmail,
        'contactPhone': body.contactPhone,
    }
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

@app.post('/api/generate-config-url')
async def generate_config_url(req: GenerateConfigFromUrlRequest):
    try:
        import requests
        import urllib3
        from playwright.sync_api import sync_playwright

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }

        # First try with regular requests
        try:
            r = await asyncio.to_thread(requests.get, req.url, headers=headers, timeout=20, verify=True)
        except requests.exceptions.SSLError as ssl_err:
            logging.warning(f"SSL verification failed for {req.url}, retrying without verification: {ssl_err}")
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            r = await asyncio.to_thread(requests.get, req.url, headers=headers, timeout=20, verify=False)
        r.raise_for_status()
        raw_html = r.text
        logging.info(f"Fetched HTML length: {len(raw_html)}")

        # Check if this is a JS-heavy site by looking at the raw text content
        raw_text = _extract_visible_text(raw_html)
        logging.info(f"Raw text length from static HTML: {len(raw_text)}")

        # Track if we needed to use JS rendering
        used_js_crawler = False

        # If raw text is suspiciously short, use Playwright to render JavaScript
        if len(raw_text) < 500:
            logging.info(f"Detected JS-heavy site, using Playwright to render content")
            used_js_crawler = True
            def fetch_with_playwright():
                with sync_playwright() as p:
                    browser = p.chromium.launch()
                    page = browser.new_page()
                    page.goto(req.url)
                    # Wait for content to load
                    page.wait_for_timeout(3000)  # Wait 3 seconds for JS to render
                    return page.content()

            raw_html = await asyncio.to_thread(fetch_with_playwright)
            logging.info(f"Fetched rendered HTML length: {len(raw_html)}")
            raw_text = _extract_visible_text(raw_html)
            logging.info(f"Raw text length after JS rendering: {len(raw_text)}")

        # Run blocking LLM call in a thread pool with model parameter
        selectors = await asyncio.to_thread(generate_parser_selectors, raw_html, req.url, req.model or 'gemini')
        logging.info(f"Generated selectors: {selectors}")
        cleaned_text = parse_html(raw_html, selectors)
        logging.info(f"Cleaned text length: {len(cleaned_text)}")

        # Determine recommended crawler
        recommended_crawler = 'js' if used_js_crawler else 'get'
        logging.info(f"Recommended crawler: {recommended_crawler}")

        return {
            'selectors': selectors,
            'cleaned_text': cleaned_text,
            'raw_text': raw_text,
            'recommended_crawler': recommended_crawler
        }
    except HTTPException:
        raise
    except Exception:
        logging.exception('Unhandled generate-config-url error')
        raise HTTPException(status_code=500, detail='Internal server error')


class User(BaseModel):
    id: str
    name: str
    email: str
    role: str
    createdAt: str

class UserCreate(BaseModel):
    name: str
    email: str
    role: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None

class UserPaginated(BaseModel):
    items: list[User]
    total: int
    page: int
    pageSize: int

def _map_doc_to_user(doc: dict) -> User:
    """Map MongoDB user document to User model"""
    oid = doc.get('_id')
    id_str = str(oid) if oid else str(doc.get('id', ''))
    created = doc.get('createdAt') or doc.get('created_at') or ''
    if not created and oid:
        created = ObjectId(oid).generation_time.isoformat()
    return User(
        id=id_str,
        name=doc.get('name', ''),
        email=doc.get('email', ''),
        role=doc.get('role', 'user'),
        createdAt=created or ''
    )

@app.get("/api/users", response_model=UserPaginated)
async def get_users(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    q: Optional[str] = None,
    role: Optional[str] = None
):
    """List users with optional search and role filter."""
    page = max(1, page)
    pageSize = max(1, min(100, pageSize))
    docs, total = list_users(page=page, page_size=pageSize, q=q, role=role)
    items = [_map_doc_to_user(d) for d in docs]
    return UserPaginated(items=items, total=total, page=page, pageSize=pageSize)

@app.post("/api/users", response_model=User)
async def create_user_endpoint(user: UserCreate):
    """Create a new user."""
    # Check if email already exists
    existing = get_user_by_email(user.email)
    if existing:
        raise HTTPException(status_code=400, detail='Email already exists')

    user_data = {
        'name': user.name,
        'email': user.email,
        'role': user.role,
        'createdAt': datetime.datetime.now(datetime.UTC).isoformat(),
    }

    doc = insert_user(user_data)
    if not doc:
        raise HTTPException(status_code=500, detail='Failed to create user')

    return _map_doc_to_user(doc)

@app.put("/api/users/{user_id}", response_model=User)
async def update_user_endpoint(user_id: str, user: UserUpdate):
    """Update an existing user."""
    existing = get_user_by_id(user_id)
    if not existing:
        raise HTTPException(status_code=404, detail='User not found')

    update_data = {}
    if user.name is not None:
        update_data['name'] = user.name
    if user.email is not None:
        update_data['email'] = user.email
    if user.role is not None:
        update_data['role'] = user.role

    if not update_data:
        return _map_doc_to_user(existing)

    doc = update_user(user_id, update_data)
    if not doc:
        raise HTTPException(status_code=500, detail='Failed to update user')

    return _map_doc_to_user(doc)

@app.delete("/api/users/{user_id}")
async def delete_user_endpoint(user_id: str):
    """Delete a user by ID."""
    ok = delete_user(user_id)
    if not ok:
        raise HTTPException(status_code=404, detail='User not found')
    return {"ok": True}
