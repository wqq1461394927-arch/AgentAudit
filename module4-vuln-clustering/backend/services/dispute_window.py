"""Dispute Window - Manages the dispute period after clustering results are published,
allowing stakeholders to challenge incorrect cluster assignments.
"""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

try:
    from ..config import settings
except ImportError:
    from config import settings
try:
    from ..models import Cluster, Dispute
except ImportError:
    from models import Cluster, Dispute


class DisputeWindow:
    """Manages the dispute window for clustering results."""

    def __init__(self):
        self.window_hours = settings.dispute_window_hours

    def is_window_open(self, cluster: Cluster) -> bool:
        """Check if the dispute window is still open for a cluster.

        Returns True if the cluster is in confirmed state and the
        dispute window hasn't expired yet.
        """
        if cluster.status not in ("confirmed", "pending_confirmation"):
            return False

        now = datetime.now(timezone.utc)
        if cluster.finalized_at:
            return False  # Already finalized

        # Window is open if cluster was created within the dispute window
        window_end = cluster.created_at.replace(
            tzinfo=timezone.utc
        ) + timedelta(hours=self.window_hours)

        return now <= window_end

    def get_window_remaining(self, cluster: Cluster) -> float:
        """Get remaining hours in the dispute window."""
        if cluster.status == "finalized":
            return 0.0

        now = datetime.now(timezone.utc)
        window_end = cluster.created_at.replace(
            tzinfo=timezone.utc
        ) + timedelta(hours=self.window_hours)

        remaining = (window_end - now).total_seconds() / 3600
        return max(0.0, remaining)

    async def create_dispute(
        self,
        db: AsyncSession,
        cluster_id: uuid.UUID,
        dispute_type: str,
        description: str,
        disputed_by: str,
        proposed_change: str | None = None,
    ) -> Dispute | None:
        """Create a dispute against a cluster.

        Valid dispute types: split, merge, severity, rank.
        """
        # Validate cluster exists
        result = await db.execute(select(Cluster).where(Cluster.id == cluster_id))
        cluster = result.scalar_one_or_none()
        if not cluster:
            return None

        if not self.is_window_open(cluster):
            return None  # Window closed

        dispute = Dispute(
            id=uuid.uuid4(),
            cluster_id=cluster_id,
            dispute_type=dispute_type,
            description=description,
            proposed_change=proposed_change,
            disputed_by=disputed_by,
            status="pending",
        )
        db.add(dispute)
        await db.commit()
        await db.refresh(dispute)
        return dispute

    async def get_disputes_for_cluster(
        self, db: AsyncSession, cluster_id: uuid.UUID
    ) -> list[Dispute]:
        """Get all disputes for a cluster."""
        result = await db.execute(
            select(Dispute)
            .where(Dispute.cluster_id == cluster_id)
            .order_by(Dispute.created_at)
        )
        return list(result.scalars().all())

    async def resolve_dispute(
        self,
        db: AsyncSession,
        dispute_id: uuid.UUID,
        resolution: str,
        resolved_by: str,
        resolution_note: str | None = None,
    ) -> Dispute | None:
        """Resolve a dispute (accept or reject)."""
        result = await db.execute(select(Dispute).where(Dispute.id == dispute_id))
        dispute = result.scalar_one_or_none()
        if not dispute:
            return None

        dispute.status = resolution
        dispute.resolved_at = datetime.now(timezone.utc)
        dispute.resolved_by = resolved_by
        dispute.resolution_note = resolution_note
        await db.commit()
        await db.refresh(dispute)
        return dispute

    async def get_pending_disputes(self, db: AsyncSession) -> list[Dispute]:
        """Get all unresolved disputes."""
        result = await db.execute(
            select(Dispute)
            .where(Dispute.status == "pending")
            .order_by(Dispute.created_at)
        )
        return list(result.scalars().all())


dispute_window = DisputeWindow()
