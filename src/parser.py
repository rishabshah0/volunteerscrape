import logging
from bs4 import BeautifulSoup

def parse_html(html_content: str, instructions: dict) -> str:
    """
    Parses HTML content using BeautifulSoup, applying filtering rules
    and cleaning the resulting text.
    """
    soup = BeautifulSoup(html_content, 'html.parser')

    # Always remove script, style, and noscript tags to match raw_text extraction
    for tag in soup(['script', 'style', 'noscript']):
        tag.decompose()

    # Exclude specified elements first
    if exclude_selectors := instructions.get('exclude'):
        for element in soup.select(exclude_selectors):
            element.decompose()

    # If include selectors are provided, focus only on those parts.
    # Otherwise, use the entire document body.
    if include_selectors := instructions.get('include'):
        content_elements = soup.select(include_selectors)
        if not content_elements:
            logging.warning(f"Include selectors '{include_selectors}' did not match any content. Falling back to body.")
            # Fallback: try to get body content
            body = soup.find('body')
            if body:
                text = body.get_text(separator='\n', strip=True)
            else:
                text = soup.get_text(separator='\n', strip=True)
        else:
            # Filter out elements that are descendants of other selected elements to avoid text duplication
            selected_set = set(content_elements)
            top_level_elements = []
            for el in content_elements:
                # Check if any parent of el is in selected_set
                has_parent_in_selection = False
                for parent in el.parents:
                    if parent in selected_set:
                        has_parent_in_selection = True
                        break
                if not has_parent_in_selection:
                    top_level_elements.append(el)

            # Join the text from all matched elements
            text = '\n'.join(el.get_text(separator='\n', strip=True) for el in top_level_elements)
    else:
        text = soup.get_text(separator='\n', strip=True)

    # Final cleanup to remove any resulting blank lines
    clean_text = '\n'.join(line for line in text.splitlines() if line.strip())

    logging.info(f"Cleaned text length: {len(clean_text)} chars")
    return clean_text