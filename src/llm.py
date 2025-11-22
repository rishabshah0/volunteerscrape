import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from bs4 import BeautifulSoup

load_dotenv()

class CSROpportunity(BaseModel):
    organization_name: str = Field(description="Full organization name running the opportunity; prefer the most prominent branding on page.")
    activity_type: str = Field(description='3–10 word specific activity summary (e.g., "environmental cleanup and service projects"). Avoid generic phrasing.')
    location: str = Field(description='Street Address, City, State only. If absent use "N/A".')
    time_slot: str = Field(description='"F" for flexible/drop-in; recurring pattern like "Su M T W Th F Sa"; specific dated schedules: put dates in extra unless clearly recurring without break.')
    slot_availability: list[str] = Field(description='One or more of: "individual drop-in welcome", "individual application required", "corporate group drop-in welcome", "corporate group application required"; else ["N/A"].')
    contact_email: str = Field(description="Most relevant email or 'N/A'.")
    contact_number: int = Field(description="Primary phone digits only; 0 if none.")
    extra: str = Field(description="Important details that do not fit other fields. 'N/A' if none.")
    tags: list[str] = Field(description='1–3 tags from: environment, food security, education, community, healthcare, animal welfare, disaster relief, homeless support, advocacy.')

class ParserSelectors(BaseModel):
    include: str = Field(description="Comma-separated minimal CSS selectors capturing ONLY the core descriptive content (e.g. '#main, article, .content').")
    exclude: str = Field(description="Comma-separated selectors to remove navigation, headers, footers, sidebars, share widgets, scripts, styles (e.g. 'nav, footer, header, aside, script, style, .share').")

def _get_model(model_name: str = 'gemini'):
    if model_name == "gemini":
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set.")
        return ChatGoogleGenerativeAI(model="gemini-flash-latest", google_api_key=api_key)
    if model_name == "gpt":
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set.")
        return ChatOpenAI(model="gpt-5-mini", api_key=api_key)
    raise ValueError(f"Unknown model: {model_name}")

SYSTEM_PROMPT_MAIN = "You extract structured, concise volunteer opportunity data. Return the data in the exact schema provided."

def llm(content: str, url: str, model_name: str = "gemini") -> dict:
    model = _get_model(model_name)
    structured_llm = model.with_structured_output(CSROpportunity)
    safe_content = content.replace('{', '{{').replace('}', '}}')
    user_msg = f"URL: {url}\nPage Text:\n{safe_content}"
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT_MAIN),
        ("user", user_msg)
    ])
    chain = prompt | structured_llm
    result = chain.invoke({})
    data = result.model_dump()
    data['url'] = url
    return data

SYSTEM_PROMPT_SELECTORS = (
    "You analyze raw HTML of a single volunteer opportunity page and propose minimal CSS include selectors capturing ONLY the core descriptive content and exclude selectors removing surrounding boilerplate. Keep selectors short."
)

def generate_parser_selectors(raw_html: str, url: str, model_name: str = 'gemini') -> dict:
    model = _get_model(model_name)
    structured_llm = model.with_structured_output(ParserSelectors)
    safe_html = raw_html.replace('{', '{{').replace('}', '}}')
    soup = BeautifulSoup(raw_html, 'html.parser')
    title_tag = soup.find('title')
    title = title_tag.get_text(strip=True) if title_tag else "No title"
    user_msg = f"URL: {url}\nPage Title: {title}\nRaw HTML (first 8000 chars):\n{safe_html[:8000]}"
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT_SELECTORS),
        ("user", user_msg)
    ])
    chain = prompt | structured_llm
    result = chain.invoke({})
    return result.model_dump()
