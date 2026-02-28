import pytest


@pytest.mark.asyncio
async def test_health_returns_200(client):
    resp = await client.get("/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "healthy"
    assert "version" in body
    assert "active_tunnels" in body
    assert "agents_available" in body
