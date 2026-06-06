"""
AgentAudit 模块2 — Report Generator 报告生成器

生成标准化漏洞报告，支持 JSON / Markdown 双格式。
"""
import json
from dataclasses import dataclass, field, asdict
from typing import List
from datetime import datetime


@dataclass
class ReportVulnerability:
    report_id: str
    agent_id: str
    agent_name: str
    title: str
    severity: str
    confidence: int
    final_confidence: int
    calibration_coefficient: float = 1.0
    location: str = ""
    description: str = ""
    impact: str = ""
    recommendation: str = ""


@dataclass
class AuditReport:
    task_id: str
    contract_code_snippet: str   # 前200字符摘要
    generated_at: str
    reports: List[ReportVulnerability] = field(default_factory=list)
    summary: dict = field(default_factory=dict)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)

    def to_dict(self) -> dict:
        return {
            "task_id": self.task_id,
            "generated_at": self.generated_at,
            "summary": self.summary,
            "reports": [asdict(r) for r in self.reports],
        }

    def to_markdown(self) -> str:
        lines = [
            f"# Audit Report — Task #{self.task_id}",
            f"Generated: {self.generated_at}",
            "",
            "## Summary",
            f"- Total vulnerabilities: {self.summary.get('total', 0)}",
            f"- Critical: {self.summary.get('critical', 0)}",
            f"- High: {self.summary.get('high', 0)}",
            f"- Medium: {self.summary.get('medium', 0)}",
            f"- Low: {self.summary.get('low', 0)}",
            f"- Info: {self.summary.get('info', 0)}",
            "",
            "---",
            "",
        ]

        for i, r in enumerate(self.reports, 1):
            lines += [
                f"## {i}. {r.title}",
                f"- **Report ID**: {r.report_id}",
                f"- **Agent**: {r.agent_name} ({r.agent_id})",
                f"- **Severity**: {r.severity}",
                f"- **Confidence**: {r.final_confidence}% (raw: {r.confidence}%)",
                f"- **Location**: {r.location}",
                "",
                f"### Description",
                r.description,
                "",
                f"### Impact",
                r.impact,
                "",
                f"### Recommendation",
                r.recommendation,
                "",
                "---",
                "",
            ]

        return "\n".join(lines)


class ReportGenerator:
    """报告生成器"""

    def __init__(self, task_id: str, contract_code: str):
        self.task_id = task_id
        self.contract_snippet = contract_code[:200]
        self._counter = 0

    def generate(self, vulnerabilities: List[dict]) -> AuditReport:
        """
        生成审计报告

        Args:
            vulnerabilities: 来自各 Agent 的漏洞列表，每个元素包含:
                agent_id, agent_name, title, severity, confidence, final_confidence, location, description, impact, recommendation
        """
        reports = []
        for v in vulnerabilities:
            self._counter += 1
            reports.append(ReportVulnerability(
                report_id=f"R{self._counter:04d}",
                **v,
            ))

        summary = self._build_summary(reports)
        return AuditReport(
            task_id=self.task_id,
            contract_code_snippet=self.contract_snippet,
            generated_at=datetime.now().isoformat(),
            reports=reports,
            summary=summary,
        )

    def _build_summary(self, reports: List[ReportVulnerability]) -> dict:
        severity_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Info": 0}
        for r in reports:
            s = r.severity if r.severity in severity_counts else "Medium"
            severity_counts[s] += 1
        return {
            "total": len(reports),
            **{k.lower(): v for k, v in severity_counts.items()},
        }
