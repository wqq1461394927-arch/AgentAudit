"""
Cluster Registry - Manages vulnerability clusters, storing groupings
and maintaining the relationship between reports and their VUL-IDs.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

try:
    from ..models import Cluster, ClusterReport, Dispute, Report
except ImportError:
    from models import Cluster, ClusterReport, Dispute, Report
from .vul_id_generator import vul_id_generator


class ClusterRegistry:
    """Registry for creating, querying, and managing vulnerability clusters."""

    async def create_cluster(
        self,
        db: AsyncSession,
        task_id: int,
        report_refs: list[dict],
    ) -> Cluster:
        """Create a new vulnerability cluster.

        Args:
            db: Database session.
            task_id: Task ID.
            report_refs: List of dicts with report_id (str), submitter (str),
                         commit_time (datetime), similarity_score (float, optional).

        Returns:
            The created Cluster ORM object.
        """
        # Sort reports by commit_time for ranking
        sorted_reports = sorted(report_refs, key=lambda r: r["commit_time"])

        # Generate VUL-ID
        vul_id = vul_id_generator.generate(task_id)

        # Determine title, severity from first (and most complete) report
        first_report = await db.execute(
            select(Report).where(Report.report_id == sorted_reports[0]["report_id"])
        )
        first_report = first_report.scalar_one_or_none()

        if first_report:
            title = first_report.title
            severity = first_report.severity or "Medium"
            vuln_type = first_report.vulnerability_type
            submitter = first_report.submitter
            commit_time = first_report.commit_time
        else:
            title = sorted_reports[0].get("title", "Unknown")
            severity = "Medium"
            vuln_type = ""
            submitter = sorted_reports[0].get("submitter", "")
            commit_time = sorted_reports[0].get("commit_time")

        cluster = Cluster(
            id=uuid.uuid4(),
            task_id=task_id,
            vul_id=vul_id,
            title=title,
            vulnerability_type=vuln_type,
            severity=severity,
            first_submitter=submitter,
            first_commit_time=commit_time,
            status="pending_confirmation",
        )
        db.add(cluster)

        # Create cluster_report links with ranking
        for rank, ref in enumerate(sorted_reports, start=1):
            report = await db.execute(
                select(Report).where(Report.report_id == ref["report_id"])
            )
            report = report.scalar_one_or_none()
            if report:
                cr = ClusterReport(
                    cluster_id=cluster.id,
                    report_id=report.id,
                    rank=rank,
                    similarity_score=ref.get("similarity_score"),
                )
                db.add(cr)

        await db.commit()
        await db.refresh(cluster)
        return cluster

    async def get_cluster(
        self, db: AsyncSession, cluster_id: uuid.UUID
    ) -> Cluster | None:
        """Get a cluster by ID with reports loaded."""
        result = await db.execute(
            select(Cluster)
            .where(Cluster.id == cluster_id)
            .options(selectinload(Cluster.cluster_reports).selectinload(ClusterReport.report))
        )
        return result.scalar_one_or_none()

    async def get_clusters_by_task(
        self, db: AsyncSession, task_id: int
    ) -> list[Cluster]:
        """Get all clusters for a task."""
        result = await db.execute(
            select(Cluster)
            .where(Cluster.task_id == task_id)
            .options(selectinload(Cluster.cluster_reports).selectinload(ClusterReport.report))
            .order_by(Cluster.vul_id)
        )
        return list(result.scalars().all())

    async def update_cluster_status(
        self,
        db: AsyncSession,
        cluster_id: uuid.UUID,
        status: str,
    ) -> Cluster | None:
        """Update cluster status (e.g., confirm, finalize)."""
        cluster = await self.get_cluster(db, cluster_id)
        if not cluster:
            return None

        cluster.status = status
        if status == "finalized":
            cluster.finalized_at = datetime.now(timezone.utc)

            # Generate cluster root hash
            report_ids = [
                cr.report.report_id
                for cr in sorted(cluster.cluster_reports, key=lambda x: x.rank)
            ]
            cluster.cluster_root_hash = vul_id_generator.generate_cluster_root_hash(
                cluster.vul_id, report_ids, cluster.finalized_at
            )

        await db.commit()
        await db.refresh(cluster)
        return cluster

    async def get_cluster_reports(
        self, db: AsyncSession, cluster_id: uuid.UUID
    ) -> list[ClusterReport]:
        """Get all reports in a cluster, ranked by commit time."""
        result = await db.execute(
            select(ClusterReport)
            .where(ClusterReport.cluster_id == cluster_id)
            .options(selectinload(ClusterReport.report))
            .order_by(ClusterReport.rank)
        )
        return list(result.scalars().all())

    async def get_pending_clusters(
        self, db: AsyncSession, task_id: int
    ) -> list[Cluster]:
        """Get clusters pending human confirmation."""
        result = await db.execute(
            select(Cluster)
            .where(
                Cluster.task_id == task_id,
                Cluster.status == "pending_confirmation",
            )
            .options(selectinload(Cluster.cluster_reports).selectinload(ClusterReport.report))
            .order_by(Cluster.vul_id)
        )
        return list(result.scalars().all())


    REWARD_PERCENTAGES = {1: 70, 2: 20, 3: 10}

    async def get_reward_distribution(
        self, db: AsyncSession, cluster_id: uuid.UUID
    ) -> list[dict]:
        """Get reward distribution for reports in a cluster.

        Returns list of dicts with report_id, submitter, rank, reward_percentage.
        Ranks beyond 3rd get 0%.
        """
        cluster_reports = await self.get_cluster_reports(db, cluster_id)
        result = []
        for cr in sorted(cluster_reports, key=lambda x: x.rank):
            percentage = self.REWARD_PERCENTAGES.get(cr.rank, 0)
            result.append({
                "report_id": cr.report.report_id,
                "submitter": cr.report.submitter,
                "rank": cr.rank,
                "reward_percentage": percentage,
            })
        return result


cluster_registry = ClusterRegistry()
