"""Scrape Warhammer 40k 10th edition core rules from wahapedia."""

import re
from utils import fetch_page, clean_text, save_json

CORE_RULES_URL = "/wh40k10ed/the-rules/core-rules/"

# Major sections are ALL CAPS h3 headings
MAJOR_SECTIONS = {
    "CORE CONCEPTS",
    "COMMAND PHASE",
    "MOVEMENT PHASE",
    "SHOOTING PHASE",
    "CHARGE PHASE",
    "FIGHT PHASE",
}


def parse_core_rules(soup):
    """Parse core rule sections from the rules page.

    The page uses h3 elements for all headings. Major phase headings are
    ALL CAPS. We group subsections under their parent major section.
    """
    rules = []

    headers = soup.find_all('h3')
    if not headers:
        return rules

    current_section = None
    current_parts = []

    for header in headers:
        header_text = clean_text(header)
        if not header_text:
            continue

        # Check if this is a major section (ALL CAPS)
        is_major = header_text.isupper() and len(header_text) > 3

        if is_major:
            # Save previous section if exists
            if current_section and current_parts:
                rules.append({
                    'name': current_section,
                    'text': ' '.join(current_parts).strip(),
                })

            current_section = header_text
            current_parts = []

            # Collect text until next h3
            el = header.next_sibling
            while el:
                if hasattr(el, 'name') and el.name == 'h3':
                    break
                if hasattr(el, 'name') and hasattr(el, 'get'):
                    classes = el.get('class', [])
                    if 'ShowFluff' in classes:
                        el = el.next_sibling
                        continue
                    text = clean_text(el)
                    if text:
                        current_parts.append(text)
                el = el.next_sibling
        else:
            # Subsection — collect its text and add to current section
            subsection_parts = [f"[{header_text}]"]
            el = header.next_sibling
            while el:
                if hasattr(el, 'name') and el.name == 'h3':
                    break
                if hasattr(el, 'name') and hasattr(el, 'get'):
                    classes = el.get('class', [])
                    if 'ShowFluff' in classes:
                        el = el.next_sibling
                        continue
                    text = clean_text(el)
                    if text:
                        subsection_parts.append(text)
                el = el.next_sibling

            if len(subsection_parts) > 1:
                if current_section:
                    current_parts.extend(subsection_parts)
                else:
                    # Standalone subsection before any major section
                    rules.append({
                        'name': header_text,
                        'text': ' '.join(subsection_parts[1:]).strip(),
                    })

    # Don't forget the last section
    if current_section and current_parts:
        rules.append({
            'name': current_section,
            'text': ' '.join(current_parts).strip(),
        })

    return rules


def main():
    print("Scraping core rules...")
    soup = fetch_page(CORE_RULES_URL)

    rules = parse_core_rules(soup)
    print(f"  Found {len(rules)} core rule sections")
    for r in rules:
        preview = r['text'][:80] + '...' if len(r['text']) > 80 else r['text']
        print(f"    {r['name']}: {preview}")

    save_json(rules, 'core-rules.json')
    return rules


if __name__ == '__main__':
    main()
