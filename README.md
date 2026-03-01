VibeCheck API
=============

AI-powered security scanning for vibe-coded applications. VibeCheck exposes a public HTTP API, a WebSocket reverse tunnel, and a security dashboard that can:

- **Lightweight mode** — statically analyze a GitHub repo or uploaded files for vulnerable dependencies, insecure code patterns, hardcoded secrets, and config issues.
- **Robust mode** — red-team any running app (deployed URL, Cloudflare Tunnel, ngrok, or localhost via built-in tunnel) with AI agents that send real HTTP probes and report confirmed vulnerabilities with evidence.

**Live instance:** <https://vibecheck-test-1beb2409.aedify.ai>
**Dashboard:** <https://vibecheck-test-1beb2409.aedify.ai>
**OpenAPI docs:** <https://vibecheck-test-1beb2409.aedify.ai/docs>

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
  - [Health](#health)
  - [Assessments](#assessments)
  - [Findings](#findings)
  - [Finding Analysis](#finding-analysis)
  - [Agent Logs](#agent-logs)
  - [Agents](#agents)
  - [Tunnel](#tunnel)
  - [Memory](#memory)
- [Error Handling](#error-handling)
- [Lightweight Scanning Engine](#lightweight-scanning-engine)
- [Robust Scanning Engine](#robust-scanning-engine)
- [Usage Examples](#usage-examples)
- [Frontend Dashboard](#frontend-dashboard)
- [MCP Server (IDE Integration)](#mcp-server-ide-integration)
- [Tunnel Client](#tunnel-client)
- [Tests](#tests)
- [Project Structure](#project-structure)
- [Configuration](#configuration)

---

## Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| API framework | **FastAPI** (Python 3.11+) | Async HTTP + WebSocket, auto-generated OpenAPI docs |
| AI agents | **Google Gemini** (gemini-2.5-flash) | Function-calling agents for robust red-teaming and contextual analysis |
| Static analysis | Regex + entropy heuristics + Gemini contextual review | Fast pattern matching plus intelligent code review |
| Database | **SQLite** (aiosqlite) / **Postgres** (asyncpg) | Zero-config dev, swap to Postgres for production |
| ORM | **SQLAlchemy 2.x** (async) | Async sessions, declarative models |
| Validation | **Pydantic v2** + **pydantic-settings** | Request/response schemas, environment config |
| HTTP client | **httpx** | Async HTTP for agent probes and tunnel proxy |
| Memory / RAG | **Supermemory** | Semantic search across historical findings |
| WebSocket tunnel | FastAPI WebSocket + Python client | Built-in reverse tunnel, no third-party dependencies |
| Frontend | Vanilla HTML/CSS/JS | Dashboard with charts, filters, real-time updates |
| MCP server | **FastMCP** | IDE integration for Cursor and other MCP clients |
| Deployment | **Docker** | Single-container deployment |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  VibeCheck API (Public)                                       │
│                                                               │
│  ┌─────────────┐  ┌───────────────┐  ┌────────────────────┐ │
│  │ Lightweight  │  │    Robust     │  │  Frontend Dashboard│ │
│  │  Scanner     │  │   Scanner     │  │  (served at /)     │ │
│  │ (5 modules)  │  │ (4 AI agents) │  └────────────────────┘ │
│  └─────────────┘  └───────┬───────┘                          │
│                           │                                   │
│  ┌──────────────────────┐ │  ┌───────────┐  ┌─────────────┐ │
│  │  SQLite / Postgres   │ │  │ Supermemory│  │   Gemini    │ │
│  └──────────────────────┘ │  └───────────┘  └─────────────┘ │
│                           │                                   │
│  ┌────────────────────────▼──────────────────────────────┐   │
│  │  WebSocket Tunnel Proxy (/v1/tunnel)                   │   │
│  └────────────────────────┬──────────────────────────────┘   │
└───────────────────────────┼──────────────────────────────────┘
                            │ WebSocket
┌───────────────────────────▼──────────────────────────────────┐
│  Developer's Machine                                          │
│                                                               │
│  ┌─────────────────────┐    ┌──────────────────────────────┐ │
│  │ vibecheck connect   │───▶│  User's App (localhost:3000) │ │
│  │ (tunnel client)     │    └──────────────────────────────┘ │
│  └─────────────────────┘                                      │
└──────────────────────────────────────────────────────────────┘
```

**Lightweight mode** clones a GitHub repo (or accepts uploaded files), runs five static analysis modules, persists findings, and optionally enriches results with Gemini contextual analysis.

**Robust mode** uses four Gemini-powered AI agents that send real HTTP requests to any reachable target URL — a deployed site, a Cloudflare Tunnel, ngrok, or a local app exposed through the built-in `vibecheck connect` WebSocket tunnel.

---

## Getting Started

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

Then open:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **Dashboard:** http://localhost:8000/

### Running Tests

```bash
cd vibecheck
python -m pip install -e ".[test]"
python -m pytest tests/ -v
```

---

## API Reference

All endpoints are versioned under `/v1`. The API returns JSON and accepts JSON request bodies.

### Health

#### `GET /v1/health`

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "active_tunnels": 0,
  "agents_available": true
}
```

---

### Assessments

#### `POST /v1/assessments` — Create assessment

**Status:** `202 Accepted`

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `mode` | `"lightweight"` \| `"robust"` | yes | — | |
| `repo_url` | string | conditional | — | Required for lightweight if `files` is not provided |
| `files` | `[{path, content}]` | conditional | — | Required for lightweight if `repo_url` is not provided |
| `target_url` | string | conditional | — | Required for robust — any reachable URL (deployed site, Cloudflare Tunnel, ngrok, etc.) |
| `tunnel_session_id` | string | no | — | Optional — only needed when using the built-in VibeCheck tunnel client |
| `agents` | string[] | no | `["recon","auth","injection","config"]` | Robust only |
| `depth` | `"quick"` \| `"standard"` \| `"deep"` | no | `"standard"` | Controls agent step limits |
| `idempotency_key` | string | no | — | Prevents duplicate scans |

**Response:**

```json
{
  "id": "asm_a1b2c3d4e5f6",
  "mode": "lightweight",
  "status": "queued",
  "repo_url": "https://github.com/user/repo",
  "finding_counts": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0, "total": 0},
  "created_at": "2026-02-28T12:00:00Z",
  "links": {
    "self": "/v1/assessments/asm_a1b2c3d4e5f6",
    "findings": "/v1/assessments/asm_a1b2c3d4e5f6/findings",
    "logs": "/v1/assessments/asm_a1b2c3d4e5f6/logs"
  }
}
```

#### `GET /v1/assessments` — List assessments

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | int | 1 | Page number |
| `per_page` | int | 20 | Items per page (max 100) |
| `mode` | string | — | Filter by `lightweight` or `robust` |
| `status` | string | — | Filter by status |
| `sort` | string | `-created_at` | Prefix `-` for descending |

Returns `{data: [...], pagination: {page, per_page, total, total_pages}}`.

#### `GET /v1/assessments/{id}` — Get assessment

Returns full assessment details. Status progresses through: `queued` → `cloning` → `analyzing` → `scanning` → `complete` (or `failed`).

#### `WebSocket /v1/assessments/{id}/ws` — Live status stream

Connect via WebSocket to receive real-time status updates. The server sends `assessment_update` messages every ~2 seconds when the status changes, and an `assessment_terminal` message when the scan completes or fails, then closes the connection.

#### `DELETE /v1/assessments/{id}` — Delete assessment

**Status:** `204 No Content`. Deletes the assessment and all associated findings and agent logs.

#### `POST /v1/assessments/{id}/rerun` — Rerun assessment

**Status:** `202 Accepted`. Clears existing findings/logs and re-queues the scan. Fails with `409` if the assessment is still in progress.

---

### Findings

#### `GET /v1/assessments/{id}/findings` — List findings

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | int | 1 | Page number |
| `per_page` | int | 20 | Items per page |
| `severity` | string | — | `critical`, `high`, `medium`, `low`, `info` |
| `category` | string | — | e.g. `sql_injection`, `xss`, `hardcoded_secret` |
| `agent` | string | — | e.g. `pattern_scanner`, `recon` |
| `q` | string | — | Case-insensitive text search across title and description |
| `sort` | string | `severity` | `severity` uses domain ordering (critical → info) |

**Finding object:**

```json
{
  "id": "fnd_x1y2z3w4a5b6",
  "assessment_id": "asm_a1b2c3d4e5f6",
  "severity": "critical",
  "category": "sql_injection",
  "title": "SQL Injection via string concatenation",
  "description": "Raw SQL query with dynamic input detected.",
  "location": {"type": "file", "file": "app.py", "line": 42, "snippet": "db.execute(f\"SELECT..."},
  "evidence": null,
  "remediation": "Use parameterized queries.",
  "agent": "pattern_scanner",
  "created_at": "2026-02-28T12:01:00Z"
}
```

#### `GET /v1/assessments/{id}/findings/{finding_id}` — Get single finding

---

### Finding Analysis

#### `POST /v1/assessments/{id}/findings/{finding_id}/analyze` — AI analysis

Send an optional `{"focus": "how to fix this in Express"}` body. Returns a Gemini-powered analysis with summary, impact, root cause, remediation actions, and similar findings from memory.

```json
{
  "finding_id": "fnd_x1y2z3w4a5b6",
  "assessment_id": "asm_a1b2c3d4e5f6",
  "mode": "lightweight",
  "analysis_source": "gemini",
  "summary": "...",
  "impact": "...",
  "possible_root_cause": "...",
  "mode_guidance": "...",
  "where_to_fix": {"file": "app.py", "line": 42},
  "actions": ["Use parameterized queries", "Add input validation", "..."],
  "memory_similar_results_count": 3,
  "memory_similar_results": [...]
}
```

---

### Agent Logs

#### `GET /v1/assessments/{id}/logs` — Agent activity logs

Robust mode only (returns `400 LOGS_NOT_AVAILABLE` for lightweight assessments).

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | int | 1 | Page number |
| `per_page` | int | 20 | Items per page |
| `agent` | string | — | Filter by agent name |

Each log entry contains: `agent`, `step`, `action`, `target`, `payload`, `response_code`, `response_preview`, `reasoning`, and optionally `finding_id`.

---

### Agents

#### `GET /v1/agents` — List available agents

Returns the five agents (recon, auth, injection, config, static) with their descriptions and categories.

#### `GET /v1/agents/{name}` — Get agent details

---

### Tunnel

#### `WebSocket /v1/tunnel` — Tunnel client connection

The tunnel client connects here and sends `{"type": "connect", "target_port": 3000}`. The server responds with `{"type": "session_created", "session_id": "tun_..."}`. During robust scans, the server sends `http_request` messages through the tunnel and expects `http_response` replies.

#### `GET /v1/tunnel/sessions` — List tunnel sessions
#### `GET /v1/tunnel/sessions/{id}` — Get tunnel session details

---

### Memory

#### `GET /v1/memory/status` — Check if Supermemory is enabled

```json
{"enabled": true}
```

#### `GET /v1/memory/search` — Semantic search across findings

| Param | Type | Required | Default |
|---|---|---|---|
| `q` | string | yes | — |
| `limit` | int | no | 5 (max 25) |
| `assessment_id` | string | no | — |

---

## Error Handling

All errors follow a consistent envelope:

```json
{
  "error": {
    "type": "not_found",
    "message": "Assessment 'asm_abc123' not found.",
    "code": "ASSESSMENT_NOT_FOUND",
    "param": null
  }
}
```

| HTTP Status | Error Codes |
|---|---|
| **400** | `INVALID_MODE`, `MISSING_REPO_URL`, `MISSING_TUNNEL_SESSION`, `TUNNEL_NOT_CONNECTED`, `INVALID_AGENT`, `LOGS_NOT_AVAILABLE` |
| **404** | `ASSESSMENT_NOT_FOUND`, `FINDING_NOT_FOUND`, `AGENT_NOT_FOUND`, `TUNNELSESSION_NOT_FOUND` |
| **409** | `ASSESSMENT_IN_PROGRESS`, `DUPLICATE_IDEMPOTENCY_KEY` |
| **422** | `VALIDATION_ERROR` (Pydantic) |
| **502** | `CLONE_FAILED`, `TARGET_UNREACHABLE` |

Every response includes an `X-Request-ID` header for tracing.

---

## Lightweight Scanning Engine

When you create a lightweight assessment, the API runs five analysis modules:

### 1. Dependency Scanner

Checks `package.json` and `requirements.txt` against a curated vulnerability database covering 30 popular packages:

**Node.js:** express, jsonwebtoken, lodash, axios, node-fetch, minimist, qs, tar, glob-parent, next, sequelize, mysql2, helmet, cors, passport
**Python:** flask, django, pyyaml, requests, urllib3, pillow, cryptography, jinja2, sqlalchemy, werkzeug

### 2. Pattern Scanner

Regex-based detection of dangerous code patterns across `.py`, `.js`, `.ts`, `.jsx`, `.tsx`, `.vue`, `.svelte`, `.rb`, `.php`, `.java`, `.go` files:

| Category | Severity | Examples |
|---|---|---|
| SQL injection | critical | String concatenation in queries, `.raw()`, f-string SQL |
| Code injection | critical | `eval()`, `exec()`, `new Function()` |
| Command injection | critical | `child_process.exec`, `os.system()`, `subprocess` with formatting |
| Insecure deserialization | critical | `pickle.load`, unsafe `yaml.load()` |
| XSS | high | `innerHTML`, `dangerouslySetInnerHTML`, `v-html` |
| Missing validation | medium | Unvalidated `req.params/query/body` |
| Debug mode | medium | `DEBUG = true`, `app.run(debug=True)` |
| CORS misconfiguration | medium | Wildcard `*` origins, default CORS |
| Information disclosure | low | Logging passwords, tokens, secrets |

### 3. Secret Scanner

Detects hardcoded secrets via regex patterns and Shannon entropy analysis (threshold > 4.0):

- AWS access/secret keys, GitHub tokens, Stripe keys (live and test), Slack webhooks, SendGrid, Twilio, Google API keys
- JWT secrets, database URLs with credentials, PEM private keys
- High-entropy strings in `secret`/`key`/`token`/`password` assignments

Secrets are automatically redacted in finding snippets.

### 4. Config Scanner

Analyzes configuration files for deployment and security issues:

- `.env` present but not in `.gitignore`
- Missing `.gitignore` file
- Dockerfile running as root or copying `.env` into the image
- `docker-compose` services bound to `0.0.0.0`
- Risky Next.js config (disabled strict mode, wildcard image domains)
- `package.json` install lifecycle scripts (`preinstall`/`postinstall`)

### 5. Gemini Contextual Analyzer (optional)

When `GEMINI_API_KEY` is configured, sends prioritized source files to Gemini for deeper analysis targeting business logic flaws, broken auth/authorization, data exposure, cryptographic misuse, and framework-specific issues that regex cannot catch.

---

## Robust Scanning Engine

Robust mode deploys four AI agents powered by Gemini function calling. Each agent has access to three tools: `http_request`, `check_headers`, and `report_finding`.

| Agent | Focus | Example findings |
|---|---|---|
| **Recon** | Attack surface mapping | Exposed `.env`/`.git`, admin panels, debug endpoints, API docs, directory listings |
| **Auth** | Authentication & authorization | Missing auth, default credentials, IDOR, privilege escalation, JWT issues |
| **Injection** | Input injection attacks | SQL injection, XSS, command injection, template injection (with proof payloads) |
| **Config** | Security configuration | Missing headers, CORS issues, error disclosure, server fingerprinting |

Agent step limits scale with depth: **quick** (5), **standard** (15), **deep** (30).

Agents run sequentially against whatever URL you provide as `target_url`. The only requirement is that the URL is **reachable from the VibeCheck API server** over HTTP/HTTPS. This means any method you already use to expose a port will work — a deployed website, a cloud preview URL, a tunnel service, or the built-in VibeCheck tunnel client.

---

## Exposing Your App for Robust Scanning

Robust mode needs a URL that the VibeCheck API can reach over HTTP. Here are several ways to make a local app scannable, from simplest to most flexible:

### Option 1: Already deployed? Just use the URL

If your app is deployed anywhere with a public URL, pass it directly — no tunnel needed:

```bash
curl -X POST "https://vibecheck-test-1beb2409.aedify.ai/v1/assessments" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "robust",
    "target_url": "https://my-app.vercel.app",
    "agents": ["recon", "auth", "injection", "config"],
    "depth": "standard"
  }'
```

This works with any hosting provider: Vercel, Netlify, Railway, Render, Fly.io, AWS, Heroku, a VPS — anything with a URL.

### Option 2: Cloudflare Tunnel (recommended for local apps)

[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) gives your local app a public `*.trycloudflare.com` URL with zero configuration:

```bash
# Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
# Then expose your local port:
cloudflared tunnel --url http://localhost:3000
```

Cloudflared prints a URL like `https://random-words.trycloudflare.com`. Use that as your `target_url`:

```bash
curl -X POST "https://vibecheck-test-1beb2409.aedify.ai/v1/assessments" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "robust",
    "target_url": "https://random-words.trycloudflare.com",
    "agents": ["recon", "auth", "injection", "config"],
    "depth": "standard"
  }'
```

### Option 3: ngrok

[ngrok](https://ngrok.com/) is another popular option for exposing local ports:

```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3000
```

ngrok prints a forwarding URL like `https://abc123.ngrok-free.app`. Use that as your `target_url`.

### Option 4: VS Code / Cursor port forwarding

Both VS Code and Cursor have built-in port forwarding. Open the **Ports** panel (Ctrl+Shift+P → "Forward a Port"), forward your local port, and use the generated URL as `target_url`.

### Option 5: Built-in VibeCheck tunnel client

If you don't have any of the above set up, VibeCheck includes its own WebSocket-based reverse tunnel:

```bash
pip install vibecheck-client
vibecheck connect 3000 --server wss://vibecheck-test-1beb2409.aedify.ai/v1/tunnel
# Output: Tunnel session: tun_abc123...
```

Then reference the tunnel session in your assessment:

```bash
curl -X POST "https://vibecheck-test-1beb2409.aedify.ai/v1/assessments" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "robust",
    "target_url": "http://localhost:3000",
    "tunnel_session_id": "tun_abc123...",
    "agents": ["recon", "auth", "injection", "config"],
    "depth": "standard"
  }'
```

### Summary

| Method | Setup needed | Best for |
|---|---|---|
| Direct URL | None | Already-deployed apps |
| Cloudflare Tunnel | Install `cloudflared` | Quick local exposure, no account needed |
| ngrok | Install `ngrok` + free account | Popular, well-documented |
| VS Code / Cursor ports | None (built-in) | IDE-native workflow |
| VibeCheck tunnel | `pip install vibecheck-client` | Zero external dependencies |

All methods produce a URL that works as `target_url`. The VibeCheck tunnel is the only one that uses `tunnel_session_id` — all others just use the public URL directly.

---

## Usage Examples

### Scan a GitHub repo

```bash
curl -X POST "https://vibecheck-test-1beb2409.aedify.ai/v1/assessments" \
  -H "Content-Type: application/json" \
  -d '{"mode": "lightweight", "repo_url": "https://github.com/user/my-app"}'
```

### Scan uploaded files

```bash
curl -X POST "https://vibecheck-test-1beb2409.aedify.ai/v1/assessments" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "lightweight",
    "files": [
      {"path": "app.py", "content": "import os\nJWT_SECRET = \"supersecret\"\ndb.execute(f\"SELECT * FROM users WHERE id = {id}\")"}
    ]
  }'
```

### Poll until complete, then fetch findings

```bash
curl "https://vibecheck-test-1beb2409.aedify.ai/v1/assessments/asm_ID"

curl "https://vibecheck-test-1beb2409.aedify.ai/v1/assessments/asm_ID/findings"
```

### Filter and search findings

```bash
curl "https://vibecheck-test-1beb2409.aedify.ai/v1/assessments/asm_ID/findings?severity=critical"

curl "https://vibecheck-test-1beb2409.aedify.ai/v1/assessments/asm_ID/findings?q=sql+injection"

curl "https://vibecheck-test-1beb2409.aedify.ai/v1/assessments/asm_ID/findings?category=xss&agent=pattern_scanner"
```

### Robust scan (any reachable URL)

Pass any URL the API can reach — a deployed site, a Cloudflare Tunnel URL, ngrok, etc. See [Exposing Your App for Robust Scanning](#exposing-your-app-for-robust-scanning) for all options.

```bash
curl -X POST "https://vibecheck-test-1beb2409.aedify.ai/v1/assessments" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "robust",
    "target_url": "https://my-app.example.com",
    "agents": ["recon", "auth", "injection", "config"],
    "depth": "standard"
  }'
```

### View agent logs after a robust scan

```bash
curl "https://vibecheck-test-1beb2409.aedify.ai/v1/assessments/asm_ID/logs"
```

### Analyze a finding with AI

```bash
curl -X POST "https://vibecheck-test-1beb2409.aedify.ai/v1/assessments/asm_ID/findings/fnd_ID/analyze" \
  -H "Content-Type: application/json" \
  -d '{"focus": "how to fix this in Express"}'
```

### Re-run an assessment

```bash
curl -X POST "https://vibecheck-test-1beb2409.aedify.ai/v1/assessments/asm_ID/rerun"
```

---

## Frontend Dashboard

The dashboard is served at the root URL and provides:

- **Create assessments** — lightweight (repo URL) or robust (target URL, tunnel, agents, depth)
- **Assessment snapshot** — total, queued/running, completed, failed counts
- **Assessments table** — paginated list with status badges, click to load findings
- **Findings grid** — filterable by severity, category, agent; searchable by title, description, category, agent, location, or remediation; sortable by severity or date; paginated
- **Finding detail** — full JSON view with "Analyze Finding" (Gemini AI) and "Find Similar" (Supermemory)
- **Export** — CSV or JSON export of filtered findings
- **Charts** — severity distribution bar chart and findings-per-assessment trend chart
- **Real-time updates** — WebSocket status streaming and optional auto-poll

---

## MCP Server (IDE Integration)

The MCP server lets IDE agents (Cursor, etc.) call the VibeCheck API through the Model Context Protocol.

**Tools:** `health`, `list_agents`, `create_assessment`, `list_assessments`, `get_assessment`, `rerun_assessment`, `list_findings`, `analyze_finding`, `list_tunnel_sessions`, `memory_search`

**Transports:** `stdio`, `streamable-http`, `sse`

See [`mcp_server/README.md`](mcp_server/README.md) for setup and Cursor configuration.

---

## Tunnel Client

The tunnel client is a standalone Python package that exposes a localhost app to the VibeCheck API via WebSocket.

```bash
cd vibecheck/client
pip install -e .
vibecheck connect 3000 --server wss://vibecheck-test-1beb2409.aedify.ai/v1/tunnel
```

Output:

```
Connecting to wss://vibecheck-test-1beb2409.aedify.ai/v1/tunnel...
Connected to VibeCheck API
Tunnel session: tun_abc123...
Proxying to localhost:3000
Ready for robust scanning.
```

The client handles heartbeats, proxies HTTP requests from the API to your local app, and logs each proxied request.

---

## Tests

The test suite uses `pytest` + `pytest-asyncio` with an in-memory SQLite database:

```bash
cd vibecheck
python -m pytest tests/ -v
```

**21 tests** covering:

- **Health** — endpoint shape and status
- **Assessments** — create, list (pagination, filtering), get, delete, idempotency (match + conflict), validation errors, rerun
- **Findings** — list, filter by severity/category, text search (`q` parameter, case-insensitive), single finding, 404s, pagination

---

## Project Structure

```
vibecheck1/
├── README.md
├── PRD.md
├── Dockerfile                       # Main API container (non-root)
├── Dockerfile.mcp                   # MCP server container
│
├── vibecheck/
│   ├── pyproject.toml               # Dependencies + test extras
│   ├── .env.example
│   │
│   ├── api/
│   │   ├── main.py                  # FastAPI app, middleware, routers
│   │   ├── config.py                # pydantic-settings (env vars)
│   │   ├── database.py              # Async SQLAlchemy engine + sessions
│   │   │
│   │   ├── models/                  # SQLAlchemy ORM models
│   │   │   ├── assessment.py
│   │   │   ├── finding.py
│   │   │   ├── agent_log.py
│   │   │   └── tunnel_session.py
│   │   │
│   │   ├── schemas/                 # Pydantic request/response models
│   │   │   ├── assessment.py
│   │   │   ├── finding.py
│   │   │   ├── agent_log.py
│   │   │   ├── tunnel.py
│   │   │   ├── errors.py
│   │   │   └── pagination.py
│   │   │
│   │   ├── routers/                 # FastAPI route handlers
│   │   │   ├── health.py
│   │   │   ├── assessments.py       # CRUD + WebSocket status stream
│   │   │   ├── findings.py          # List, get, analyze
│   │   │   ├── logs.py              # Agent logs (robust only)
│   │   │   ├── agents.py            # Agent catalog
│   │   │   ├── tunnel.py            # WebSocket tunnel + sessions
│   │   │   └── memory.py            # Supermemory search
│   │   │
│   │   ├── services/
│   │   │   ├── lightweight_scanner.py   # Clone + static scan orchestrator
│   │   │   ├── robust_scanner.py        # AI agent orchestration
│   │   │   ├── finding_analyzer.py      # Gemini-powered finding analysis
│   │   │   ├── supermemory_service.py   # Supermemory ingestion + search
│   │   │   ├── tunnel_manager.py        # WebSocket session management
│   │   │   └── scanners/
│   │   │       ├── dependency_scanner.py
│   │   │       ├── pattern_scanner.py
│   │   │       ├── secret_scanner.py
│   │   │       ├── config_scanner.py
│   │   │       └── claude_scanner.py    # Gemini contextual analyzer
│   │   │
│   │   ├── agents/                  # Robust-mode AI agents
│   │   │   ├── base_agent.py        # Gemini function-calling loop
│   │   │   ├── recon_agent.py
│   │   │   ├── auth_agent.py
│   │   │   ├── injection_agent.py
│   │   │   ├── config_agent.py
│   │   │   └── http_tools.py        # HTTP request + header check tools
│   │   │
│   │   └── utils/
│   │       ├── id_generator.py      # Prefixed hex IDs (asm_, fnd_, log_, tun_)
│   │       ├── pagination.py        # Offset pagination helper
│   │       └── errors.py            # VibeCheckError with factory methods
│   │
│   ├── client/                      # Tunnel client (pip installable)
│   │   ├── pyproject.toml
│   │   └── vibecheck_client/
│   │       └── cli.py               # `vibecheck connect <port>`
│   │
│   └── tests/
│       ├── conftest.py              # In-memory SQLite fixtures
│       ├── test_health.py
│       ├── test_assessments.py
│       └── test_findings.py
│
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── styles.css
│
└── mcp_server/
    ├── vibecheck_mcp_server.py
    ├── Dockerfile
    └── README.md
```

---

## Configuration

All settings are managed via environment variables (loaded from `.env`):

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./vibecheck.db` | SQLAlchemy async database URL |
| `GEMINI_API_KEY` | `""` | Google Gemini API key (required for robust mode and AI analysis) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model to use |
| `SUPERMEMORY_API_KEY` | `""` | Supermemory API key (optional, enables memory search) |
| `SUPERMEMORY_BASE_URL` | `https://api.supermemory.ai` | Supermemory endpoint |
| `SUPERMEMORY_TIMEOUT_SECONDS` | `10.0` | Supermemory request timeout |
| `CLONE_DIR` | `/tmp/vibecheck-repos` | Directory for cloned repos |
| `DEBUG` | `false` | Enable SQLAlchemy query logging |
