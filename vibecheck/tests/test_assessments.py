import pytest


@pytest.mark.asyncio
async def test_create_lightweight_assessment(client):
    resp = await client.post("/v1/assessments", json={
        "mode": "lightweight",
        "files": [{"path": "app.py", "content": "print('hello')"}],
    })
    assert resp.status_code == 202
    body = resp.json()
    assert body["id"].startswith("asm_")
    assert body["mode"] == "lightweight"
    assert body["status"] == "queued"
    assert "self" in body["links"]
    assert "findings" in body["links"]


@pytest.mark.asyncio
async def test_list_assessments_paginated(client):
    for i in range(3):
        await client.post("/v1/assessments", json={
            "mode": "lightweight",
            "files": [{"path": f"f{i}.py", "content": "x=1"}],
        })

    resp = await client.get("/v1/assessments", params={"page": 1, "per_page": 2})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["data"]) == 2
    assert body["pagination"]["total"] == 3
    assert body["pagination"]["total_pages"] == 2


@pytest.mark.asyncio
async def test_get_assessment_by_id(client):
    create_resp = await client.post("/v1/assessments", json={
        "mode": "lightweight",
        "files": [{"path": "a.py", "content": "x=1"}],
    })
    asm_id = create_resp.json()["id"]

    resp = await client.get(f"/v1/assessments/{asm_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == asm_id


@pytest.mark.asyncio
async def test_get_assessment_not_found(client):
    resp = await client.get("/v1/assessments/asm_nonexistent")
    assert resp.status_code == 404
    body = resp.json()
    assert body["error"]["code"] == "ASSESSMENT_NOT_FOUND"


@pytest.mark.asyncio
async def test_delete_assessment(client):
    create_resp = await client.post("/v1/assessments", json={
        "mode": "lightweight",
        "files": [{"path": "a.py", "content": "x=1"}],
    })
    asm_id = create_resp.json()["id"]

    resp = await client.delete(f"/v1/assessments/{asm_id}")
    assert resp.status_code == 204

    resp = await client.get(f"/v1/assessments/{asm_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_idempotency_key_returns_existing(client):
    payload = {
        "mode": "lightweight",
        "files": [{"path": "a.py", "content": "x=1"}],
        "idempotency_key": "unique-key-1",
    }
    resp1 = await client.post("/v1/assessments", json=payload)
    resp2 = await client.post("/v1/assessments", json=payload)
    assert resp1.json()["id"] == resp2.json()["id"]


@pytest.mark.asyncio
async def test_idempotency_key_conflict_on_mode_mismatch(client):
    await client.post("/v1/assessments", json={
        "mode": "lightweight",
        "files": [{"path": "a.py", "content": "x=1"}],
        "idempotency_key": "shared-key",
    })
    resp = await client.post("/v1/assessments", json={
        "mode": "robust",
        "target_url": "http://example.com",
        "idempotency_key": "shared-key",
    })
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "DUPLICATE_IDEMPOTENCY_KEY"


@pytest.mark.asyncio
async def test_create_assessment_validation_error(client):
    resp = await client.post("/v1/assessments", json={
        "mode": "lightweight",
    })
    assert resp.status_code == 422
    assert resp.json()["error"]["type"] == "validation_error"


@pytest.mark.asyncio
async def test_list_assessments_filter_by_mode(client):
    await client.post("/v1/assessments", json={
        "mode": "lightweight",
        "files": [{"path": "a.py", "content": "x=1"}],
    })

    resp = await client.get("/v1/assessments", params={"mode": "robust"})
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 0

    resp = await client.get("/v1/assessments", params={"mode": "lightweight"})
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 1


@pytest.mark.asyncio
async def test_rerun_completed_assessment(client):
    """Background tasks run inline in tests, so the assessment completes
    before we can call rerun — verify rerun succeeds on a completed scan."""
    create_resp = await client.post("/v1/assessments", json={
        "mode": "lightweight",
        "files": [{"path": "a.py", "content": "x=1"}],
    })
    asm_id = create_resp.json()["id"]

    get_resp = await client.get(f"/v1/assessments/{asm_id}")
    assert get_resp.json()["status"] in ("complete", "failed")

    resp = await client.post(f"/v1/assessments/{asm_id}/rerun")
    assert resp.status_code == 202
    assert resp.json()["status"] == "queued"
