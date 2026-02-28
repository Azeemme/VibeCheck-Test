from datetime import datetime

from pydantic import BaseModel, ConfigDict

from api.schemas.pagination import PaginationMeta


class FindingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    assessment_id: str
    severity: str
    category: str
    title: str
    description: str
    location: dict | None = None
    evidence: dict | None = None
    remediation: str
    agent: str | None = None
    created_at: datetime


class FindingListResponse(BaseModel):
    data: list[FindingResponse]
    pagination: PaginationMeta


class AnalyzeFindingRequest(BaseModel):
    focus: str | None = None


class AnalyzeFindingResponse(BaseModel):
    finding_id: str
    assessment_id: str
    mode: str
    analysis_source: str
    summary: str
    impact: str
    possible_root_cause: str
    mode_guidance: str
    where_to_fix: dict | None = None
    actions: list[str]
    memory_similar_results_count: int = 0
    memory_similar_results: list[dict] = []
    error: str | None = None
