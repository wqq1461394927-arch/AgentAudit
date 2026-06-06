"""
Vulnerability Clustering Module (Module 4) - FastAPI Application

Provides APIs for:
- Report normalization
- Vulnerability clustering pipeline
- Cluster management
- Dispute window
- Human review panel
"""
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .database import get_db, init_db
from .models import Cluster, ClusterReport, Dispute, Report, SimilarityPair
from .schemas import (
    ClusterListResponse,
    ClusterReportInfo,
    ClusterResponse,
    ClusteringRequest,
    ClusteringResponse,
    DisputeCreate,
    DisputeResponse,
    ReportResponse,
    ReviewAction,
    ReviewResponse,
    SimilarityPairResponse,
)
from .services.cluster_registry import cluster_registry
from .services.dispute_window import dispute_window
from .services.human_review import human_review
from .services.normalizer import normalizer
from .services.pipeline import run_clustering_pipeline


def _build_cluster_response(c: Cluster) -> ClusterResponse:
    """Build a ClusterResponse from an ORM Cluster object (reports must be eagerly loaded)."""
    reports_info = []
    for cr in sorted(c.cluster_reports, key=lambda x: x.rank):
        reports_info.append(
            ClusterReportInfo(
                report_id=cr.report.report_id,
                submitter=cr.report.submitter,
                commit_time=cr.report.commit_time,
                rank=cr.rank,
                similarity_score=cr.similarity_score,
            )
        )

    return ClusterResponse(
        id=c.id,
        task_id=c.task_id,
        vul_id=c.vul_id,
        title=c.title,
        vulnerability_type=c.vulnerability_type,
        severity=c.severity,
        description=c.description,
        first_submitter=c.first_submitter,
        first_commit_time=c.first_commit_time,
        status=c.status,
        cluster_root_hash=c.cluster_root_hash,
        finalized_at=c.finalized_at,
        reports=reports_info,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


def _build_cluster_summary(c: Cluster) -> dict:
    """Build a lightweight summary dict for pending/review queue display."""
    reports_info = []
    for cr in sorted(c.cluster_reports, key=lambda x: x.rank):
        report = cr.report
        reports_info.append(
            {
                "report_id": report.report_id,
                "submitter": report.submitter,
                "commit_time": report.commit_time.isoformat(),
                "rank": cr.rank,
                "similarity_score": cr.similarity_score,
                "llm_judge_result": cr.llm_judge_result,
                "affected_function": report.affected_function,
                "root_cause": report.root_cause,
            }
        )

    return {
        "id": str(c.id),
        "vul_id": c.vul_id,
        "title": c.title,
        "vulnerability_type": c.vulnerability_type,
        "severity": c.severity,
        "first_submitter": c.first_submitter,
        "first_commit_time": c.first_commit_time.isoformat() if c.first_commit_time else None,
        "status": c.status,
        "reports": reports_info,
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle. Gracefully handles missing database."""
    try:
        await init_db()
        print("Database initialized successfully")
    except Exception as e:
        print(f"Database not available (running in degraded mode): {e}")
    yield


app = FastAPI(
    title="Vulnerability Clustering Module",
    description="Module 4: AI-powered vulnerability clustering and VUL-ID generation",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== Report Endpoints ====================


@app.get("/api/reports/{report_id}", response_model=ReportResponse)
async def get_report(report_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single report by report_id (e.g., R001)."""
    result = await db.execute(select(Report).where(Report.report_id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@app.get("/api/reports", response_model=list[ReportResponse])
async def list_reports(
    task_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List reports, optionally filtered by task_id."""
    query = select(Report)
    if task_id is not None:
        query = query.where(Report.task_id == task_id)
    query = query.order_by(Report.commit_time)
    result = await db.execute(query)
    return result.scalars().all()


@app.post("/api/reports/normalize")
async def normalize_report(title: str, description: str = ""):
    """Normalize a single vulnerability report using LLM."""
    result = await normalizer.normalize(title, description)
    return result


# ==================== Clustering Endpoints ====================


@app.post("/api/cluster/run", response_model=ClusteringResponse)
async def run_clustering(
    request: ClusteringRequest,
    db: AsyncSession = Depends(get_db),
):
    """Run the full clustering pipeline on revealed reports.

    Pipeline: Normalize → Embed → Similarity → LLM Judge → Cluster → VUL-ID
    """
    reports_input = [
        {
            "report_id": r.report_id,
            "title": r.title,
            "description": r.description,
            "submitter": r.submitter,
            "commit_time": r.commit_time,
        }
        for r in request.reports
    ]

    clusters = await run_clustering_pipeline(
        db=db,
        task_id=request.task_id,
        reports_input=reports_input,
        contract_context=request.contract_context,
    )

    return ClusteringResponse(
        task_id=request.task_id,
        clusters=[
            ClusterResponse(
                id=uuid.UUID(c["id"]),
                task_id=c["task_id"],
                vul_id=c["vul_id"],
                title=c["title"],
                vulnerability_type=c.get("vulnerability_type"),
                severity=c["severity"],
                first_submitter=c.get("first_submitter"),
                first_commit_time=c.get("first_commit_time"),
                status=c["status"],
                reports=[
                    ClusterReportInfo(**r) for r in c["reports"]
                ],
            )
            for c in clusters
        ],
    )


@app.get("/api/clusters/{task_id}", response_model=ClusterListResponse)
async def list_clusters(task_id: int, db: AsyncSession = Depends(get_db)):
    """Get all clusters for a task."""
    clusters = await cluster_registry.get_clusters_by_task(db, task_id)
    return ClusterListResponse(
        task_id=task_id,
        clusters=[_build_cluster_response(c) for c in clusters],
    )


@app.get("/api/clusters/{task_id}/pending")
async def list_pending_clusters(task_id: int, db: AsyncSession = Depends(get_db)):
    """Get clusters pending human confirmation."""
    clusters = await cluster_registry.get_pending_clusters(db, task_id)
    return {
        "task_id": task_id,
        "pending_clusters": [_build_cluster_summary(c) for c in clusters],
    }


# ==================== Similarity Endpoints ====================


@app.get("/api/similarities/{task_id}", response_model=list[SimilarityPairResponse])
async def get_similarities(task_id: int, db: AsyncSession = Depends(get_db)):
    """Get all similarity pairs for reports in a task."""
    from sqlalchemy.orm import joinedload

    result = await db.execute(
        select(SimilarityPair)
        .join(Report, SimilarityPair.report_a_id == Report.id)
        .where(Report.task_id == task_id)
        .options(
            joinedload(SimilarityPair.report_a),
            joinedload(SimilarityPair.report_b),
        )
    )
    pairs = result.unique().scalars().all()

    return [
        SimilarityPairResponse(
            report_a_id=sp.report_a.report_id,
            report_b_id=sp.report_b.report_id,
            cosine_similarity=sp.cosine_similarity,
            llm_judgment=sp.llm_judgment,
            is_same_vulnerability=sp.is_same_vulnerability,
        )
        for sp in pairs
    ]


# ==================== Dispute Endpoints ====================


@app.post("/api/disputes", response_model=DisputeResponse)
async def create_dispute(
    dispute: DisputeCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a dispute against a clustering result."""
    result = await dispute_window.create_dispute(
        db=db,
        cluster_id=dispute.cluster_id,
        dispute_type=dispute.dispute_type,
        description=dispute.description,
        disputed_by=dispute.disputed_by,
        proposed_change=dispute.proposed_change,
    )
    if not result:
        raise HTTPException(status_code=400, detail="Dispute window closed or cluster not found")
    return result


@app.get("/api/disputes/{cluster_id}", response_model=list[DisputeResponse])
async def get_disputes(
    cluster_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get all disputes for a cluster."""
    return await dispute_window.get_disputes_for_cluster(db, cluster_id)


@app.get("/api/disputes", response_model=list[DisputeResponse])
async def list_pending_disputes(db: AsyncSession = Depends(get_db)):
    """Get all pending disputes across all clusters."""
    return await dispute_window.get_pending_disputes(db)


# ==================== Human Review Endpoints ====================


@app.post("/api/review", response_model=ReviewResponse)
async def review_action(
    review: ReviewAction,
    db: AsyncSession = Depends(get_db),
):
    """Execute a human review action: confirm, split, merge, or reject a cluster."""
    result = await human_review.review_action(
        db=db,
        cluster_id=review.cluster_id,
        action=review.action,
        reviewer=review.reviewer,
        note=review.note,
    )
    return ReviewResponse(**result)


@app.get("/api/review/queue")
async def review_queue(task_id: Optional[int] = Query(None), db: AsyncSession = Depends(get_db)):
    """Get clusters pending human review."""
    clusters = await human_review.get_review_queue(db, task_id)
    return {"review_queue": [_build_cluster_summary(c) for c in clusters]}


# ==================== Health Check ====================


@app.get("/api/health")
async def health():
    return {"status": "ok", "module": "vulnerability_clustering"}


@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    """Serve the test frontend panel."""
    frontend_path = Path(__file__).resolve().parent.parent / "frontend" / "index.html"
    if not frontend_path.exists():
        raise HTTPException(404, "Frontend not found")
    return HTMLResponse(frontend_path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=settings.host, port=settings.port)
