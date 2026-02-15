"""Scrape unit datasheets from wahapedia for any faction."""

import re
import json
from utils import fetch_page, clean_text, save_json


def parse_weapon_keywords(name_span):
    """Extract weapon name and keywords from a weapon name span."""
    # The weapon name is the direct text, keywords are in kwb2/kwbw spans
    name_parts = []
    keywords = []

    for child in name_span.children:
        if hasattr(child, 'name') and child.name == 'span':
            cls = child.get('class', [])
            if 'kwb2' in cls or 'kwbw' in cls:
                # These are weapon keywords like "sustained hits d3"
                kw_text = clean_text(child)
                if kw_text:
                    keywords.append(kw_text)
            else:
                name_parts.append(clean_text(child))
        elif isinstance(child, str):
            text = child.strip()
            if text:
                name_parts.append(text)

    name = ' '.join(name_parts).strip()
    return name, keywords


def parse_weapons_table(wtable):
    """Parse the weapons table to extract all weapons."""
    ranged_weapons = []
    melee_weapons = []
    current_type = None  # 'ranged' or 'melee'

    tbodies = wtable.find_all('tbody')

    for tbody in tbodies:
        rows = tbody.find_all('tr')
        for row in rows:
            # Check if this is a header row (RANGED WEAPONS / MELEE WEAPONS)
            header_div = row.find('div', class_='dsHeader')
            if header_div:
                header_text = clean_text(header_div)
                if 'RANGED' in header_text:
                    current_type = 'ranged'
                elif 'MELEE' in header_text:
                    current_type = 'melee'
                continue

            # Check if this is a weapon name row (wTable2_long class)
            if 'wTable2_long' in row.get('class', []):
                # Skip the long name rows - data is in the short rows
                continue

            # Check for stat row (has wTable2_short or stat cells)
            cells = row.find_all('td')
            if len(cells) >= 7:
                # This is a stat row
                # Cell 0: empty or pointy icon
                # Cell 1: weapon name (in wTable2_short)
                # Cells 2-7: Range, A, BS/WS, S, AP, D

                name_cell = cells[1]
                name_span = name_cell.find('span')
                if name_span:
                    weapon_name, weapon_keywords = parse_weapon_keywords(name_span)
                else:
                    weapon_name = clean_text(name_cell)
                    weapon_keywords = []

                if not weapon_name:
                    continue

                # Extract stat values
                stats = []
                for cell in cells[2:8]:
                    div = cell.find('div', class_='ct')
                    if div:
                        stats.append(clean_text(div))
                    else:
                        stats.append(clean_text(cell))

                if len(stats) >= 6:
                    weapon = {
                        'name': weapon_name,
                        'range': stats[0],
                        'A': stats[1],
                        'S': stats[3],
                        'AP': stats[4],
                        'D': stats[5],
                        'keywords': weapon_keywords,
                    }

                    if current_type == 'ranged':
                        weapon['BS'] = stats[2]
                        ranged_weapons.append(weapon)
                    elif current_type == 'melee':
                        weapon['WS'] = stats[2]
                        melee_weapons.append(weapon)

    return ranged_weapons, melee_weapons


def parse_abilities(right_col):
    """Parse abilities from the right column of the datasheet."""
    faction_abilities = []
    core_abilities = []
    unit_abilities = []
    composition_text = ""
    points = []
    leader_info = None
    leader_attachable_to = None
    damaged_text = None

    current_section = "abilities"
    dsAbilities = right_col.find_all('div', class_='dsAbility')

    for ab in dsAbilities:
        text = clean_text(ab)

        # Check if the preceding header indicates the section
        prev_header = ab.find_previous_sibling('div', class_='dsHeader')
        if prev_header:
            header_text = clean_text(prev_header)
            if 'UNIT COMPOSITION' in header_text:
                current_section = 'composition'
            elif 'DAMAGED' in header_text:
                current_section = 'damaged'
            elif 'LEADER' in header_text:
                current_section = 'leader'
            elif 'ABILITIES' in header_text:
                current_section = 'abilities'
            elif 'WARGEAR' in header_text:
                current_section = 'wargear'

        if current_section == 'abilities':
            if text.startswith('CORE:'):
                core_text = text[5:].strip()
                core_abilities.extend([a.strip() for a in core_text.split(',') if a.strip()])
            elif text.startswith('FACTION:'):
                faction_text = text[8:].strip()
                faction_abilities.extend([a.strip() for a in faction_text.split(',') if a.strip()])
            else:
                # Unit-specific abilities
                # Try to extract ability name and description
                bold = ab.find('b')
                if bold:
                    # Could have multiple abilities in one div separated by dsLineHor
                    # Parse each bold as a separate ability
                    bolds = ab.find_all('b')
                    for b in bolds:
                        ab_name = clean_text(b).rstrip(':')
                        # Get text after this bold until next bold or end
                        ab_desc_parts = []
                        sibling = b.next_sibling
                        while sibling:
                            if hasattr(sibling, 'name') and hasattr(sibling, 'get'):
                                if sibling.name == 'b':
                                    break
                                if sibling.get('class') and 'dsLineHor' in sibling.get('class', []):
                                    break
                                ab_desc_parts.append(clean_text(sibling))
                            elif isinstance(sibling, str):
                                ab_desc_parts.append(sibling.strip())
                            sibling = sibling.next_sibling
                        ab_desc = ' '.join(ab_desc_parts).strip()
                        if ab_name and ab_desc:
                            unit_abilities.append({
                                'name': ab_name,
                                'description': ab_desc,
                            })

        elif current_section == 'composition':
            # Check for points cost table
            price_tag = ab.find(class_='PriceTag')
            if price_tag:
                pts_text = clean_text(price_tag)
                # Get model count from the other cell
                table = ab.find('table')
                if table:
                    rows = table.find_all('tr')
                    for row in rows:
                        tds = row.find_all('td')
                        if len(tds) >= 2:
                            model_text = clean_text(tds[0])
                            pt = clean_text(tds[1].find(class_='PriceTag') or tds[1])
                            # Extract number of models
                            model_match = re.search(r'(\d+)\s*model', model_text)
                            models = int(model_match.group(1)) if model_match else 1
                            # Extract points
                            pt_match = re.search(r'(\d+)', pt)
                            if pt_match:
                                points.append({
                                    'models': models,
                                    'points': int(pt_match.group(1)),
                                })
            else:
                if not composition_text:
                    composition_text = text

        elif current_section == 'damaged':
            damaged_text = text

        elif current_section == 'leader':
            # "This model can be attached to the following unit: X, Y"
            if 'attached to' in text.lower():
                # Extract unit names after the colon
                parts = text.split(':')
                if len(parts) > 1:
                    units_text = parts[-1].strip()
                    leader_attachable_to = [u.strip() for u in units_text.split(',') if u.strip()]

    # Also look for dsAbility_noLine for leader text
    for ab in right_col.find_all('div', class_='dsAbility_noLine'):
        text = clean_text(ab)
        if 'attached to' in text.lower():
            parts = text.split(':')
            if len(parts) > 1:
                units_text = parts[-1].strip()
                leader_attachable_to = [u.strip() for u in units_text.split(',') if u.strip()]

    return {
        'faction': faction_abilities,
        'core': core_abilities,
        'unit': unit_abilities,
    }, composition_text, points, leader_attachable_to, damaged_text


def parse_keywords(kw_div):
    """Parse keywords from the ds2colKW div."""
    keywords = []
    faction_keywords = []

    left_kw = kw_div.find(class_=lambda c: c and 'dsLeft' in c)
    right_kw = kw_div.find(class_=lambda c: c and 'dsRight' in c)

    if left_kw:
        text = clean_text(left_kw)
        # Remove "KEYWORDS:" prefix
        text = re.sub(r'^KEYWORDS:\s*', '', text)
        # Split by commas, handling multi-word keywords
        raw_keywords = text.split(',')
        keywords = [kw.strip() for kw in raw_keywords if kw.strip()]

    if right_kw:
        text = clean_text(right_kw)
        text = re.sub(r'^FACTION\s*KEYWORDS:\s*', '', text)
        raw_keywords = text.split(',')
        faction_keywords = [kw.strip() for kw in raw_keywords if kw.strip()]

    return keywords, faction_keywords


def determine_unit_category(keywords):
    """Determine unit category from keywords."""
    kw_upper = [k.upper() for k in keywords]
    if 'EPIC HERO' in ' '.join(kw_upper):
        return 'Epic Hero'
    if 'CHARACTER' in kw_upper:
        return 'Character'
    if 'BATTLELINE' in kw_upper:
        return 'Battleline'
    if 'VEHICLE' in kw_upper:
        return 'Vehicle'
    if 'MONSTER' in kw_upper:
        return 'Monster'
    if 'FORTIFICATION' in kw_upper:
        return 'Fortification'
    return 'Other'


def parse_datasheet(ds_div, faction_name='aeldari'):
    """Parse a single datasheet div into structured data."""
    # Unit name
    header = ds_div.find(class_='dsH2Header')
    if not header:
        return None
    name_div = header.find('div')
    if not name_div:
        return None
    unit_name = clean_text(name_div).strip()
    if not unit_name:
        return None

    # Stats
    stats = {}
    stat_order = ['M', 'T', 'Sv', 'W', 'Ld', 'OC']
    char_wraps = ds_div.find_all(class_='dsCharWrap')
    for wrap in char_wraps:
        name_el = wrap.find(class_='dsCharName')
        value_el = wrap.find(class_='dsCharValue')
        if name_el and value_el:
            stat_name = clean_text(name_el)
            stat_value = clean_text(value_el)
            if stat_name in stat_order:
                # Convert numeric stats
                if stat_name in ['T', 'W', 'OC']:
                    try:
                        stats[stat_name] = int(stat_value)
                    except ValueError:
                        stats[stat_name] = stat_value
                else:
                    stats[stat_name] = stat_value

    # Invulnerable save
    invul_el = ds_div.find(class_='dsCharInvulValue')
    invul_save = clean_text(invul_el) if invul_el else None

    # Weapons
    wtable = ds_div.find('table', class_='wTable')
    ranged_weapons = []
    melee_weapons = []
    if wtable:
        ranged_weapons, melee_weapons = parse_weapons_table(wtable)

    # Abilities, composition, points
    right_col = ds_div.find(class_=lambda c: c and 'dsRight' in c and 'KW' not in c)
    abilities = {'faction': [], 'core': [], 'unit': []}
    composition_text = ""
    points_list = []
    leader_attachable_to = None
    damaged_text = None

    if right_col:
        abilities, composition_text, points_list, leader_attachable_to, damaged_text = parse_abilities(right_col)

    # If no points found from right col, look for PriceTag anywhere in datasheet
    if not points_list:
        price_tags = ds_div.find_all(class_='PriceTag')
        for pt in price_tags:
            pt_text = clean_text(pt)
            pt_match = re.search(r'(\d+)', pt_text)
            if pt_match:
                points_list.append({
                    'models': 1,
                    'points': int(pt_match.group(1)),
                })

    # Keywords
    kw_div = ds_div.find(class_='ds2colKW')
    keywords = []
    faction_keywords = []
    if kw_div:
        keywords, faction_keywords = parse_keywords(kw_div)

    # Determine category
    unit_category = determine_unit_category(keywords)

    # Leader ability
    leader = None
    if 'Leader' in abilities.get('core', []) or 'LEADER' in [k.upper() for k in abilities.get('core', [])]:
        # Find leader-specific abilities
        for ab in abilities['unit']:
            if 'while this model is leading' in ab['description'].lower():
                leader = ab
                break

    # Composition parsing
    comp_min = 1
    comp_max = 1
    comp_match = re.search(r'(\d+)[-–](\d+)', composition_text)
    if comp_match:
        comp_min = int(comp_match.group(1))
        comp_max = int(comp_match.group(2))
    else:
        model_match = re.search(r'(\d+)', composition_text)
        if model_match:
            comp_min = int(model_match.group(1))
            comp_max = comp_min

    return {
        'name': unit_name,
        'faction': faction_name,
        'keywords': keywords,
        'factionKeywords': faction_keywords,
        'stats': stats,
        'invulnerableSave': invul_save,
        'rangedWeapons': ranged_weapons,
        'meleeWeapons': melee_weapons,
        'abilities': abilities,
        'composition': {
            'min': comp_min,
            'max': comp_max,
            'description': composition_text,
        },
        'points': points_list,
        'leader': leader,
        'leaderAttachableTo': leader_attachable_to,
        'unitCategory': unit_category,
    }


def main(faction='aeldari'):
    url = f"/wh40k10ed/factions/{faction}/datasheets.html"
    print(f"Scraping {faction} datasheets...")
    soup = fetch_page(url)

    datasheets = soup.find_all(class_='datasheet')
    print(f"Found {len(datasheets)} datasheets")

    units = []
    for ds in datasheets:
        unit = parse_datasheet(ds, faction_name=faction)
        if unit:
            units.append(unit)
            print(f"  Parsed: {unit['name']} ({len(unit['rangedWeapons'])}R/{len(unit['meleeWeapons'])}M weapons, {len(unit['points'])} point options)")
        else:
            print(f"  Skipped a datasheet (no name found)")

    print(f"\nTotal units parsed: {len(units)}")
    save_json(units, 'units.json', subdir=faction)
    return units


if __name__ == '__main__':
    import sys
    faction = sys.argv[1] if len(sys.argv) > 1 else 'aeldari'
    main(faction)
