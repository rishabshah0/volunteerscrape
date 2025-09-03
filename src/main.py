import json
import yaml
import logging
from urllib.parse import urlsplit
from storage import save_to_mongodb
from get_crawler import get_webpage_content
from js_crawler import get_webpage_content_js
from llm import llm
from utils import normalize_url

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

SITES_CONFIG_PATH = "sites.yaml"


try:
    with open(SITES_CONFIG_PATH, 'r') as f:
        sites_config = yaml.safe_load(f)
except FileNotFoundError:
    raise FileNotFoundError(f"Configuration file not found at: {SITES_CONFIG_PATH}")

input_url = input("Enter the URL to scrape: ")
normalized_url = normalize_url(input_url)
model_choice = input("Enter the model to use (gemini/gpt): ").lower()
domain = urlsplit(normalized_url).netloc.replace("www.", "")

if domain in sites_config:
    config = sites_config[domain]
    crawler_type = config.get('crawler')
    instructions = config.get('instructions', {})
    print(f"Using {crawler_type} for: {domain}")
    
    if crawler_type == 'get':
        page_content = get_webpage_content(normalized_url, instructions)
    elif crawler_type == 'js':
        page_content = get_webpage_content_js(normalized_url, instructions)
    else:
        raise Warning(f"Unknown crawler type for {domain}: {crawler_type}")
    
    if page_content:
        logging.info(f"Querying LLM with {model_choice}...")
        opportunity_data = llm(page_content, normalized_url, model_name=model_choice)
        
        if opportunity_data:
            logging.info("Successfully extracted information:")
            logging.info(json.dumps(opportunity_data, indent=2))
            save_to_mongodb(opportunity_data)
        else:
            raise Exception("Failed to extract information using the API.")
    else:
        raise Exception(f"Failed to retrieve webpage content for {normalized_url}.")
else:
    raise Exception(f"No configuration found for domain: {domain}")
