
# VibeCheck API — Product Requirements Document

## Project Overview

**Project:** VibeCheck API
**Event:** HackIllinois 2026 — Stripe Track: Best Web API
**Prize:** 1st: $2,000 + JBL headphones | Honorable mention: $500 + $100 Amazon GC
**Deployed at:** https://vibecheck-test-1beb2409.aedify.ai

**One-liner:** A public HTTP API that security-scans vibe-coded apps in two modes — lightweight static analysis of source code and robust AI-powered red-teaming of running applications through a built-in WebSocket reverse tunnel.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  VibeCheck API (Public)                                       │
│  vibecheck-test-1beb2409.aedify.ai                            │
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
│                                                               │
│  ┌─────────────────────┐                                      │
│  │ Cursor / IDE Agent  │── HTTP to API ──────────────────────▶│
│  └─────────────────────┘                                      │
└──────────────────────────────────────────────────────────────┘
```

### Lightweight Mode Flow

1. User sends a GitHub repo URL or file contents to `POST /v1/assessments`
2. API clones the repo (or uses uploaded files)
3. Five static scanners analyze the code: dependency, pattern, secret, config, and (optionally) Gemini contextual
4. Findings are persisted and ingested into Supermemory
5. Assessment status transitions: `queued` → `cloning` → `analyzing` → `complete`

### Robust Mode Flow

1. User starts their app locally (e.g. `localhost:3000`)
2. User runs `vibecheck connect 3000` — client opens WebSocket to `/v1/tunnel`, receives session ID
3. User (or IDE agent) creates a robust assessment with `target_url` and optionally `tunnel_session_id`
4. Four Gemini-powered AI agents sequentially probe the target:
   - Each agent uses `http_request`, `check_headers`, and `report_finding` tools
   - Requests to localhost targets are proxied through the WebSocket tunnel
   - Public targets are hit directly via httpx
5. Agents log their reasoning as `AgentLog` entries; confirmed vulnerabilities are saved as `Finding` entries
6. Assessment status transitions: `queued` → `scanning` → `complete`

---

## Judging Criteria Alignment

| Criterion | How VibeCheck addresses it |
|---|---|
| **Functionality** | 18 endpoints (16 HTTP + 2 WebSocket), proper status codes (202, 204, 400, 404, 409, 422, 502), background processing with status tracking |
| **Usefulness & Creativity** | Real problem (security scanning for AI-generated code), novel approach (built-in WS reverse tunnel + AI red-teaming), trending topic |
| **API Design** | REST best practices, pagination with metadata, multi-field filtering, text search, severity-ordered sorting, idempotency keys, HATEOAS links, consistent error envelope |
| **Attention to Detail** | POST creates → GET lists/retrieves → DELETE removes, rerun endpoint, WebSocket live status, request ID tracing, domain-specific severity ordering |
| **Documentation & DX** | Auto-generated OpenAPI at /docs and /redoc, comprehensive README with cURL examples, consistent error messages with machine-readable codes, zero-auth for hackathon DX |

---

## Tech Stack

| Component | Technology | Rationale |
|---|---|---|
| API Framework | **FastAPI** (Python 3.11+) | Auto OpenAPI docs, async, native WebSocket support |
| AI Agents | **Google Gemini** (gemini-2.5-flash) | Function-calling for agentic red-teaming |
| Static Analysis | Regex + entropy + Gemini contextual | Speed (regex) + intelligence (LLM) |
| Database | **SQLite** (aiosqlite) / **Postgres** (asyncpg) | Zero-config dev, production-ready swap |
| ORM | **SQLAlchemy 2.x** (async) | Async sessions, type-safe models |
| Validation | **Pydantic v2** + **pydantic-settings** | Schema enforcement, env config |
| HTTP Client | **httpx** | Async HTTP for agents and tunnel proxy |
| Memory / RAG | **Supermemory** | Semantic search across historical findings |
| WebSocket Tunnel | FastAPI WebSocket + Python client | Built-in reverse tunnel, no third-party deps |
| Frontend | Vanilla HTML/CSS/JS | Dashboard with charts, filters, real-time updates |
| MCP Server | **FastMCP** | IDE integration for Cursor |
| Deployment | **Docker** (non-root containers) | Single-container deployment |

---

## Data Models

### Assessment (`assessments`)

| Column | Type | Notes |
|---|---|---|
| `id` | string | PK, `asm_` + 12 hex chars |
| `mode` | string | `lightweight` or `robust` |
| `status` | string | `queued`, `cloning`, `analyzing`, `scanning`, `complete`, `failed` |
| `repo_url` | string? | GitHub URL (lightweight) |
| `target_url` | string? | Target URL (robust) |
| `tunnel_session_id` | string? | Links to active WS tunnel |
| `agents` | JSON? | Agent list (robust) |
| `depth` | string | `quick`, `standard`, `deep` |
| `idempotency_key` | string? | Unique, indexed |
| `finding_counts` | JSON | `{critical, high, medium, low, info, total}` |
| `error_type` | string? | Error code on failure |
| `error_message` | string? | Error detail on failure |
| `created_at` | datetime | Auto-set |
| `updated_at` | datetime | Auto-updated |
| `completed_at` | datetime? | Set on completion |

### Finding (`findings`)

| Column | Type | Notes |
|---|---|---|
| `id` | string | PK, `fnd_` + 12 hex chars |
| `assessment_id` | string | FK → assessments, indexed |
| `severity` | string | `critical`, `high`, `medium`, `low`, `info` |
| `category` | string | e.g. `sql_injection`, `xss`, `hardcoded_secret` |
| `title` | string | Human-readable summary |
| `description` | text | Detailed explanation |
| `location` | JSON? | `{file, line, snippet}` or `{url, method, parameter}` |
| `evidence` | JSON? | `{payload, response_code, response_preview}` |
| `remediation` | text | How to fix |
| `agent` | string? | Which scanner/agent found it |
| `created_at` | datetime | Auto-set |

### AgentLog (`agent_logs`)

| Column | Type | Notes |
|---|---|---|
| `id` | string | PK, `log_` + 12 hex chars |
| `assessment_id` | string | FK → assessments, indexed |
| `agent` | string | Agent name |
| `step` | int | Step number in agent run |
| `action` | string | What the agent did |
| `target` | string | Target path/URL |
| `payload` | text? | Request payload |
| `response_code` | int? | HTTP response status |
| `response_preview` | text? | Truncated response |
| `reasoning` | text | Agent's reasoning |
| `finding_id` | string? | If this step reported a finding |
| `timestamp` | datetime | Auto-set |

### TunnelSession (`tunnel_sessions`)

| Column | Type | Notes |
|---|---|---|
| `id` | string | PK, `tun_` + 12 hex chars |
| `target_port` | int | Port on user's machine |
| `status` | string | `connected` or `disconnected` |
| `created_at` | datetime | Auto-set |
| `last_heartbeat` | datetime | Updated on pong |

---

## API Endpoints (18 total)

### Assessments

| Method | Path | Description | Status |
|---|---|---|---|
| POST | `/v1/assessments` | Create scan (lightweight or robust) | 202 |
| GET | `/v1/assessments` | List assessments (paginated, filterable) | 200 |
| GET | `/v1/assessments/{id}` | Get assessment detail | 200 |
| WebSocket | `/v1/assessments/{id}/ws` | Live status stream | — |
| DELETE | `/v1/assessments/{id}` | Delete assessment + findings + logs | 204 |
| POST | `/v1/assessments/{id}/rerun` | Re-run completed/failed assessment | 202 |

### Findings

| Method | Path | Description | Status |
|---|---|---|---|
| GET | `/v1/assessments/{id}/findings` | List findings (paginated, filterable, searchable) | 200 |
| GET | `/v1/assessments/{id}/findings/{fid}` | Get single finding | 200 |
| POST | `/v1/assessments/{id}/findings/{fid}/analyze` | AI-powered finding analysis | 200 |

### Agent Logs

| Method | Path | Description | Status |
|---|---|---|---|
| GET | `/v1/assessments/{id}/logs` | Agent activity (robust only) | 200 |

### Agents

| Method | Path | Description | Status |
|---|---|---|---|
| GET | `/v1/agents` | List available agents | 200 |
| GET | `/v1/agents/{name}` | Agent detail | 200 |

### Tunnel

| Method | Path | Description | Status |
|---|---|---|---|
| WebSocket | `/v1/tunnel` | Tunnel client connection | — |
| GET | `/v1/tunnel/sessions` | List tunnel sessions | 200 |
| GET | `/v1/tunnel/sessions/{id}` | Tunnel session detail | 200 |

### Memory

| Method | Path | Description | Status |
|---|---|---|---|
| GET | `/v1/memory/status` | Check Supermemory enabled | 200 |
| GET | `/v1/memory/search` | Semantic search across findings | 200 |

### Reference

| Method | Path | Description |
|---|---|---|
| GET | `/v1/health` | Health check |
| GET | `/docs` | Swagger UI |
| GET | `/redoc` | ReDoc |

---

## Lightweight Scanning Modules

| Module | Detects | Severity Range |
|---|---|---|
| **Dependency scanner** | Known CVEs in 30 popular Node.js and Python packages | critical — info |
| **Pattern scanner** | SQL injection, XSS, code/command injection, insecure deserialization, debug mode, CORS, sensitive logging (15 regex patterns) | critical — low |
| **Secret scanner** | AWS keys, GitHub/Stripe/Slack/SendGrid/Twilio/Google tokens, JWT secrets, DB URLs, PEM keys, high-entropy strings | critical — high |
| **Config scanner** | Exposed .env, missing .gitignore, Docker as root, network exposure, framework misconfig, supply chain scripts | critical — info |
| **Gemini contextual** | Business logic flaws, broken auth, data exposure, crypto misuse, framework-specific issues | critical — info |

---

## Robust Scanning Agents

| Agent | System Prompt Focus | Tools |
|---|---|---|
| **Recon** | Map attack surface, find exposed files (.env, .git), admin panels, debug endpoints, API docs | `http_request`, `check_headers`, `report_finding` |
| **Auth** | Test missing auth, default credentials, IDOR, role escalation, JWT manipulation | `http_request`, `check_headers`, `report_finding` |
| **Injection** | Prove SQL injection, XSS, command injection, template injection with real payloads | `http_request`, `check_headers`, `report_finding` |
| **Config** | Check security headers, CORS, error handling, server/framework disclosure | `http_request`, `check_headers`, `report_finding` |

Step limits: quick=5, standard=15, deep=30.

---

## WebSocket Tunnel Protocol

```
Client → Server: {"type": "connect", "target_port": 3000}
Server → Client: {"type": "session_created", "session_id": "tun_abc123"}

# During robust scan:
Server → Client: {"type": "http_request", "request_id": "req_001", "method": "GET", "path": "/api/users", "headers": {}, "body": null}
Client → Server: {"type": "http_response", "request_id": "req_001", "status_code": 200, "headers": {}, "body": "..."}

# Heartbeat:
Server → Client: {"type": "ping"}
Client → Server: {"type": "pong"}
```

---

## Error Response Format

All errors use a consistent envelope:

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

| HTTP | Type | Codes |
|---|---|---|
| 400 | validation_error, tunnel_error | INVALID_MODE, MISSING_REPO_URL, MISSING_TUNNEL_SESSION, TUNNEL_NOT_CONNECTED, INVALID_AGENT, LOGS_NOT_AVAILABLE |
| 404 | not_found | ASSESSMENT_NOT_FOUND, FINDING_NOT_FOUND, AGENT_NOT_FOUND, TUNNELSESSION_NOT_FOUND |
| 409 | conflict | ASSESSMENT_IN_PROGRESS, DUPLICATE_IDEMPOTENCY_KEY |
| 422 | validation_error | VALIDATION_ERROR (Pydantic) |
| 502 | external_error, tunnel_error | CLONE_FAILED, TARGET_UNREACHABLE |

---

## Frontend Dashboard

Served at `/` when the `frontend/` directory is present. Features:

- **Create Assessment** — lightweight (repo URL) or robust (target URL, tunnel session, agents, depth, idempotency key)
- **Assessment Snapshot** — real-time counts of total, queued/running, completed, failed
- **Assessments Table** — paginated, clickable rows to load findings
- **Findings Grid** — filterable by severity, category, agent; searchable by title, description, category, agent, location, or remediation; sortable; paginated
- **Finding Detail** — full JSON, "Analyze Finding" (Gemini AI), "Find Similar" (Supermemory)
- **Export** — CSV and JSON export of filtered findings
- **Charts** — severity distribution and findings-per-assessment trend
- **Real-time** — WebSocket status streaming and optional 5-second auto-poll

---

## MCP Server

IDE agents call the API through the Model Context Protocol. 10 tools:

`health`, `list_agents`, `create_assessment`, `list_assessments`, `get_assessment`, `rerun_assessment`, `list_findings`, `analyze_finding`, `list_tunnel_sessions`, `memory_search`

Transports: `stdio` (default), `streamable-http`, `sse`.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./vibecheck.db` | Async DB URL |
| `GEMINI_API_KEY` | `""` | Required for robust mode and AI analysis |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model |
| `SUPERMEMORY_API_KEY` | `""` | Optional, enables memory search |
| `SUPERMEMORY_BASE_URL` | `https://api.supermemory.ai` | Supermemory endpoint |
| `SUPERMEMORY_TIMEOUT_SECONDS` | `10.0` | Supermemory timeout |
| `CLONE_DIR` | `/tmp/vibecheck-repos` | Repo clone directory |
| `DEBUG` | `false` | SQLAlchemy query logging |
