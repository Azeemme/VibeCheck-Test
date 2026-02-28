import hashlib
from typing import Any

import httpx

from api.config import settings


def _fingerprint(*parts: str) -> str:
    payload = "|".join(parts)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:20]


class SupermemoryService:
    """
    Thin integration layer for Supermemory.
    - Ingests findings as memories with tags and metadata.
    - Supports semantic search for prior similar findings.
    """

    @staticmethod
    def enabled() -> bool:
        return bool(settings.SUPERMEMORY_API_KEY)

    @staticmethod
    def _headers() -> dict[str, str]:
        return {
            "Authorization": f"Bearer {settings.SUPERMEMORY_API_KEY}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _base_url() -> str:
        base = settings.SUPERMEMORY_BASE_URL.rstrip("/")
        if base.endswith("/v3") or base.endswith("/v4"):
            base = base.rsplit("/", 1)[0]
        return base

    @staticmethod
    def _memory_payload(
        assessment_id: str,
        mode: str,
        finding: dict[str, Any],
        repo_url: str | None = None,
        target_url: str | None = None,
    ) -> dict[str, Any]:
        title = finding.get("title", "Untitled finding")
        category = finding.get("category", "unknown")
        severity = finding.get("severity", "info")
        location = finding.get("location")
        remediation = finding.get("remediation", "")
        description = finding.get("description", "")

        fingerprint = _fingerprint(mode, category, severity, title, str(location))
        scope = repo_url or target_url or "global"
        scope_hash = _fingerprint(scope)

        content = (
            f"Finding: {title}\n"
            f"Severity: {severity}\n"
            f"Category: {category}\n"
            f"Mode: {mode}\n"
            f"Assessment ID: {assessment_id}\n"
            f"Repo URL: {repo_url or ''}\n"
            f"Target URL: {target_url or ''}\n"
            f"Location: {location or ''}\n"
            f"Description: {description}\n"
            f"Remediation: {remediation}\n"
        )

        tags = [
            "vibecheck",
            "security-finding",
            f"mode:{mode}",
            f"severity:{severity}",
            f"category:{category}",
        ]
        if repo_url:
            tags.append(f"repo:{repo_url}")
        if target_url:
            tags.append(f"target:{target_url}")

        return {
            "content": content,
            # Stable across assessment runs for better dedupe/recall.
            "customId": f"vibecheck:{mode}:{scope_hash}:{fingerprint}",
            "containerTags": tags,
            "metadata": {
                "assessment_id": assessment_id,
                "source_scope": scope,
                "mode": mode,
                "repo_url": repo_url,
                "target_url": target_url,
                "severity": severity,
                "category": category,
                "title": title,
                "location": location,
            },
        }

    @classmethod
    async def ingest_finding(
        cls,
        assessment_id: str,
        mode: str,
        finding: dict[str, Any],
        repo_url: str | None = None,
        target_url: str | None = None,
    ) -> None:
        if not cls.enabled():
            return

        payload = cls._memory_payload(
            assessment_id=assessment_id,
            mode=mode,
            finding=finding,
            repo_url=repo_url,
            target_url=target_url,
        )
        base = cls._base_url()
        v4_endpoint = f"{base}/v4/memories"
        v3_endpoint = f"{base}/v3/memories"
        v3_payload = payload
        v4_payload = {
            "memories": [
                {
                    "content": payload["content"],
                    "customId": payload["customId"],
                    "containerTags": payload.get("containerTags", []),
                    "metadata": payload.get("metadata", {}),
                }
            ]
        }

        try:
            async with httpx.AsyncClient(timeout=settings.SUPERMEMORY_TIMEOUT_SECONDS) as client:
                r = await client.post(v4_endpoint, headers=cls._headers(), json=v4_payload)
                if r.status_code == 404:
                    await client.post(v3_endpoint, headers=cls._headers(), json=v3_payload)
        except Exception:
            # Memory integration must never break scans.
            return

    @classmethod
    async def search(
        cls,
        query: str,
        limit: int = 5,
        container_tags: list[str] | None = None,
    ) -> dict[str, Any]:
        if not cls.enabled():
            return {"results": [], "enabled": False}

        base = cls._base_url()
        v4_endpoint = f"{base}/v4/search"
        v3_endpoint = f"{base}/v3/search"
        payload: dict[str, Any] = {"q": query, "limit": limit}
        if container_tags:
            # v4 search supports containerTag (single) in examples.
            payload["containerTag"] = container_tags[0]

        try:
            async with httpx.AsyncClient(timeout=settings.SUPERMEMORY_TIMEOUT_SECONDS) as client:
                resp = await client.post(v4_endpoint, headers=cls._headers(), json=payload)
                if resp.status_code == 404:
                    resp = await client.post(v3_endpoint, headers=cls._headers(), json=payload)
                data = resp.json() if resp.content else {}
                return {"results": data.get("results", []), "enabled": True}
        except Exception:
            return {"results": [], "enabled": True}
