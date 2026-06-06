"""
VUL-ID Generator - Generates unique vulnerability identifiers
for each clustered group of reports.
"""
import hashlib
from datetime import datetime, timezone


class VULIDGenerator:
    """Generates unique VUL-IDs for vulnerability clusters."""

    def __init__(self):
        self._counters: dict[int, int] = {}  # task_id -> next counter

    def generate(self, task_id: int) -> str:
        """Generate a VUL-ID for a new vulnerability in a task.

        Format: TASK-{task_id}-VUL-{seq:03d}

        Args:
            task_id: The task ID.

        Returns:
            A unique VUL-ID string.
        """
        if task_id not in self._counters:
            self._counters[task_id] = 1
        else:
            self._counters[task_id] += 1

        seq = self._counters[task_id]
        return f"TASK-{task_id}-VUL-{seq:03d}"

    @staticmethod
    def generate_cluster_root_hash(
        vul_id: str,
        report_ids: list[str],
        timestamp: datetime,
    ) -> str:
        """Generate a deterministic hash for on-chain verification.

        The cluster root hash commits to the VUL-ID, all report IDs, and
        the finalization timestamp, allowing on-chain verification that
        the clustering result hasn't been tampered with.

        Args:
            vul_id: The VUL-ID.
            report_ids: Sorted list of report IDs in this cluster.
            timestamp: Finalization time.

        Returns:
            Hex-encoded SHA256 hash.
        """
        # Sort for determinism
        sorted_ids = sorted(report_ids)
        ts_int = int(timestamp.timestamp())

        content = f"{vul_id}|{','.join(sorted_ids)}|{ts_int}"
        return hashlib.sha256(content.encode()).hexdigest()

    @staticmethod
    def generate_vul_id_hash(vul_id: str) -> str:
        """Generate a hash of the VUL-ID for on-chain storage."""
        return hashlib.sha256(vul_id.encode()).hexdigest()

    def reset_task(self, task_id: int):
        """Reset counter for a task (e.g., for re-clustering)."""
        self._counters.pop(task_id, None)


vul_id_generator = VULIDGenerator()
