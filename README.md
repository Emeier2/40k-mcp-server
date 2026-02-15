# 40k MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that gives LLMs access to **all Warhammer 40,000 10th Edition** faction rules data for gameplay decisions and list building.

Built with TypeScript, local vector embeddings, and zero external API dependencies.

## Features

**5 MCP tools** for comprehensive 40k rules access across all factions:

| Tool | Description |
|------|-------------|
| `get_unit` | Full datasheet lookup with stats, weapons, abilities, points, and keywords. Supports fuzzy name matching and optional faction filtering. |
| `search_rules` | Semantic search (RAG) over all rules using vector embeddings. Ask natural language questions like "best anti-tank weapons" or "units that can deep strike". Filter by faction or rule type. |
| `list_stratagems` | Browse and filter stratagems by faction, detachment, type, or keyword. |
| `compare_units` | Side-by-side comparison of two units across stats, weapons, abilities, and points efficiency. Works across factions. |
| `validate_list` | Validate an army list against points limits and construction rules (EPIC HERO duplicates, valid unit sizes). |

**Data coverage:** 1,665 units, 1,469 stratagems, 776 enhancements, 189 detachments, 6 faction rules, and 7 core rule sections across 24 factions.

### Supported Factions

| Imperium | Chaos | Xenos |
|----------|-------|-------|
| Adepta Sororitas | Chaos Daemons | Aeldari |
| Adeptus Custodes | Chaos Knights | Drukhari |
| Adeptus Mechanicus | Chaos Space Marines | Genestealer Cults |
| Adeptus Titanicus | Death Guard | Leagues of Votann |
| Astra Militarum | Emperor's Children | Necrons |
| Grey Knights | Thousand Sons | Orks |
| Imperial Agents | World Eaters | T'au Empire |
| Imperial Knights | | Tyranids |
| Space Marines | | |

Space Marines includes all chapter-specific content (Black Templars, Blood Angels, Dark Angels, Deathwatch, Space Wolves).

## Architecture

```
MCP Client (Claude Desktop / Claude Code)
          |
          | stdio (JSON-RPC)
          v
    MCP Server (TypeScript)
    @modelcontextprotocol/sdk
          |
    +-----+------+
    |             |
Structured    Vector DB
  JSON         (Vectra)
 Lookups    Semantic Search
```

- **Structured tools** (`get_unit`, `list_stratagems`, `compare_units`, `validate_list`) do exact/filtered lookups against JSON data loaded at startup
- **Semantic search** (`search_rules`) embeds queries with a local transformer model and searches a pre-built vector index
- **Embeddings** are generated locally using `all-MiniLM-L6-v2` via `@huggingface/transformers` — no API keys needed
- **Vector store** uses [Vectra](https://github.com/Stevenic/vectra), a lightweight JS-native vector DB with JSON file storage

### Multi-Faction Data Loading

At startup, the server scans `data/` for faction subdirectories and loads all JSON files in parallel. Each faction's data is merged into a single `GameData` object with faction metadata preserved on every item.

### RAG Chunking Strategy

Game data is split into semantically meaningful chunks for accurate retrieval. Each chunk includes faction metadata for filtering:

| Chunk Type | Content |
|------------|---------|
| `unit_overview` | Name, stats, keywords, points, faction |
| `unit_weapons` | All weapon profiles with keywords |
| `unit_abilities` | Core, faction, and unique abilities |
| `unit_composition` | Model count, wargear options, leader info |
| `stratagem` | Full WHEN/TARGET/EFFECT text per stratagem |
| `enhancement` | Effect text, restrictions, points |
| `detachment_rule` | Detachment ability text |
| `faction_rule` | Faction-wide rules |
| `core_rule` | Core game rules (phases, concepts) |

Each chunk is prefixed with context (e.g., `[Unit: Fire Dragons] (aeldari) Weapons:`) so the embedding captures both the content and its source.

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Install & Build

```bash
git clone https://github.com/Emeier2/40k-mcp-server.git
cd 40k-mcp-server
npm install
npm run build
```

### Build the Vector Index

Required for the `search_rules` tool (first run downloads the embedding model, ~80MB):

```bash
npm run build-index
```

### Configure Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "wh40k": {
      "command": "node",
      "args": ["/absolute/path/to/40k-mcp-server/build/index.js"]
    }
  }
}
```

Then restart Claude Desktop. The tools will appear automatically.

### Configure Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "wh40k": {
      "command": "node",
      "args": ["/absolute/path/to/40k-mcp-server/build/index.js"]
    }
  }
}
```

## Example Interactions

**"What are Intercessors good at?"**
> Claude calls `get_unit("Intercessors", faction="space-marines")` and gets the full datasheet with stats, bolt rifle profiles, and abilities.

**"What stratagems can Death Guard use in the shooting phase?"**
> Claude calls `list_stratagems(faction="death-guard", keyword="shooting")` and gets filtered results.

**"Compare Wraithguard to Fire Dragons for anti-tank"**
> Claude calls `compare_units("Wraithguard", "Fire Dragons")` for a side-by-side comparison, then `search_rules("anti-tank weapons")` for additional context.

**"What are the core rules for the charge phase?"**
> Claude calls `search_rules("charge phase", type="core_rule")` to find the relevant core rules.

**"Is this 2000-point list legal?"**
> Claude calls `validate_list` with the unit list, checks points totals, flags any EPIC HERO duplicates or invalid unit sizes.

## Project Structure

```
40k-mcp-server/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── tools/
│   │   ├── get-unit.ts       # Unit datasheet lookup
│   │   ├── search-rules.ts   # RAG semantic search
│   │   ├── list-stratagems.ts# Stratagem filtering
│   │   ├── compare-units.ts  # Unit comparison
│   │   └── validate-list.ts  # Army list validation
│   ├── data/
│   │   ├── loader.ts         # Multi-faction JSON loader
│   │   └── types.ts          # TypeScript interfaces
│   ├── rag/
│   │   ├── embeddings.ts     # Local embedding generation
│   │   ├── vector-store.ts   # Vectra index wrapper
│   │   └── chunker.ts        # Intelligent data chunking
│   └── utils/
│       └── formatting.ts     # LLM-optimized output formatting
├── data/
│   ├── {faction}/            # Per-faction data directories
│   │   ├── units.json        # Unit datasheets
│   │   ├── stratagems.json   # Stratagems
│   │   ├── enhancements.json # Enhancements
│   │   ├── detachments.json  # Detachment rules
│   │   └── faction-rules.json# Faction-wide rules
│   ├── core-rules.json       # Core game rules
│   └── index/                # Vector search index
├── scraper/                  # Python scraping pipeline (offline)
│   ├── scrape_all.py         # Master orchestration (all factions)
│   ├── scrape_datasheets.py  # Unit datasheet scraper
│   ├── scrape_faction_data.py# Stratagems/enhancements/detachments
│   ├── scrape_core_rules.py  # Core rules scraper
│   └── utils.py              # Shared scraping utilities
└── scripts/
    └── build-index.ts        # Vector index builder
```

## Scraping Data

To re-scrape all faction data (requires Python 3.10+ with dependencies):

```bash
pip install -r scraper/requirements.txt
python scraper/scrape_all.py
```

The scraper supports resuming — it skips factions whose output directories already have all 5 files. To force a re-scrape of a specific faction, delete its directory under `data/`.

## Tech Stack

| Technology | Role |
|-----------|------|
| TypeScript | Server implementation |
| [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) | MCP server framework |
| [Vectra](https://github.com/Stevenic/vectra) | Local vector database (JS-native, JSON storage) |
| [@huggingface/transformers](https://huggingface.co/docs/transformers.js) | Local embedding model (`all-MiniLM-L6-v2`) |
| [Zod](https://zod.dev) | Tool input schema validation |
| Python / BeautifulSoup | Offline data scraping |

## Data Sources

Game data is scraped from [Wahapedia](https://wahapedia.ru/) and committed as structured JSON. The scraper is an offline tool — users don't need Python or network access to run the MCP server.

Warhammer 40,000 rules and army data are the intellectual property of Games Workshop. This project is a fan-made tool for personal use.

## License

MIT
