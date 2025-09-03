import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from langchain.tools import tool
from dotenv import load_dotenv
from bs4 import BeautifulSoup
import json as _json

load_dotenv()

# ---------------- Structured Models / Tools ---------------- #

class VolunteerOpportunity(BaseModel):
    organization_name: str = Field(description="Full organization name running the opportunity; prefer the most prominent branding on page.")
    activity_type: str = Field(description='3–10 word specific activity summary (e.g., "environmental cleanup and service projects"). Avoid generic phrasing.')
    location: str = Field(description='Street Address, City, State only. If absent use "N/A".')
    time_slot: str = Field(description='"F" for flexible/drop-in; recurring pattern like "Su M T W Th F Sa"; specific dated schedules: put dates in extra unless clearly recurring without break.')
    slot_availability: list[str] = Field(description='One or more of: "individual drop-in welcome", "individual application required", "corporate group drop-in welcome", "corporate group application required"; else ["N/A"].')
    contact_email: str = Field(description="Most relevant email or 'N/A'.")
    contact_number: int = Field(description="Primary phone digits only; 0 if none.")
    extra: str = Field(description="Important details that do not fit other fields. 'N/A' if none.")
    tags: list[str] = Field(description='1–3 tags from: environment, food security, education, community, healthcare, animal welfare, disaster relief, homeless support, advocacy.')

@tool(args_schema=VolunteerOpportunity)
def extract_volunteer_opportunity(**data) -> dict:  # type: ignore
    """Return structured volunteer opportunity data."""
    return data

class ParserSelectors(BaseModel):
    include: str = Field(description="Comma-separated minimal CSS selectors capturing ONLY the core descriptive content (e.g. '#main, article, .content').")
    exclude: str = Field(description="Comma-separated selectors to remove navigation, headers, footers, sidebars, share widgets, scripts, styles (e.g. 'nav, footer, header, aside, script, style, .share').")

@tool(args_schema=ParserSelectors)
def propose_selectors(include: str, exclude: str) -> dict:
    """Return include / exclude selector strings."""
    return {"include": include, "exclude": exclude}

# ---------------- Model Factory ---------------- #

def _get_model(model_name: str = 'gemini'):
    if model_name == "gemini":
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set.")
        return ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=api_key)
    if model_name == "gpt":
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set.")
        return ChatOpenAI(openai_api_key=api_key, model_name="gpt-4.1-mini")
    raise ValueError(f"Unknown model: {model_name}")

# ---------------- Main Extraction ---------------- #

SYSTEM_PROMPT_MAIN = "You extract structured, concise volunteer opportunity data. Use the tool exactly once with best values."

def llm(content: str, url: str, model_name: str = "gemini") -> dict:
    model = _get_model(model_name)
    safe_content = content.replace('{', '{{').replace('}', '}}')
    user_msg = f"URL: {url}\nPage Text:\n{safe_content}"
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT_MAIN),
        ("user", user_msg)
    ])
    chain = prompt | model.bind_tools([extract_volunteer_opportunity])
    resp = chain.invoke({})
    tool_call = resp.tool_calls[0]
    data = tool_call["args"]
    data['url'] = url
    return data

# ---------------- Selector Generation ---------------- #

SYSTEM_PROMPT_SELECTORS = (
    "You analyze raw HTML of a single volunteer opportunity page and propose minimal CSS include selectors capturing ONLY the core descriptive content and exclude selectors removing surrounding boilerplate. Keep selectors short."
)

def generate_parser_selectors(raw_html: str, url: str, model_name: str = 'gemini') -> dict:
    model = _get_model(model_name)
    safe_html = raw_html.replace('{', '{{').replace('}', '}}')
    user_msg = f"URL: {url}\nRaw HTML:\n{safe_html}\nReturn selectors via the tool."
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT_SELECTORS),
        ("user", user_msg)
    ])
    try:
        chain = prompt | model.bind_tools([propose_selectors])
        resp = chain.invoke({})
        tool_call = resp.tool_calls[0]
        sel = tool_call['args']
        include = (sel.get('include') or 'body').strip()
        exclude = (sel.get('exclude') or 'script, style, nav, footer, header, aside').strip()
        return { 'include': include, 'exclude': exclude }
    except Exception:
        # Heuristic fallback
        soup = BeautifulSoup(raw_html, 'html.parser')
        # pick largest meaningful container
        best_selector = 'body'
        largest_len = 0
        for tag in ['main', 'article', 'section', 'div']:
            for el in soup.find_all(tag):
                text_len = len(el.get_text(strip=True))
                if text_len > largest_len:
                    largest_len = text_len
                    if el.get('id'):
                        best_selector = f"#{el.get('id')}"
                    elif el.get('class'):
                        best_selector = '.' + '.'.join(el.get('class')[:2])
                    else:
                        best_selector = tag
        return { 'include': best_selector, 'exclude': 'script, style, nav, footer, header, aside'}
