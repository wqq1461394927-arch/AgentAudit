"""SQLAlchemy ORM models for Vulnerability Clustering."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Report(Base):
    """A normalized vulnerability report submitted by an agent."""

    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    task_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    report_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)

    # Original
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # Normalized fields
    vulnerability_type: Mapped[str] = mapped_column(String(128), nullable=True)
    affected_contract: Mapped[str] = mapped_column(String(256), nullable=True)
    affected_function: Mapped[str] = mapped_column(String(256), nullable=True)
    root_cause: Mapped[str] = mapped_column(Text, nullable=True)
    attack_path: Mapped[str] = mapped_column(Text, nullable=True)
    impact: Mapped[str] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String(32), nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    fix_suggestion: Mapped[str] = mapped_column(Text, nullable=True)

    # Embedding vector
    embedding: Mapped[list[float]] = mapped_column(JSON, nullable=True)

    # Metadata
    submitter: Mapped[str] = mapped_column(String(128), nullable=False)
    commit_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_normalized: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    cluster_memberships: Mapped[list["ClusterReport"]] = relationship(
        back_populates="report", cascade="all, delete-orphan"
    )


class Cluster(Base):
    """A vulnerability cluster grouping similar reports under one VUL-ID."""

    __tablename__ = "clusters"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    task_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    vul_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    vulnerability_type: Mapped[str] = mapped_column(String(128), nullable=True)
    severity: Mapped[str] = mapped_column(String(32), nullable=False, default="Medium")
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # First submitter info
    first_submitter: Mapped[str] = mapped_column(String(128), nullable=True)
    first_commit_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Status: pending_confirmation | confirmed | disputed | finalized
    status: Mapped[str] = mapped_column(
        String(32), default="pending_confirmation", index=True
    )

    # On-chain verification
    cluster_root_hash: Mapped[str] = mapped_column(String(128), nullable=True)
    finalized_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    cluster_reports: Mapped[list["ClusterReport"]] = relationship(
        back_populates="cluster", cascade="all, delete-orphan"
    )
    disputes: Mapped[list["Dispute"]] = relationship(
        back_populates="cluster", cascade="all, delete-orphan"
    )


class ClusterReport(Base):
    """Join table linking reports to clusters with ranking."""

    __tablename__ = "cluster_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    cluster_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clusters.id", ondelete="CASCADE"), nullable=False
    )
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reports.id", ondelete="CASCADE"), nullable=False
    )
    # Rank within cluster (1 = first submitter)
    rank: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    similarity_score: Mapped[float] = mapped_column(Float, nullable=True)
    llm_judge_result: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    cluster: Mapped["Cluster"] = relationship(back_populates="cluster_reports")
    report: Mapped["Report"] = relationship(back_populates="cluster_memberships")


class SimilarityPair(Base):
    """Pre-computed similarity scores between report pairs."""

    __tablename__ = "similarity_pairs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    report_a_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reports.id", ondelete="CASCADE"), nullable=False
    )
    report_b_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reports.id", ondelete="CASCADE"), nullable=False
    )
    cosine_similarity: Mapped[float] = mapped_column(Float, nullable=False)
    llm_judgment: Mapped[str] = mapped_column(Text, nullable=True)  # JSON string
    is_same_vulnerability: Mapped[bool] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    report_a: Mapped["Report"] = relationship(foreign_keys=[report_a_id])
    report_b: Mapped["Report"] = relationship(foreign_keys=[report_b_id])


class Dispute(Base):
    """Dispute raised against a cluster decision."""

    __tablename__ = "disputes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    cluster_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clusters.id", ondelete="CASCADE"), nullable=False
    )

    # Dispute type: split | merge | severity | rank
    dispute_type: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    proposed_change: Mapped[str] = mapped_column(Text, nullable=True)

    # Status: pending | accepted | rejected
    status: Mapped[str] = mapped_column(String(32), default="pending")

    disputed_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    resolved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[str] = mapped_column(String(128), nullable=True)
    resolution_note: Mapped[str] = mapped_column(Text, nullable=True)

    # Relationships
    cluster: Mapped["Cluster"] = relationship(back_populates="disputes")
