from playwright.sync_api import sync_playwright
import logging
from .parser import parse_html


def get_webpage_content_js(url: str, instructions: dict) -> str:
    """
    Fetches webpage content using Playwright and parses it.
    """
    with sync_playwright() as p:
        logging.info(f"Launching browser")
        browser = p.chromium.launch()
        page = browser.new_page()
        logging.info(f"Navigating to {url}")
        page.goto(url, wait_until='networkidle')

        if wait_selector := instructions.get('wait'):
            logging.info(f"Waiting for selector: {wait_selector}")
            page.wait_for_selector(wait_selector, timeout=10000)
        else:
            # For Salesforce/dynamic sites, wait for common content indicators
            # Try to wait for common content containers, but don't fail if they don't exist
            logging.info("Waiting for content to load...")
            try:
                page.wait_for_selector('main, article, [class*="content"], [class*="slds"]', timeout=5000)
            except:
                # If no common selectors found, just wait a bit for JS to execute
                page.wait_for_timeout(2000)

        html_content = page.content()
        browser.close()
        logging.info(f"Successfully fetched content from {url}")
        return parse_html(html_content, instructions)