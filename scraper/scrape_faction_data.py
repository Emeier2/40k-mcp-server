"""Scrape stratagems, enhancements, detachment rules, and faction rules from wahapedia.

All this data lives on the main Aeldari faction page:
https://wahapedia.ru/wh40k10ed/factions/aeldari/
"""

import re
from utils import fetch_page, clean_text, save_json

FACTION_URL = "/wh40k10ed/factions/aeldari/"


def parse_stratagems(soup):
    """Parse all stratagems from the faction page.

    Structure:
    - div.str10Wrap contains each stratagem
    - div.str10Name: stratagem name
    - div.str10CP: CP cost (e.g. "1CP")
    - div.str10Type: "{Detachment} – {Type} Stratagem"
    - div.str10Text: WHEN/TARGET/EFFECT text with bold labels
    """
    stratagems = []
    wraps = soup.find_all(class_='str10Wrap')

    for wrap in wraps:
        name_el = wrap.find(class_='str10Name')
        cp_el = wrap.find(class_='str10CP')
        type_el = wrap.find(class_='str10Type')
        text_el = wrap.find(class_='str10Text')

        if not name_el:
            continue

        name = clean_text(name_el)
        cp_text = clean_text(cp_el) if cp_el else "1CP"
        cp_match = re.search(r'(\d+)', cp_text)
        cp_cost = int(cp_match.group(1)) if cp_match else 1

        # Parse type: "Warhost – Battle Tactic Stratagem"
        type_text = clean_text(type_el) if type_el else ""
        type_text = type_text.replace(' Stratagem', '')  # Remove "Stratagem" suffix

        # Split into detachment and type
        detachment = ""
        strat_type = type_text
        if '–' in type_text:
            parts = type_text.split('–', 1)
            detachment = parts[0].strip()
            strat_type = parts[1].strip()
        elif '-' in type_text:
            parts = type_text.split('-', 1)
            detachment = parts[0].strip()
            strat_type = parts[1].strip()

        # Parse WHEN/TARGET/EFFECT from str10Text
        when_text = ""
        target_text = ""
        effect_text = ""
        restrictions = None

        if text_el:
            # Get full text content with markers
            full_text = ""
            for child in text_el.descendants:
                if isinstance(child, str):
                    full_text += child
                elif hasattr(child, 'name'):
                    if child.name == 'b':
                        text = clean_text(child)
                        if text in ['WHEN:', 'TARGET:', 'EFFECT:', 'RESTRICTIONS:']:
                            full_text += f'\n{text} '
                    elif child.name == 'br':
                        pass  # handled by text flow
                    elif child.name == 'span' and 'kwb' in ' '.join(child.get('class', [])):
                        full_text += clean_text(child)

            # Re-parse from full text using simpler approach
            full_text = clean_text(text_el)

            # Extract sections using WHEN/TARGET/EFFECT markers
            when_match = re.search(r'WHEN:\s*(.*?)(?=TARGET:|EFFECT:|RESTRICTIONS:|$)', full_text, re.DOTALL)
            target_match = re.search(r'TARGET:\s*(.*?)(?=EFFECT:|RESTRICTIONS:|$)', full_text, re.DOTALL)
            effect_match = re.search(r'EFFECT:\s*(.*?)(?=RESTRICTIONS:|$)', full_text, re.DOTALL)
            restrict_match = re.search(r'RESTRICTIONS:\s*(.*?)$', full_text, re.DOTALL)

            when_text = when_match.group(1).strip() if when_match else ""
            target_text = target_match.group(1).strip() if target_match else ""
            effect_text = effect_match.group(1).strip() if effect_match else ""
            restrictions = restrict_match.group(1).strip() if restrict_match else None

        stratagem = {
            'name': name,
            'detachment': detachment,
            'cpCost': cp_cost,
            'type': strat_type,
            'when': when_text,
            'target': target_text,
            'effect': effect_text,
            'restrictions': restrictions,
        }
        stratagems.append(stratagem)

    return stratagems


def parse_enhancements(soup):
    """Parse all enhancements from the faction page.

    Structure:
    - ul.EnhancementsPts > li contains name and points
    - Following <p> contains the effect text
    - They're grouped under detachment sections
    """
    enhancements = []

    # Find all enhancement point entries
    enh_pts = soup.find_all('ul', class_='EnhancementsPts')

    for enh_ul in enh_pts:
        li = enh_ul.find('li')
        if not li:
            continue

        # Get name and points from the spans
        spans = li.find_all('span')
        name = ""
        pts_text = ""
        if len(spans) >= 2:
            name = clean_text(spans[0])
            pts_text = clean_text(spans[1])
        elif len(spans) == 1:
            name = clean_text(spans[0])

        # Extract points cost
        pts_match = re.search(r'(\d+)\s*pts', pts_text)
        points_cost = int(pts_match.group(1)) if pts_match else 0

        # Get effect text from subsequent <p> elements (skip ShowFluff ones)
        effect_parts = []
        restrictions = ""
        parent_td = enh_ul.find_parent('td')
        if parent_td:
            paragraphs = parent_td.find_all('p')
            for p in paragraphs:
                if 'ShowFluff' in ' '.join(p.get('class', [])):
                    continue
                p_text = clean_text(p)
                if p_text:
                    effect_parts.append(p_text)

        effect = ' '.join(effect_parts)

        # Try to extract restriction (usually first sentence like "ASURYANI model only.")
        restrict_match = re.match(r'^(.*?model only\.)\s*', effect)
        if restrict_match:
            restrictions = restrict_match.group(1)
            effect = effect[len(restrict_match.group(0)):].strip()

        # Determine detachment by looking up the DOM tree
        detachment = ""
        parent = enh_ul.parent
        for _ in range(20):
            if parent is None or parent.name == 'body':
                break
            # Look for detachName in preceding siblings or parent context
            detach_el = parent.find_previous(class_='detachName')
            if detach_el:
                detachment = clean_text(detach_el)
                # Remove "Detachment" suffix if present
                detachment = re.sub(r'\s*Detachment\s*$', '', detachment)
                break
            parent = parent.parent

        if not name:
            continue

        enhancement = {
            'name': name,
            'detachment': detachment,
            'pointsCost': points_cost,
            'restrictions': restrictions,
            'effect': effect,
        }
        enhancements.append(enhancement)

    return enhancements


def parse_detachment_rules(soup):
    """Parse detachment rules.

    After the Army-Rules anchor, each detachment is a div with classes like
    'clFl AEAE AEWH'. Inside each, there's a Detachment-Rule-N anchor followed
    by the rule content.

    We use the nav table of contents (NavColumns3) to map detachment names
    to their rule names.
    """
    detachments = []

    # Step 1: Build detachment name -> rule name map from the nav
    navs = soup.find_all(class_='NavColumns3')
    detachment_map = {}  # ordered map of detach_name -> rule_name

    for nav in navs:
        mw1_divs = nav.find_all('div', class_=lambda c: c and 'mw1' in c)
        current_detach = None
        saw_detach_rule = False

        for div in mw1_divs:
            classes = div.get('class', [])
            text = div.get_text(strip=True)

            # Skip boarding actions, crusade rules, legendary
            if any('sShowBoardingActions' in c or 'sCrusadeRules' in c or 'sLegendary' in c
                   for c in classes):
                continue

            if 'i10' in classes and text not in ['Books', 'FAQ', 'Introduction', 'Army Rules']:
                current_detach = text
                saw_detach_rule = False
            elif 'i30' in classes and text == 'Detachment Rule' and current_detach:
                saw_detach_rule = True
            elif 'i50' in classes and saw_detach_rule and current_detach:
                if current_detach not in detachment_map:
                    detachment_map[current_detach] = text
                saw_detach_rule = False

    print(f"  Nav detachment map: {len(detachment_map)} entries")
    for name, rule in detachment_map.items():
        print(f"    {name} -> {rule}")

    # Step 2: Get rule text from the main content
    # After Army-Rules anchor, each detachment is a sibling div with class 'clFl AEAE XX'
    # Inside, the rule is in: div.Columns2 > div.BreakInsideAvoid containing an h3 + text
    army_anchor = soup.find('a', attrs={'name': 'Army-Rules'})
    if not army_anchor:
        for name, rule_name in detachment_map.items():
            detachments.append({'name': name, 'ruleName': rule_name, 'ruleText': ''})
        return detachments

    for detach_name, rule_name in detachment_map.items():
        rule_text = ""

        # Find the div whose h2.outline_header text matches the detachment name
        el = army_anchor.next_sibling
        while el:
            if hasattr(el, 'name') and hasattr(el, 'get'):
                classes = el.get('class', [])
                if el.name == 'div' and 'clFl' in classes and 'AEAE' in classes:
                    h2 = el.find('h2', class_='outline_header')
                    if h2 and clean_text(h2) == detach_name:
                        # Found the detachment div. Find the rule name anchor
                        rule_name_slug = rule_name.replace(' ', '-').replace("'", '-')
                        rule_h3 = el.find('h3')
                        if rule_h3:
                            # Get all text content after the h3 until the Enhancements section
                            parts = []
                            parent_bia = rule_h3.find_parent('div', class_='BreakInsideAvoid')
                            if parent_bia:
                                # Get non-fluff content from this BreakInsideAvoid
                                for child in parent_bia.children:
                                    if hasattr(child, 'name') and hasattr(child, 'get'):
                                        if child == rule_h3:
                                            continue
                                        child_classes = child.get('class', [])
                                        if 'ShowFluff' in child_classes:
                                            continue
                                        parts.append(clean_text(child))
                                    elif isinstance(child, str) and child.strip():
                                        parts.append(child.strip())
                            rule_text = ' '.join(p for p in parts if p).strip()
                        break
                if 'sCrusadeRules' in classes:
                    break
            el = el.next_sibling

        detachments.append({
            'name': detach_name,
            'ruleName': rule_name,
            'ruleText': rule_text,
        })

    return detachments


def parse_faction_rules(soup):
    """Parse faction-wide rules (Battle Focus, Strands of Fate, etc.).

    After the Army-Rules anchor, faction rules are in BreakInsideAvoid divs
    before the first detachment div.
    """
    faction_rules = []

    army_anchor = soup.find('a', attrs={'name': 'Army-Rules'})
    if not army_anchor:
        return faction_rules

    # Walk siblings after Army-Rules anchor
    # Faction rules are in BreakInsideAvoid divs before the first detachment div
    # Each has a structure: h3 (rule name) + p/ul (rule text)
    el = army_anchor.next_sibling
    while el:
        if hasattr(el, 'name') and hasattr(el, 'get'):
            classes = el.get('class', [])

            # Stop when we hit the first detachment div
            if 'clFl' in classes and 'AEAE' in classes:
                break

            if el.name == 'div' and 'BreakInsideAvoid' in classes:
                # Check for h3 or bold rule name
                h3 = el.find('h3')
                if h3:
                    rule_name = clean_text(h3)
                    # Get non-fluff text content
                    parts = []
                    for child in el.children:
                        if hasattr(child, 'name') and hasattr(child, 'get'):
                            if child == h3:
                                continue
                            child_classes = child.get('class', [])
                            if 'ShowFluff' in child_classes:
                                continue
                            parts.append(clean_text(child))
                        elif isinstance(child, str) and child.strip():
                            parts.append(child.strip())
                    rule_text = ' '.join(p for p in parts if p).strip()
                    if rule_name and rule_text:
                        faction_rules.append({
                            'name': rule_name,
                            'text': rule_text,
                        })
        el = el.next_sibling

    return faction_rules


def main():
    print("Scraping Aeldari faction data...")
    soup = fetch_page(FACTION_URL)

    # Stratagems
    print("\nParsing stratagems...")
    stratagems = parse_stratagems(soup)
    print(f"  Found {len(stratagems)} stratagems")
    save_json(stratagems, 'stratagems.json')

    # Group by detachment for summary
    detach_counts = {}
    for s in stratagems:
        d = s['detachment'] or 'Unknown'
        detach_counts[d] = detach_counts.get(d, 0) + 1
    for d, c in sorted(detach_counts.items()):
        print(f"    {d}: {c} stratagems")

    # Enhancements
    print("\nParsing enhancements...")
    enhancements = parse_enhancements(soup)
    print(f"  Found {len(enhancements)} enhancements")
    save_json(enhancements, 'enhancements.json')

    # Detachment rules
    print("\nParsing detachment rules...")
    detachments = parse_detachment_rules(soup)
    print(f"  Found {len(detachments)} detachments")
    for d in detachments:
        print(f"    {d['name']}: {d['ruleName']}")
    save_json(detachments, 'detachments.json')

    # Faction rules
    print("\nParsing faction rules...")
    faction_rules = parse_faction_rules(soup)
    print(f"  Found {len(faction_rules)} faction rules")
    for r in faction_rules:
        print(f"    {r['name']}: {r['text'][:80]}...")
    save_json(faction_rules, 'faction-rules.json')


if __name__ == '__main__':
    main()
