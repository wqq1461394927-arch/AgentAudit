"""
Human Review Panel - Manages the human confirmation workflow for clustering results.
AI does the efficiency work; humans take final responsibility.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

try:
    from ..models import Cluster, ClusterReport
except ImportError:
    from models import Cluster, ClusterReport
from .vul_id_generator import vul_id_generator


class HumanReviewPanel:
    """Human review and confirmation panel for vulnerability clusters."""

    VALID_ACTIONS = {"confirm", "split", "merge", "reject"}

    async def review_action(
        self,
        db: AsyncSession,
        cluster_id: uuid.UUID,
        action: str,
        reviewer: str,
        note: str | None = None,
    ) -> dict:
        """Execute a human review action on a cluster.

        Args:
            db: Database session.
            cluster_id: The cluster to review.
            action: One of 'confirm', 'split', 'merge', 'reject'.
            reviewer: Name/address of the reviewer.
            note: Optional review note.

        Returns:
            Dict with cluster_id, action, previous_status, new_status, message.
        """
        if action not in self.VALID_ACTIONS:
            return {
                "cluster_id": str(cluster_id),
                "action": action,
                "previous_status": "",
                "new_status": "",
                "message": f"Invalid action. Must be one of: {', '.join(sorted(self.VALID_ACTIONS))}",
            }

        result = await db.execute(
            select(Cluster)
            .where(Cluster.id == cluster_id)
            .options(
                selectinload(Cluster.cluster_reports).selectinload(ClusterReport.report)
            )
        )
        cluster = result.scalar_one_or_none()
        if not cluster:
            return {
                "cluster_id": str(cluster_id),
                "action": action,
                "previous_status": "",
                "new_status": "",
                "message": "Cluster not found",
            }

        previous_status = cluster.status

        if action == "confirm":
            cluster.status = "finalized"
            cluster.finalized_at = datetime.now(timezone.utc)

            report_ids = [
                cr.report.report_id
                for cr in sorted(cluster.cluster_reports, key=lambda x: x.rank)
            ]
            cluster.cluster_root_hash = vul_id_generator.generate_cluster_root_hash(
                cluster.vul_id, report_ids, cluster.finalized_at
            )

            new_status = "finalized"
            message = f"Cluster {cluster.vul_id} confirmed and finalized by {reviewer}"

        elif action == "reject":
            cluster.status = "rejected"
            new_status = "rejected"
            message = f"Cluster {cluster.vul_id} rejected by {reviewer}"

        elif action == "split":
            cluster.status = "split"
            new_status = "split"
            message = (
                f"Cluster {cluster.vul_id} marked for splitting by {reviewer}. "
                "Reports need manual reassignment."
            )

        elif action == "merge":
            cluster.status = "pending_merge"
            new_status = "pending_merge"
            message = f"Cluster {cluster.vul_id} marked for merging by {reviewer}"

        await db.commit()
        await db.refresh(cluster)

        return {
            "cluster_id": str(cluster_id),
            "action": action,
            "previous_status": previous_status,
            "new_status": new_status,
            "message": message,
        }

    async def get_review_queue(
        self, db: AsyncSession, task_id: int | None = None
    ) -> list[Cluster]:
        """Get clusters pending human review."""
        query = select(Cluster).where(
            Cluster.status.in_(["pending_confirmation", "disputed"])
        )
        if task_id is not None:
            query = query.where(Cluster.task_id == task_id)

        query = query.options(
            selectinload(Cluster.cluster_reports).selectinload(ClusterReport.report)
        ).order_by(Cluster.created_at)

        result = await db.execute(query)
        return list(result.scalars().all())


human_review = HumanReviewPanel()
