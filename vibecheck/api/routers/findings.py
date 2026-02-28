from fastapi import APIRouter, Depends
from sqlalchemy import case, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.assessment import Assessment
from api.models.finding import Finding
from api.schemas.finding import (
    FindingResponse,
    FindingListResponse,
    AnalyzeFindingRequest,
    AnalyzeFindingResponse,
)
from api.services.finding_analyzer import analyze_finding
from api.utils.errors import VibeCheckError
from api.utils.pagination import paginate

# Severity order for sorting: critical=0, high=1, medium=2, low=3, info=4
SEVERITY_ORDER = case(
    (Finding.severity == "critical", 0),
    (Finding.severity == "high", 1),
    (Finding.severity == "medium", 2),
    (Finding.severity == "low", 3),
    (Finding.severity == "info", 4),
    else_=5,
)


async def _get_assessment_or_404(db: AsyncSession, assessment_id: str) -> Assessment:
    assessment = await db.get(Assessment, assessment_id)
    if not assessment:
        raise VibeCheckError.not_found("Assessment", assessment_id)
    return assessment


router = APIRouter(tags=["Findings"])


@router.get(
    "/v1/assessments/{assessment_id}/findings",
    response_model=FindingListResponse,
)
async def list_findings(
    assessment_id: str,
    db: AsyncSession = Depends(get_db),
    page: int = 1,
    per_page: int = 20,
    severity: str | None = None,
    category: str | None = None,
    agent: str | None = None,
    q: str | None = None,
    sort: str = "severity",
):
    await _get_assessment_or_404(db, assessment_id)

    query = select(Finding).where(Finding.assessment_id == assessment_id)
    if severity is not None:
        query = query.where(Finding.severity == severity)
    if category is not None:
        query = query.where(Finding.category == category)
    if agent is not None:
        query = query.where(Finding.agent == agent)
    if q is not None:
        pattern = f"%{q}%"
        query = query.where(
            (Finding.title.ilike(pattern)) | (Finding.description.ilike(pattern))
        )

    if sort == "severity":
        query = query.order_by(SEVERITY_ORDER.asc(), Finding.created_at.asc())
    else:
        order_col = getattr(Finding, sort, Finding.created_at)
        query = query.order_by(order_col.asc())

    items, meta = await paginate(db, query, page, per_page)
    return FindingListResponse(
        data=[FindingResponse.model_validate(f) for f in items],
        pagination=meta,
    )


@router.get(
    "/v1/assessments/{assessment_id}/findings/{finding_id}",
    response_model=FindingResponse,
)
async def get_finding(
    assessment_id: str,
    finding_id: str,
    db: AsyncSession = Depends(get_db),
):
    await _get_assessment_or_404(db, assessment_id)
    result = await db.execute(
        select(Finding).where(
            Finding.id == finding_id,
            Finding.assessment_id == assessment_id,
        )
    )
    finding = result.scalar_one_or_none()
    if not finding:
        raise VibeCheckError.not_found("Finding", finding_id)
    return FindingResponse.model_validate(finding)


@router.post(
    "/v1/assessments/{assessment_id}/findings/{finding_id}/analyze",
    response_model=AnalyzeFindingResponse,
)
async def analyze_finding_endpoint(
    assessment_id: str,
    finding_id: str,
    body: AnalyzeFindingRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    assessment = await _get_assessment_or_404(db, assessment_id)
    result = await db.execute(
        select(Finding).where(
            Finding.id == finding_id,
            Finding.assessment_id == assessment_id,
        )
    )
    finding = result.scalar_one_or_none()
    if not finding:
        raise VibeCheckError.not_found("Finding", finding_id)

    similar_result = await db.execute(
        select(Finding)
        .where(
            Finding.category == finding.category,
            Finding.id != finding.id,
        )
        .order_by(Finding.created_at.desc())
        .limit(10)
    )
    local_similar = [
        {
            "id": f.id,
            "assessment_id": f.assessment_id,
            "severity": f.severity,
            "category": f.category,
            "title": f.title,
            "agent": f.agent,
            "created_at": f.created_at.isoformat() if f.created_at else None,
            "metadata": {
                "title": f.title,
                "severity": f.severity,
                "category": f.category,
            },
        }
        for f in similar_result.scalars().all()
    ]

    analysis = await analyze_finding(
        assessment=assessment,
        finding=finding,
        local_similar_findings=local_similar,
        focus=body.focus if body else None,
    )
    return AnalyzeFindingResponse(
        finding_id=finding.id,
        assessment_id=assessment.id,
        mode=assessment.mode,
        analysis_source=analysis.get("analysis_source", "fallback"),
        summary=analysis.get("summary", ""),
        impact=analysis.get("impact", ""),
        possible_root_cause=analysis.get("possible_root_cause", ""),
        mode_guidance=analysis.get("mode_guidance", ""),
        where_to_fix=analysis.get("where_to_fix"),
        actions=analysis.get("actions", []),
        memory_similar_results_count=analysis.get("memory_similar_results_count", 0),
        memory_similar_results=analysis.get("memory_similar_results", []),
        error=analysis.get("error"),
    )
