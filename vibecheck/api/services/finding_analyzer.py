import json
import re
from typing import Any

from google import genai

from api.config import settings
from api.services.supermemory_service import SupermemoryService


def _safe_json(data: Any) -> str:
    try:
        return json.dumps(data, ensure_ascii=False)
    except Exception:
        return "{}"


def _normalize_similarity_text(text: str) -> str:
    txt = text or ""
    txt = re.sub(r"[A-Za-z0-9_\-./]+\.[A-Za-z0-9]+:\d+", " ", txt)  # file:line
    txt = re.sub(r"\bline\s+\d+\b", " ", txt, flags=re.IGNORECASE)
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt


def _fallback_analysis(
    assessment: Any,
    finding: Any,
    memory_results: list[dict],
    local_similar_findings: list[dict] | None = None,
    error: str | None = None,
) -> dict[str, Any]:
    location = finding.location if isinstance(finding.location, dict) else {}
    evidence = finding.evidence if isinstance(finding.evidence, dict) else {}

    mode_guidance = (
        "Patch the vulnerable code path directly, add tests that assert the fix, and rerun lightweight scan."
        if assessment.mode == "lightweight"
        else "Harden endpoint behavior and auth/input validation controls, then rerun robust scan to confirm exploitability is removed."
    )
    where_to_fix = None
    if assessment.mode == "lightweight":
        where_to_fix = {
            "file": location.get("file"),
            "line": location.get("line"),
            "snippet": location.get("snippet"),
        }
    else:
        where_to_fix = {
            "endpoint": evidence.get("url") or location.get("url"),
            "agent": finding.agent,
        }

    actions = [
        f"Apply remediation: {finding.remediation}",
        "Add regression test coverage for this vulnerability scenario.",
        "Re-run assessment and verify finding no longer appears.",
    ]

    local_similar_findings = local_similar_findings or []
    merged = [*memory_results[:3], *local_similar_findings[:2]]
    return {
        "analysis_source": "fallback",
        "error": error,
        "summary": finding.description,
        "impact": f"Severity is '{finding.severity}'. Category is '{finding.category}'.",
        "possible_root_cause": "Insufficient input validation, unsafe defaults, or missing authorization checks in the affected code path.",
        "mode_guidance": mode_guidance,
        "where_to_fix": where_to_fix,
        "actions": actions,
        "memory_similar_results_count": len(memory_results) + len(local_similar_findings),
        "memory_similar_results": merged,
    }


async def analyze_finding(
    assessment: Any,
    finding: Any,
    local_similar_findings: list[dict[str, Any]] | None = None,
    focus: str | None = None,
) -> dict[str, Any]:
    tag_filters = ["vibecheck", "security-finding", f"mode:{assessment.mode}"]
    if assessment.repo_url:
        tag_filters.append(f"repo:{assessment.repo_url}")
    if assessment.target_url:
        tag_filters.append(f"target:{assessment.target_url}")

    normalized_title = _normalize_similarity_text(finding.title)
    normalized_desc = _normalize_similarity_text(finding.description)
    memory_query = f"{finding.category} vulnerability {normalized_title} {normalized_desc}"
    memory = await SupermemoryService.search(
        query=memory_query,
        limit=5,
        container_tags=tag_filters,
    )
    memory_results = memory.get("results", []) if isinstance(memory, dict) else []
    local_similar_findings = local_similar_findings or []

    if not settings.GEMINI_API_KEY:
        return _fallback_analysis(
            assessment,
            finding,
            memory_results,
            local_similar_findings=local_similar_findings,
            error="GEMINI_API_KEY missing",
        )

    prompt = f"""
You are a senior AppSec engineer. Analyze this vulnerability and return JSON only.

Assessment mode: {assessment.mode}
Assessment id: {assessment.id}
Repo URL: {assessment.repo_url}
Target URL: {assessment.target_url}

Finding:
{_safe_json({
    "id": finding.id,
    "severity": finding.severity,
    "category": finding.category,
    "title": finding.title,
    "description": finding.description,
    "location": finding.location,
    "evidence": finding.evidence,
    "remediation": finding.remediation,
    "agent": finding.agent,
})}

User focus (optional):
{focus or ""}

Similar historical findings from memory:
{_safe_json(memory_results[:3])}

Local similar incidents (same category):
{_safe_json(local_similar_findings[:5])}

Requirements:
- Return strict JSON object with keys:
  summary, impact, possible_root_cause, mode_guidance, where_to_fix, actions
- actions: array of 3-6 concise actionable steps.
- If mode is lightweight, where_to_fix should prioritize file/line/snippet.
- If mode is robust, where_to_fix should prioritize endpoint/request behavior and defensive controls.
- Keep output practical and implementation-oriented.
"""

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        async with client.aio as aclient:
            resp = await aclient.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
            )
        text = (resp.text or "").strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
        data = json.loads(text)
        if not isinstance(data, dict):
            raise ValueError("Model output is not an object")

        return {
            "analysis_source": "gemini",
            "summary": data.get("summary", ""),
            "impact": data.get("impact", ""),
            "possible_root_cause": data.get("possible_root_cause", ""),
            "mode_guidance": data.get("mode_guidance", ""),
            "where_to_fix": data.get("where_to_fix"),
            "actions": data.get("actions", []),
            "memory_similar_results_count": len(memory_results) + len(local_similar_findings),
            "memory_similar_results": [*memory_results[:3], *local_similar_findings[:2]],
        }
    except Exception as e:
        return _fallback_analysis(
            assessment,
            finding,
            memory_results,
            local_similar_findings=local_similar_findings,
            error=str(e),
        )
