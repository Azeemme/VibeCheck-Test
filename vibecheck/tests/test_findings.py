import pytest

from sqlalchemy import delete

from api.models.finding import Finding

from tests.conftest import TestSessionLocal


async def _seed_assessment_with_findings(client):
    """Create an assessment and replace any scanner-generated findings
    with a known set so assertions are deterministic."""
    resp = await client.post("/v1/assessments", json={
        "mode": "lightweight",
        "files": [{"path": "a.py", "content": "x=1"}],
    })
    asm_id = resp.json()["id"]

    async with TestSessionLocal() as session:
        await session.execute(
            delete(Finding).where(Finding.assessment_id == asm_id)
        )
        await session.commit()

    findings_data = [
        {
            "assessment_id": asm_id,
            "severity": "critical",
            "category": "sql_injection",
            "title": "SQL Injection via string concatenation",
            "description": "User input is concatenated directly into a SQL query.",
            "remediation": "Use parameterized queries.",
            "agent": "static",
        },
        {
            "assessment_id": asm_id,
            "severity": "high",
            "category": "xss",
            "title": "Cross-Site Scripting via innerHTML",
            "description": "Untrusted data written to innerHTML without sanitization.",
            "remediation": "Use textContent or a sanitization library.",
            "agent": "static",
        },
        {
            "assessment_id": asm_id,
            "severity": "medium",
            "category": "hardcoded_secret",
            "title": "Hardcoded API key found",
            "description": "A secret key was found hardcoded in configuration file.",
            "remediation": "Move secrets to environment variables.",
            "agent": "static",
        },
    ]
    async with TestSessionLocal() as session:
        for data in findings_data:
            session.add(Finding(**data))
        await session.commit()

    return asm_id


@pytest.mark.asyncio
async def test_list_findings(client):
    asm_id = await _seed_assessment_with_findings(client)

    resp = await client.get(f"/v1/assessments/{asm_id}/findings")
    assert resp.status_code == 200
    body = resp.json()
    assert body["pagination"]["total"] == 3
    assert len(body["data"]) == 3


@pytest.mark.asyncio
async def test_list_findings_filter_severity(client):
    asm_id = await _seed_assessment_with_findings(client)

    resp = await client.get(
        f"/v1/assessments/{asm_id}/findings",
        params={"severity": "critical"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["severity"] == "critical"


@pytest.mark.asyncio
async def test_list_findings_filter_category(client):
    asm_id = await _seed_assessment_with_findings(client)

    resp = await client.get(
        f"/v1/assessments/{asm_id}/findings",
        params={"category": "xss"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["category"] == "xss"


@pytest.mark.asyncio
async def test_list_findings_text_search(client):
    asm_id = await _seed_assessment_with_findings(client)

    resp = await client.get(
        f"/v1/assessments/{asm_id}/findings",
        params={"q": "innerHTML"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert "innerHTML" in data[0]["description"]


@pytest.mark.asyncio
async def test_list_findings_text_search_case_insensitive(client):
    asm_id = await _seed_assessment_with_findings(client)

    resp = await client.get(
        f"/v1/assessments/{asm_id}/findings",
        params={"q": "sql injection"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["category"] == "sql_injection"


@pytest.mark.asyncio
async def test_list_findings_text_search_no_results(client):
    asm_id = await _seed_assessment_with_findings(client)

    resp = await client.get(
        f"/v1/assessments/{asm_id}/findings",
        params={"q": "nonexistent_term_xyz"},
    )
    assert resp.status_code == 200
    assert resp.json()["pagination"]["total"] == 0


@pytest.mark.asyncio
async def test_get_single_finding(client):
    asm_id = await _seed_assessment_with_findings(client)

    list_resp = await client.get(f"/v1/assessments/{asm_id}/findings")
    finding_id = list_resp.json()["data"][0]["id"]

    resp = await client.get(f"/v1/assessments/{asm_id}/findings/{finding_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == finding_id


@pytest.mark.asyncio
async def test_get_finding_not_found(client):
    asm_id = await _seed_assessment_with_findings(client)

    resp = await client.get(f"/v1/assessments/{asm_id}/findings/fnd_nonexistent")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "FINDING_NOT_FOUND"


@pytest.mark.asyncio
async def test_findings_for_nonexistent_assessment(client):
    resp = await client.get("/v1/assessments/asm_fake/findings")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "ASSESSMENT_NOT_FOUND"


@pytest.mark.asyncio
async def test_list_findings_pagination(client):
    asm_id = await _seed_assessment_with_findings(client)

    resp = await client.get(
        f"/v1/assessments/{asm_id}/findings",
        params={"page": 1, "per_page": 2},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["data"]) == 2
    assert body["pagination"]["total"] == 3
    assert body["pagination"]["total_pages"] == 2
