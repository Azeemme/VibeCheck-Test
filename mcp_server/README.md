# VibeCheck MCP Server (Cursor)

This folder provides a Cursor-compatible MCP server for the VibeCheck API.

## Why this shape
- Transport: `stdio` (most reliable in Cursor)
- Implementation: Python FastMCP
- Scope: thin tool wrapper over your `/v1/*` API

## Prerequisites
1. VibeCheck API running (local or hosted)
2. Python environment with:
   - `mcp`
   - `httpx`

Install:

```bash
cd /Users/rajendrathalluru/Documents/Hackathon/VibeCheck
python3 -m pip install mcp httpx
```

## Run manually (stdio)

```bash
cd /Users/rajendrathalluru/Documents/Hackathon/VibeCheck
VIBECHECK_API_BASE=http://127.0.0.1:8000 \
python3 mcp_server/vibecheck_mcp_server.py
```

## Run manually (streamable-http)

```bash
cd /Users/rajendrathalluru/Documents/Hackathon/VibeCheck
VIBECHECK_API_BASE=http://127.0.0.1:8000 \
python3 mcp_server/vibecheck_mcp_server.py \
  --transport streamable-http \
  --host 127.0.0.1 \
  --port 8787 \
  --path /mcp
```

## Cursor MCP config

Add to your Cursor MCP config (`mcp.json`):

```json
{
  "mcpServers": {
    "vibecheck": {
      "command": "python3",
      "args": [
        "/Users/rajendrathalluru/Documents/Hackathon/VibeCheck/mcp_server/vibecheck_mcp_server.py"
      ],
      "env": {
        "VIBECHECK_API_BASE": "http://127.0.0.1:8000",
        "VIBECHECK_TIMEOUT_SECONDS": "30"
      }
    }
  }
}
```

If your backend is hosted, set `VIBECHECK_API_BASE` to your deployed API URL.

## Cursor config (streamable-http)

If you run this MCP server as HTTP, Cursor can connect by URL:

```json
{
  "mcpServers": {
    "vibecheck-http": {
      "url": "http://127.0.0.1:8787/mcp"
    }
  }
}
```

For a remote deployment, replace with your public endpoint URL.

## Exposed tools
- `health`
- `list_agents`
- `create_assessment`
- `list_assessments`
- `get_assessment`
- `rerun_assessment`
- `list_findings`
- `analyze_finding`
- `list_tunnel_sessions`
- `memory_search`
