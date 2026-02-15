# 40k MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that gives LLMs access to Warhammer 40,000 Aeldari/Eldar rules data for gameplay decisions and list building.

Built with TypeScript, local vector embeddings, and zero external API dependencies.

## Features

**5 MCP tools** for comprehensive Aeldari rules access:

| Tool | Description |
|------|-------------|
| `get_unit` | Full datasheet lookup with stats, weapons, abilities, points, and keywords. Supports fuzzy name matching. |
| `search_rules` | Semantic search (RAG) over all rules using vector embeddings. Ask natural language questions like "best anti-tank weapons" or "units that can deep strike". |
| `list_stratagems` | Browse and filter stratagems by detachment, type, or keyword. |
| `compare_units` | Side-by-side comparison of two units across stats, weapons, abilities, and points efficiency. |
| `validate_list` | Validate an army list against points limits and construction rules (EPIC HERO duplicates, valid unit sizes). |

**Data coverage:** 97 unit datasheets, 98 stratagems, 49 enhancements, 12 detachments, 3 faction rules.

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
- **Semantic search** (`search_rules`) embeds queries with a local transformer model and searches a pre-built vector index of 549 chunks
- **Embeddings** are generated locally using `all-MiniLM-L6-v2` via `@huggingface/transformers` — no API keys needed
- **Vector store** uses [Vectra](https://github.com/Stevenic/vectra), a lightweight JS-native vector DB with JSON file storage

### RAG Chunking Strategy

Game data is split into semantically meaningful chunks for accurate retrieval:

| Chunk Type | Count | Content |
|------------|-------|---------|
| `unit_overview` | 97 | Name, stats, keywords, points |
| `unit_weapons` | 95 | All weapon profiles with keywords |
| `unit_abilities` | 97 | Core, faction, and unique abilities |
| `unit_composition` | 97 | Model count, wargear options, leader info |
| `stratagem` | 98 | Full WHEN/TARGET/EFFECT text per stratagem |
| `enhancement` | 49 | Effect text, restrictions, points |
| `detachment_rule` | 12 | Detachment ability text |
| `faction_rule` | 3 | Faction-wide rules (Strands of Fate, etc.) |

Each chunk is prefixed with context (e.g., `[Unit: Fire Dragons] Weapons:`) so the embedding captures both the content and its source.

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Install & Build

```bash
git clone https://github.com/YOUR_USERNAME/40k-mcp-server.git
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

**"What are Fire Dragons good at?"**
> Claude calls `get_unit("Fire Dragons")` and gets the full datasheet with stats, melta weapons (S9 AP-4 Dd6 with Melta 3/6), and the Assured Destruction ability for re-rolling hits/wounds/damage against MONSTER and VEHICLE targets.

**"What stratagems can I use in the shooting phase with Warhost?"**
> Claude calls `list_stratagems(detachment="Warhost", keyword="shooting")` and gets filtered results including Blitzing Firepower (Sustained Hits 1 within 12").

**"Compare Wraithguard to Fire Dragons for anti-tank"**
> Claude calls `compare_units("Wraithguard", "Fire Dragons")` for a side-by-side comparison, then `search_rules("anti-tank weapons")` for additional context on which performs better.

**"Is this 1000-point list legal?"**
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
│   │   ├── loader.ts         # JSON data loader
│   │   └── types.ts          # TypeScript interfaces
│   ├── rag/
│   │   ├── embeddings.ts     # Local embedding generation
│   │   ├── vector-store.ts   # Vectra index wrapper
│   │   └── chunker.ts        # Intelligent data chunking
│   └── utils/
│       └── formatting.ts     # LLM-optimized output formatting
├── data/
│   ├── units.json            # 97 Aeldari unit datasheets
│   ├── stratagems.json       # 98 stratagems across 18 detachments
│   ├── enhancements.json     # 49 enhancements
│   ├── detachments.json      # 12 detachment rules
│   └── faction-rules.json    # 3 faction-wide rules
├── scraper/                  # Python scraping pipeline (offline)
│   ├── scrape_datasheets.py
│   ├── scrape_faction_data.py
│   └── utils.py
└── scripts/
    └── build-index.ts        # Vector index builder
```

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
