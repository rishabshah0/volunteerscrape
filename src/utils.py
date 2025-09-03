from urllib.parse import urlsplit, urlunsplit

def normalize_url(url: str) -> str:
    """
    Normalizes a URL to ensure it has a scheme and a netloc.
    """
    split_url = urlsplit(url)
    if not split_url.scheme:
        split_url = split_url._replace(scheme="https")
    if not split_url.netloc:
        split_url = split_url._replace(netloc=split_url.path)
        split_url = split_url._replace(path="")
    return urlunsplit(split_url)

def extract_domain(url: str) -> str:
    return urlsplit(url).netloc.replace('www.', '')
