"""Shared scraping helpers for wahapedia data extraction."""

import json
import time
import requests
from bs4 import BeautifulSoup
from pathlib import Path

BASE_URL = "https://wahapedia.ru"
DATA_DIR = Path(__file__).parent.parent / "data"

# Rate limiting
_last_request_time = 0.0
REQUEST_DELAY = 1.5  # seconds between requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


def fetch_page(url: str) -> BeautifulSoup:
    """Fetch a page with rate limiting and return parsed BeautifulSoup."""
    global _last_request_time

    # Rate limit
    elapsed = time.time() - _last_request_time
    if elapsed < REQUEST_DELAY:
        time.sleep(REQUEST_DELAY - elapsed)

    if not url.startswith("http"):
        url = BASE_URL + url

    print(f"  Fetching: {url}")
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()
    _last_request_time = time.time()

    return BeautifulSoup(response.text, "lxml")


def clean_text(element) -> str:
    """Extract clean text from a BeautifulSoup element."""
    if element is None:
        return ""
    text = element.get_text(separator=" ", strip=True)
    # Normalize whitespace
    return " ".join(text.split())


def save_json(data, filename: str, subdir: str = None) -> None:
    """Write data as pretty-printed JSON to the data directory.

    If subdir is provided, saves to data/{subdir}/{filename}.
    """
    target_dir = DATA_DIR / subdir if subdir else DATA_DIR
    target_dir.mkdir(parents=True, exist_ok=True)
    filepath = target_dir / filename
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  Saved {filepath} ({len(data)} items)")
