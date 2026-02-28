from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.assessment import Assessment
from api.services.supermemory_service import SupermemoryService
from api.utils.errors import VibeCheckError

router = APIRouter(tags=["Memory"])


@router.get("/v1/memory/status")
async def memory_status():
    return {"enabled": SupermemoryService.enabled()}


@router.get("/v1/memory/search")
async def search_memory(
    q: str,
    limit: int = 5,
    assessment_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    container_tags: list[str] = ["vibecheck", "security-finding"]

    if assessment_id:
        assessment = await db.get(Assessment, assessment_id)
        if not assessment:
            raise VibeCheckError.not_found("Assessment", assessment_id)
        container_tags.append(f"mode:{assessment.mode}")
        if assessment.repo_url:
            container_tags.append(f"repo:{assessment.repo_url}")
        if assessment.target_url:
            container_tags.append(f"target:{assessment.target_url}")

    return await SupermemoryService.search(
        query=q,
        limit=max(1, min(limit, 25)),
        container_tags=container_tags,
    )
