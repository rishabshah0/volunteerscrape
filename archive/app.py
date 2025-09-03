import os
import re
import json
import yaml
import logging
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit, urlunsplit

from fastapi import FastAPI, HTTPException, Request
from fastapi import responses as fastapi_responses
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator

import sys
# Resolve project base (directory containing sites.yaml)
BASE_DIR = Path(__file__).resolve().parent
while BASE_DIR != BASE_DIR.parent and not (BASE_DIR / 'sites.yaml').exists():
    BASE_DIR = BASE_DIR.parent
SRC_DIR = BASE_DIR / 'src'
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from get_crawler import get_webpage_content  # type: ignore
from js_crawler import get_webpage_content_js  # type: ignore
from parser import parse_html  # type: ignore
from llm import llm, generate_parser_selectors  # type: ignore

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

SITES_CONFIG_PATH = BASE_DIR / 'sites.yaml'
RAW_HTML_MIN_LEN = 2048  # bytes threshold to decide if we fallback to JS crawler

app = FastAPI(title="Volunteer Scraper API", version="0.1.0")

# CORS (allow file:// null origin and localhost origins)
origins = ["http://localhost", "http://localhost:8000", "http://127.0.0.1:8000", "null"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- Utility Functions -------------------- #

def normalize_url(url: str) -> str:
    parts = urlsplit(url.strip())
    scheme = parts.scheme or 'https'
    netloc = parts.netloc or parts.path
    path = parts.path if parts.netloc else ''
    normalized = urlunsplit((scheme.lower(), netloc.lower(), path, parts.query, parts.fragment))
    return normalized

def extract_domain(url: str) -> str:
    return urlsplit(url).netloc.replace('www.', '')

SAFE_DOMAIN_REGEX = re.compile(r'^[A-Za-z0-9.-]+$')

# -------------------- Pydantic Models -------------------- #

class ScrapeRequest(BaseModel):
    url: str
    model: Optional[str] = 'gemini'

    @validator('url')
    def validate_url(cls, v):
        if not v or len(v) > 2048:
            raise ValueError('Invalid URL length')
        norm = normalize_url(v)
        parts = urlsplit(norm)
        if parts.scheme not in {'http', 'https'}:
            raise ValueError('Unsupported URL scheme')
        if not SAFE_DOMAIN_REGEX.match(parts.netloc):
            raise ValueError('Invalid domain')
        return norm

    @validator('model')
    def validate_model(cls, v):
        if v not in {'gemini', 'gpt'}:
            raise ValueError('model must be gemini or gpt')
        return v

class GenerateConfigRequest(BaseModel):
    url: str

    @validator('url')
    def validate_url(cls, v):
        if not v or len(v) > 2048:
            raise ValueError('Invalid URL length')
        norm = normalize_url(v)
        parts = urlsplit(norm)
        if parts.scheme not in {'http', 'https'}:
            raise ValueError('Unsupported URL scheme')
        if not SAFE_DOMAIN_REGEX.match(parts.netloc):
            raise ValueError('Invalid domain')
        return norm

class SaveConfigRequest(BaseModel):
    domain: str
    include: str
    exclude: str

    @validator('domain')
    def validate_domain(cls, v):
        if not SAFE_DOMAIN_REGEX.match(v):
            raise ValueError('Invalid domain')
        return v.lower()

    @validator('include', 'exclude')
    def validate_selectors(cls, v):
        if len(v) > 1000:
            raise ValueError('Selector too long')
        return v.strip()

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

@app.post('/api/scrape')
async def scrape(req: ScrapeRequest):
    try:
        sites_config = load_sites_config()
        domain = extract_domain(req.url)
        if domain not in sites_config:
            raise HTTPException(status_code=404, detail='No configuration for this domain')
        cfg = sites_config[domain]
        crawler_type = cfg.get('crawler', 'get')
        instructions = cfg.get('instructions', {})
        if crawler_type == 'get':
            cleaned_content = get_webpage_content(req.url, instructions)
        elif crawler_type == 'js':
            cleaned_content = get_webpage_content_js(req.url, instructions)  # type: ignore
        else:
            raise HTTPException(status_code=400, detail='Unsupported crawler type in config')
        if not cleaned_content:
            raise HTTPException(status_code=502, detail='Failed to retrieve or parse content')
        data = llm(cleaned_content, req.url, model_name=str(req.model))
        return data
    except HTTPException:
        raise
    except Exception as e:
        logging.exception('Unhandled scrape error')
        raise HTTPException(status_code=500, detail='Internal server error') 

@app.get('/api/scrape')
async def scrape_get(url: str, model: str = 'gemini'):
    # Reuse validation logic manually for query params
    try:
        if model not in {'gemini', 'gpt'}:
            raise HTTPException(status_code=400, detail='model must be gemini or gpt')
        if not url or len(url) > 2048:
            raise HTTPException(status_code=400, detail='Invalid URL length')
        norm_url = normalize_url(url)
        parts = urlsplit(norm_url)
        if parts.scheme not in {'http', 'https'}:
            raise HTTPException(status_code=400, detail='Unsupported URL scheme')
        if not SAFE_DOMAIN_REGEX.match(parts.netloc):
            raise HTTPException(status_code=400, detail='Invalid domain')
        sites_config = load_sites_config()
        domain = extract_domain(norm_url)
        if domain not in sites_config:
            raise HTTPException(status_code=404, detail='No configuration for this domain')
        cfg = sites_config[domain]
        crawler_type = cfg.get('crawler', 'get')
        instructions = cfg.get('instructions', {})
        if crawler_type == 'get':
            cleaned_content = get_webpage_content(norm_url, instructions)
        elif crawler_type == 'js':
            cleaned_content = get_webpage_content_js(norm_url, instructions)  # type: ignore
        else:
            raise HTTPException(status_code=400, detail='Unsupported crawler type in config')
        if not cleaned_content:
            raise HTTPException(status_code=502, detail='Failed to retrieve or parse content')
        data = llm(cleaned_content, norm_url, model_name=model)
        return data
    except HTTPException:
        raise
    except Exception:
        logging.exception('Unhandled scrape error (GET)')
        raise HTTPException(status_code=500, detail='Internal server error') 

@app.post('/api/generate-config')
async def generate_config(req: GenerateConfigRequest):
    import requests
    from playwright.async_api import async_playwright
    try:
        headers = { 'User-Agent': 'Mozilla/5.0' }
        raw_html = ''
        used_js = False
        # Attempt simple GET first (raw HTML)
        try:
            r = requests.get(req.url, headers=headers, timeout=10)
            r.raise_for_status()
            raw_html = r.text
        except Exception:
            logging.info('Primary GET fetch failed outright; will fallback to JS crawler after length check')
        # Fallback if content too short
        if len(raw_html.encode('utf-8')) < RAW_HTML_MIN_LEN:
            logging.info('Content below threshold or empty; fetching raw HTML via JS crawler')
            async with async_playwright() as p:
                browser = await p.chromium.launch()
                page = await browser.new_page()
                await page.goto(req.url)
                raw_html = await page.content()
                await browser.close()
            used_js = True
        # Produce a baseline cleaned text using appropriate crawler function (empty selectors)
        baseline_instructions = { 'include': '', 'exclude': '' }
        if used_js:
            try:
                _baseline_clean = get_webpage_content_js(req.url, baseline_instructions)  # type: ignore
            except Exception:
                _baseline_clean = ''
        else:
            try:
                _baseline_clean = get_webpage_content(req.url, baseline_instructions)
            except Exception:
                _baseline_clean = ''
        # LLM-based selector generation (imported generate_parser_selectors)
        selectors = generate_parser_selectors(raw_html, req.url)
        cleaned_text = parse_html(raw_html, selectors)
        return { 'raw_html': raw_html, 'cleaned_text': cleaned_text, 'selectors': selectors }
    except HTTPException:
        raise
    except Exception as e:
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
    except Exception as e:
        logging.exception('Unhandled save-config error')
        raise HTTPException(status_code=500, detail='Internal server error') 

@app.get('/')
async def root():
    return { 'message': 'Volunteer Scraper API running' }

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return fastapi_responses.JSONResponse(status_code=exc.status_code, content={'detail': exc.detail})

# Run with: uvicorn webapp.app:app --reload
