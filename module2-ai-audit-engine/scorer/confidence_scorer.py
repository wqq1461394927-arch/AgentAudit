"""
AgentAudit 模块2 — Confidence Scorer 置信度计算器

计算漏洞可信度，是整个协议最核心的模块之一。

公式: 最终置信度 = LLM置信度 × 历史校准系数

例如:
  LLM 返回 confidence=90%, Agent 历史正确率=80%
  最终 confidence = 90% × 0.8 = 72%

历史数据积累后可用于:
  - Agent 排名
  - 奖励权重计算
  - 信誉评分
"""
from dataclasses import dataclass
from typing import Dict, List, Optional
from datetime import datetime


@dataclass
class AgentTrackRecord:
    agent_id: str
    total_audits: int = 0
    correct_findings: int = 0       # 确认有效的漏洞数
    false_positives: int = 0        # 误报数
    calibration_score: float = 1.0  # 校准系数 (0-1)

    @property
    def accuracy(self) -> float:
        """历史准确率"""
        if self.total_audits == 0:
            return 1.0
        return self.correct_findings / self.total_audits

    def update(self, was_correct: bool):
        """更新 Agent 记录"""
        self.total_audits += 1
        if was_correct:
            self.correct_findings += 1
        else:
            self.false_positives += 1
        self.calibration_score = self.accuracy


@dataclass
class ScoredVulnerability:
    title: str
    severity: str
    raw_confidence: int          # LLM 原始置信度
    calibration_coefficient: float  # Agent 历史校准系数
    final_confidence: int        # 最终置信度 = raw × calibration

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "severity": self.severity,
            "raw_confidence": self.raw_confidence,
            "calibration_coefficient": round(self.calibration_coefficient, 3),
            "final_confidence": self.final_confidence,
        }


class ConfidenceScorer:
    """置信度计算引擎"""

    def __init__(self):
        self._track_records: Dict[str, AgentTrackRecord] = {}

    def get_or_create_record(self, agent_id: str) -> AgentTrackRecord:
        if agent_id not in self._track_records:
            self._track_records[agent_id] = AgentTrackRecord(agent_id=agent_id)
        return self._track_records[agent_id]

    def score(
        self,
        agent_id: str,
        raw_confidence: int,
        title: str = "",
        severity: str = "Medium",
    ) -> ScoredVulnerability:
        """
        计算最终置信度

        Args:
            agent_id: Agent 标识
            raw_confidence: LLM 返回的原始置信度
            title: 漏洞标题
            severity: 严重等级
        """
        record = self.get_or_create_record(agent_id)
        calibration = record.calibration_score
        final = max(0, min(100, int(raw_confidence * calibration)))

        return ScoredVulnerability(
            title=title,
            severity=severity,
            raw_confidence=raw_confidence,
            calibration_coefficient=calibration,
            final_confidence=final,
        )

    def feedback(self, agent_id: str, was_correct: bool):
        """
        结算后反馈：Agent 的发现最终是真实漏洞还是误报
        用于更新历史校准系数
        """
        record = self.get_or_create_record(agent_id)
        record.update(was_correct)

    def get_agent_calibration(self, agent_id: str) -> float:
        """获取 Agent 当前校准系数"""
        return self.get_or_create_record(agent_id).calibration_score

    def get_all_records(self) -> Dict[str, AgentTrackRecord]:
        return dict(self._track_records)
