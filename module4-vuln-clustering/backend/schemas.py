"""Pydantic schemas for API request/response validation."""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---- Report Schemas ----

class ReportInput(BaseModel):
    """Raw report submitted for clustering."""
    report_id: str = Field(..., description="Unique report identifier (e.g. R001)")
    title: str = Field(..., description="Report title")
    description: str = Field(default="", description="Full vulnerability description")
    submitter: str = Field(..., description="Submitter address or agent name")
    commit_time: datetime = Field(..., description="Commit / submission timestamp")


class NormalizedReport(BaseModel):
    """LLM-normalized vulnerability report."""
    title: str
    vulnerability_type: str
    affected_contract: str = ""
    affected_function: str = ""
    root_cause: str = ""
    attack_path: str = ""
    impact: str = ""
    severity: str = "Medium"
    confidence: float = 0.0
    fix_suggestion: str = ""


class ReportResponse(BaseModel):
    """Response model for a report."""
    id: uuid.UUID
    task_id: int
    report_id: str
    title: str
    description: Optional[str] = None
    vulnerability_type: Optional[str] = None
    affected_contract: Optional[str] = None
    affected_function: Optional[str] = None
    root_cause: Optional[str] = None
    attack_path: Optional[str] = None
    impact: Optional[str] = None
    severity: Optional[str] = None
    confidence: float
    fix_suggestion: Optional[str] = None
    submitter: str
    commit_time: datetime
    is_normalized: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Cluster Schemas ----

class ClusterReportInfo(BaseModel):
    """Report info within a cluster."""
    report_id: str
    submitter: str
    commit_time: datetime
    rank: int
    similarity_score: Optional[float] = None

    model_config = {"from_attributes": True}


class ClusterResponse(BaseModel):
    """Response model for a vulnerability cluster."""
    id: uuid.UUID
    task_id: int
    vul_id: str
    title: str
    vulnerability_type: Optional[str] = None
    severity: str
    description: Optional[str] = None
    first_submitter: Optional[str] = None
    first_commit_time: Optional[datetime] = None
    status: str
    cluster_root_hash: Optional[str] = None
    finalized_at: Optional[datetime] = None
    reports: list[ClusterReportInfo] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ClusterListResponse(BaseModel):
    """Response for listing clusters of a task."""
    task_id: int
    clusters: list[ClusterResponse]


# ---- Clustering Request / Response ----

class ClusteringRequest(BaseModel):
    """Request to run clustering on revealed reports for a task."""
    task_id: int = Field(..., description="Task ID to cluster reports for")
    reports: list[ReportInput] = Field(..., description="Revealed reports to cluster")
    contract_context: str = Field(default="", description="Optional contract source code for context")


class ClusteringResponse(BaseModel):
    """Response after running clustering pipeline."""
    task_id: int
    clusters: list[ClusterResponse]
    message: str = "Clustering completed"


# ---- Similarity Schemas ----

class SimilarityPairResponse(BaseModel):
    """Similarity score between two reports."""
    report_a_id: str
    report_b_id: str
    cosine_similarity: float
    llm_judgment: Optional[str] = None
    is_same_vulnerability: Optional[bool] = None

    model_config = {"from_attributes": True}


# ---- Dispute Schemas ----

class DisputeCreate(BaseModel):
    """Request to create a dispute."""
    cluster_id: uuid.UUID
    dispute_type: str = Field(..., description="split | merge | severity | rank")
    description: str = Field(..., description="Reason for dispute")
    proposed_change: Optional[str] = None
    disputed_by: str = Field(..., description="Who is disputing")


class DisputeResponse(BaseModel):
    """Response for a dispute."""
    id: uuid.UUID
    cluster_id: uuid.UUID
    dispute_type: str
    description: str
    proposed_change: Optional[str] = None
    status: str
    disputed_by: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolution_note: Optional[str] = None

    model_config = {"from_attributes": True}


# ---- Human Review Schemas ----

class ReviewAction(BaseModel):
    """Human review action on a cluster."""
    cluster_id: uuid.UUID
    action: str = Field(..., description="confirm | split | merge | reject")
    reviewer: str = Field(..., description="Reviewer name/address")
    note: Optional[str] = None


class ReviewResponse(BaseModel):
    """Response after a review action."""
    cluster_id: uuid.UUID
    action: str
    previous_status: str
    new_status: str
    message: str
