"""Master orchestration script to scrape all Warhammer 40k 10th edition factions.

Iterates over all factions, calling existing parsers for each one.
Supports resuming — skips factions whose output directory already has all 5 files.
"""

import os
import shutil
import sys
from pathlib import Path

# Add scraper dir to path so we can import siblings
sys.path.insert(0, str(Path(__file__).parent))

from utils import DATA_DIR
from scrape_datasheets import main as scrape_datasheets
from scrape_faction_data import main as scrape_faction_data
from scrape_core_rules import main as scrape_core_rules

# All Warhammer 40k 10th edition factions (wahapedia URL slugs)
# Note: Black Templars, Blood Angels, Dark Angels, Deathwatch, and Space Wolves
# are all part of the Space Marines faction on wahapedia.
# "Agents of the Imperium" was renamed to "Imperial Agents".
FACTIONS = [
    "adepta-sororitas",
    "adeptus-custodes",
    "adeptus-mechanicus",
    "adeptus-titanicus",
    "aeldari",
    "astra-militarum",
    "chaos-daemons",
    "chaos-knights",
    "chaos-space-marines",
    "death-guard",
    "drukhari",
    "emperor-s-children",
    "genestealer-cults",
    "grey-knights",
    "imperial-agents",
    "imperial-knights",
    "leagues-of-votann",
    "necrons",
    "orks",
    "space-marines",
    "t-au-empire",
    "thousand-sons",
    "tyranids",
    "world-eaters",
]

EXPECTED_FILES = [
    "units.json",
    "stratagems.json",
    "enhancements.json",
    "detachments.json",
    "faction-rules.json",
]


def is_faction_complete(faction: str) -> bool:
    """Check if a faction's data directory has all expected files."""
    faction_dir = DATA_DIR / faction
    if not faction_dir.exists():
        return False
    return all((faction_dir / f).exists() for f in EXPECTED_FILES)


def migrate_existing_aeldari_data():
    """Move existing root-level Aeldari data into data/aeldari/ subdirectory."""
    aeldari_dir = DATA_DIR / "aeldari"
    migrated = False

    for filename in EXPECTED_FILES:
        src = DATA_DIR / filename
        if src.exists():
            aeldari_dir.mkdir(parents=True, exist_ok=True)
            dst = aeldari_dir / filename
            if not dst.exists():
                print(f"  Migrating {src} -> {dst}")
                shutil.move(str(src), str(dst))
                migrated = True

    if migrated:
        print("  Migrated existing Aeldari data to data/aeldari/")
    return migrated


def main():
    print("=" * 60)
    print("Warhammer 40k 10th Edition — Full Faction Scraper")
    print("=" * 60)

    # Step 1: Migrate existing Aeldari data if present at root
    print("\nChecking for existing root-level data to migrate...")
    migrate_existing_aeldari_data()

    # Step 2: Scrape all factions
    total = len(FACTIONS)
    completed = 0
    skipped = 0
    failed = []

    for i, faction in enumerate(FACTIONS, 1):
        print(f"\n{'=' * 60}")
        print(f"[{i}/{total}] {faction}")
        print("=" * 60)

        if is_faction_complete(faction):
            print(f"  Already complete — skipping")
            skipped += 1
            completed += 1
            continue

        try:
            # Scrape datasheets (units)
            print(f"\n--- Datasheets ---")
            scrape_datasheets(faction)

            # Scrape faction page (stratagems, enhancements, detachments, faction rules)
            print(f"\n--- Faction Data ---")
            scrape_faction_data(faction)

            completed += 1
            print(f"\n  {faction} complete!")

        except Exception as e:
            print(f"\n  ERROR scraping {faction}: {e}")
            failed.append((faction, str(e)))

    # Step 3: Scrape core rules
    print(f"\n{'=' * 60}")
    print("Core Rules")
    print("=" * 60)
    core_rules_file = DATA_DIR / "core-rules.json"
    if core_rules_file.exists():
        print("  Already exists — skipping")
    else:
        try:
            scrape_core_rules()
        except Exception as e:
            print(f"  ERROR scraping core rules: {e}")
            failed.append(("core-rules", str(e)))

    # Summary
    print(f"\n{'=' * 60}")
    print("SUMMARY")
    print("=" * 60)
    print(f"  Total factions: {total}")
    print(f"  Completed: {completed} ({skipped} skipped as already done)")
    print(f"  Failed: {len(failed)}")
    if failed:
        for name, err in failed:
            print(f"    - {name}: {err}")

    # Verify output
    print(f"\nData directory contents:")
    if DATA_DIR.exists():
        for item in sorted(DATA_DIR.iterdir()):
            if item.is_dir() and item.name != "index":
                files = list(item.iterdir())
                print(f"  {item.name}/ ({len(files)} files)")
        core = DATA_DIR / "core-rules.json"
        if core.exists():
            print(f"  core-rules.json")


if __name__ == "__main__":
    main()
