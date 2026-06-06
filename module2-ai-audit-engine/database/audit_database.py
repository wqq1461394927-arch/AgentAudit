"""
AgentAudit 模块2 — Audit Database 审计数据库层

内存实现（MVP阶段），生产环境可替换为 Supabase + pgvector。
记录所有 Agent 输出，供后续模块查询。
"""
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional
from datetime import datetime, timezone


@dataclass
class AuditRecord:
    task_id: str
    agent_id: str
    agent_name: str
    contract_hash: str
    vulnerabilities: List[dict] = field(default_factory=list)
    raw_confidence_sum: int = 0
    created_at: str = ""

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.now(timezone.utc).isoformat()


class AuditDatabase:
    """审计数据库（内存版）"""

    def __init__(self):
        self._records: Dict[str, List[AuditRecord]] = {}
        self._calibrations: Dict[str, float] = {}

    def save_record(self, record: AuditRecord):
        if record.task_id not in self._records:
            self._records[record.task_id] = []
        self._records[record.task_id].append(record)

    def get_task_records(self, task_id: str) -> List[AuditRecord]:
        """获取某任务的所有 Agent 审计结果"""
        return self._records.get(task_id, [])

    def get_agent_history(self, agent_id: str) -> List[AuditRecord]:
        """获取某 Agent 的全部历史审计"""
        results = []
        for records in self._records.values():
            for r in records:
                if r.agent_id == agent_id:
                    results.append(r)
        return results

    def update_calibration(self, agent_id: str, calibration: float):
        self._calibrations[agent_id] = calibration

    def get_calibration(self, agent_id: str) -> float:
        return self._calibrations.get(agent_id, 1.0)

    def get_all_tasks(self) -> List[str]:
        return list(self._records.keys())
