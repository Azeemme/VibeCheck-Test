<p align="center">
  <h1 align="center">VibeCheck</h1>
  <p align="center">
    <strong>AI-powered security scanning for vibe-coded applications</strong>
  </p>
  <p align="center">
    <a href="https://vibechecker.aedify.ai"><strong>Live API</strong></a> · 
    <a href="https://vibechecker.aedify.ai/docs.html"><strong>API Docs</strong></a> · 
    <a href="https://vibechecker.aedify.ai/docs"><strong>OpenAPI</strong></a> · 
    <a href="https://vibechecker.aedify.ai"><strong>Dashboard</strong></a> · 
    <a href="https://github.com/rajendrathalluru/vibecheck1/tree/main/mcp_server"><strong>MCP Server</strong></a>
  </p>
</p>

---

## What is VibeCheck?

VibeCheck is a public HTTP API that security-scans vibe-coded apps in **two modes**:

- **Lightweight mode** — Statically analyzes a GitHub repo or uploaded files for vulnerable dependencies, insecure code patterns, hardcoded secrets, and configuration issues using five scanning modules plus optional Gemini AI contextual review.

- **Robust mode** — Red-teams any running app with four Gemini-powered AI agents that send real HTTP probes and report confirmed vulnerabilities with evidence. Works with any reachable URL — deployed sites, Cloudflare Tunnels, ngrok, or localhost via the built-in WebSocket tunnel.

No authentication required. Just `curl` and go.

---

## Key Features

| | Feature | Description |
|---|---|---|
|  | **5 Static Scanners** | Dependency, pattern, secret, config, and Gemini contextual analysis |
|  | **4 AI Red-Team Agents** | Recon, auth, injection, and config agents powered by Gemini function calling |
|  | **18 REST + WebSocket Endpoints** | Full CRUD, live status streaming, paginated results, text search |
|  | **Built-in Reverse Tunnel** | Scan localhost apps without ngrok or Cloudflare — just `vibecheck connect 3000` |
|  | **AI Finding Analysis** | Gemini-powered root cause analysis, impact assessment, and fix plans for any finding |
|  | **Semantic Memory Search** | Supermemory-powered RAG to find similar historical vulnerabilities |
|  | **MCP IDE Integration** | Use VibeCheck tools directly from Cursor or VS Code chat |
|  | **Security Dashboard** | Charts, filters, export, real-time WebSocket updates |
|  | **Interactive API Docs** | Full endpoint reference with "Try It" panels at [`/docs.html`](https://vibechecker.aedify.ai/docs.html) |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  VibeCheck API (Public)                                      │
│                                                              │
│  ┌─────────────┐  ┌───────────────┐  ┌────────────────────┐  │
│  │ Lightweight │  │    Robust     │  │  Frontend Dashboard│  │
│  │  Scanner    │  │   Scanner     │  │  (served at /)     │  │
│  │ (5 modules) │  │ (4 AI agents) │  └────────────────────┘  │
│  └─────────────┘  └───────┬───────┘                          │
│                           │                                  │
│  ┌──────────────────────┐ │  ┌───────────┐  ┌─────────────┐  │
│  │  SQLite / Postgres   │ │  │ Supermemory│ │   Gemini    │  │
│  └──────────────────────┘ │  └───────────┘  └─────────────┘  │
│                           │                                  │
│  ┌────────────────────────▼──────────────────────────────┐   │
│  │  WebSocket Tunnel Proxy (/v1/tunnel)                  │   │
│  └────────────────────────┬──────────────────────────────┘   │
└───────────────────────────┼──────────────────────────────────┘
                            │ WebSocket
┌───────────────────────────▼──────────────────────────────────┐
│  Developer's Machine                                         │
│                                                              │
│  ┌─────────────────────┐    ┌──────────────────────────────┐ │
│  │ vibecheck connect   │───▶│  User's App (localhost:3000)│ │
│  │ (tunnel client)     │    └──────────────────────────────┘ │
│  └─────────────────────┘                                     │
└──────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Check API health

```bash
curl https://vibechecker.aedify.ai/v1/health
```

### 2. Scan a GitHub repo

```bash
curl -X POST "https://vibechecker.aedify.ai/v1/assessments" \
  -H "Content-Type: application/json" \
  -d '{"mode": "lightweight", "repo_url": "https://github.com/user/my-app"}'
```

Returns `202 Accepted` with an assessment ID (e.g. `asm_a1b2c3d4e5f6`).

### 3. Get findings

Poll until `status` is `complete`, then fetch results:

```bash
# Check status
curl "https://vibechecker.aedify.ai/v1/assessments/asm_ID"

# Get findings
curl "https://vibechecker.aedify.ai/v1/assessments/asm_ID/findings"

# AI-powered deep analysis of any finding
curl -X POST "https://vibechecker.aedify.ai/v1/assessments/asm_ID/findings/fnd_ID/analyze" \
  -H "Content-Type: application/json" \
  -d '{"focus": "how to fix this in Express"}'
```

> **Full API reference** with interactive "Try It" panels: [**docs.html**](https://vibechecker.aedify.ai/docs.html)

---

## Robust Mode — Red-Team a Live App

Pass any URL the API can reach as `target_url`:

```bash
curl -X POST "https://vibechecker.aedify.ai/v1/assessments" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "robust",
    "target_url": "https://my-app.example.com",
    "agents": ["recon", "auth", "injection", "config"],
    "depth": "standard"
  }'
```

### Exposing a local app

| Method | Setup | Best for |
|---|---|---|
| **Direct URL** | None | Already-deployed apps |
| **Cloudflare Tunnel** | `cloudflared tunnel --url http://localhost:3000` | Quick local exposure, no account needed |
| **ngrok** | `ngrok http 3000` | Popular, well-documented |
| **VS Code / Cursor** | Built-in port forwarding | IDE-native workflow |
| **VibeCheck tunnel** | `vibecheck connect 3000 --server wss://...` | Zero external dependencies |

All methods produce a URL that works as `target_url`. See the [interactive docs](https://vibechecker.aedify.ai/docs.html) for full details.

---

## IDE Integration (MCP)

Add VibeCheck to Cursor or VS Code by adding this to your `mcp.json`:

```json
{
  "mcpServers": {
    "vibecheck-remote": {
      "url": "https://vibecheckmcp.aedify.ai/mcp"
    }
  }
}
```

Then add a `.cursorrules` file to your project root so your IDE agent uses VibeCheck automatically:

```
# Security Scanning with VibeCheck

You have access to the VibeCheck MCP server for AI-powered security scanning.

## When to use VibeCheck
- Before committing code: run a lightweight scan on the current repo
- When reviewing PRs: scan changed files for vulnerabilities
- When the user asks about security: scan and analyze findings
- After adding dependencies: check for known vulnerabilities

## How to use
1. Use the `create_assessment` tool with mode "lightweight" and the repo URL or file contents
2. Poll the assessment status until complete
3. Use `list_findings` to see all discovered vulnerabilities
4. Use `analyze_finding` on critical/high findings for AI-powered remediation advice
```

**MCP tools:** `health`, `list_agents`, `create_assessment`, `list_assessments`, `get_assessment`, `rerun_assessment`, `list_findings`, `analyze_finding`, `list_tunnel_sessions`, `memory_search`

See [`mcp_server/README.md`](mcp_server/README.md) for setup details.

---

## Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| API framework | **FastAPI** (Python 3.11+) | Async HTTP + WebSocket, auto-generated OpenAPI docs |
| AI agents | **Google Gemini** (gemini-2.5-flash) | Function-calling agents for robust red-teaming |
| Static analysis | Regex + entropy heuristics + Gemini | Fast pattern matching plus intelligent code review |
| Database | **SQLite** / **Postgres** | Zero-config dev, swap to Postgres for production |
| ORM | **SQLAlchemy 2.x** (async) | Async sessions, declarative models |
| Validation | **Pydantic v2** | Request/response schemas, environment config |
| HTTP client | **httpx** | Async HTTP for agent probes and tunnel proxy |
| Memory / RAG | **Supermemory** | Semantic search across historical findings |
| Frontend | Vanilla HTML/CSS/JS | Dashboard with charts, filters, real-time updates |
| MCP server | **FastMCP** | IDE integration for Cursor and other MCP clients |
| Deployment | **Docker** | Single-container deployment |

---

## Project Structure

```
vibecheck1/
├── README.md
├── Dockerfile                       # Main API container
├── Dockerfile.mcp                   # MCP server container
│
├── vibecheck/
│   ├── pyproject.toml               # Dependencies + test extras
│   ├── api/
│   │   ├── main.py                  # FastAPI app, middleware, routers
│   │   ├── config.py                # pydantic-settings (env vars)
│   │   ├── database.py              # Async SQLAlchemy engine
│   │   ├── models/                  # SQLAlchemy ORM models
│   │   ├── schemas/                 # Pydantic request/response models
│   │   ├── routers/                 # FastAPI route handlers
│   │   ├── services/               # Business logic + scanner modules
│   │   ├── agents/                  # Gemini-powered red-team agents
│   │   └── utils/                   # ID generation, pagination, errors
│   ├── client/                      # Tunnel client (pip installable)
│   └── tests/                       # pytest + pytest-asyncio suite
│
├── frontend/
│   ├── index.html                   # Security dashboard
│   ├── docs.html                    # Interactive API documentation
│   ├── app.js / docs.js             # Dashboard + docs logic
│   └── styles.css / docs.css        # Styling
│
└── mcp_server/
    ├── vibecheck_mcp_server.py      # MCP server (10 tools)
    └── README.md                    # MCP setup guide
```

---

## Getting Started (Local Development)

### Requirements

- Python **3.11+**
- `git` on your `PATH` (for lightweight scans that clone repos)

### Installation

```bash
cd vibecheck
python -m pip install -e "."
```

### Running the API

```bash
cd vibecheck
python -m uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
```

Then open: **Dashboard** → http://localhost:8000/ · **Swagger** → http://localhost:8000/docs · **API Docs** → http://localhost:8000/docs.html

### Running Tests

```bash
cd vibecheck
python -m pip install -e ".[test]"
python -m pytest tests/ -v
```

**21 tests** covering health, assessments (CRUD, pagination, filtering, idempotency, rerun), and findings (list, filter, search, pagination).

---

## Configuration

All settings are managed via environment variables (loaded from `.env`):

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./vibecheck.db` | SQLAlchemy async database URL |
| `GEMINI_API_KEY` | `""` | Google Gemini API key (required for robust mode + AI analysis) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model to use |
| `SUPERMEMORY_API_KEY` | `""` | Supermemory API key (optional, enables memory search) |
| `SUPERMEMORY_BASE_URL` | `https://api.supermemory.ai` | Supermemory endpoint |
| `SUPERMEMORY_TIMEOUT_SECONDS` | `10.0` | Supermemory request timeout |
| `CLONE_DIR` | `/tmp/vibecheck-repos` | Directory for cloned repos |
| `DEBUG` | `false` | Enable SQLAlchemy query logging |

---

<p align="center">
  <strong>Built for <a href="https://hackillinois.org">HackIllinois 2026</a> — Stripe Track: Best Web API</strong>
</p>
