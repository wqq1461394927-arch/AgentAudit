"""
AgentAudit 模块2 — Agent Manager 调度入口

管理整个 Agent 生命周期：
  创建 Agent → 分配 Prompt → 调度 LLM → 解析结果 → 计算置信度 → 生成报告 → 存入数据库
"""
import hashlib
import json
import concurrent.futures
from dataclasses import dataclass, field
from typing import List, Dict, Optional
from datetime import datetime

from prompts.prompt_templates import (
    get_agent_profile,
    get_all_agent_ids,
    build_audit_message,
)
from providers.llm_provider import (
    BaseLLMProvider,
    MockProvider,
    get_provider,
    ChatMessage,
)
from analyzers.vulnerability_analyzer import (
    Vulnerability,
    AnalysisResult,
    parse_json_response,
)
from scorer.confidence_scorer import ConfidenceScorer
from reporter.report_generator import ReportGenerator
from database.audit_database import AuditDatabase, AuditRecord


# ============ 数据模型 ============

@dataclass
class AuditRequest:
    contract_code: str
    selected_agents: List[str] = field(default_factory=lambda: ["security", "tokenomics", "static"])


@dataclass
class AgentTaskResult:
    agent_id: str
    agent_name: str
    analysis: AnalysisResult
    scored_vulnerabilities: List[dict] = field(default_factory=list)


class AgentManager:
    """Agent 审计引擎调度器"""

    def __init__(self, provider: Optional[BaseLLMProvider] = None):
        self.provider = provider or MockProvider()
        self.scorer = ConfidenceScorer()
        self.database = AuditDatabase()

    def audit(self, request: AuditRequest) -> dict:
        """
        主入口：并行调度多个 Agent 审计合约

        Args:
            request: 审计请求（合约代码 + Agent 列表）

        Returns:
            完整审计报告 dict
        """
        task_id = self._generate_task_id(request.contract_code)
        agents = request.selected_agents or ["security", "tokenomics", "static"]

        # 并行执行所有 Agent 审计
        results: List[AgentTaskResult] = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(agents)) as executor:
            futures = {
                executor.submit(self._run_single_agent, task_id, aid, request.contract_code): aid
                for aid in agents
            }
            for future in concurrent.futures.as_completed(futures):
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    agent_id = futures[future]
                    raise RuntimeError(f"Agent {agent_id} failed: {e}")

        # 汇总所有漏洞
        all_vulns = []
        for r in results:
            for v in r.scored_vulnerabilities:
                all_vulns.append({
                    "agent_id": r.agent_id,
                    "agent_name": r.agent_name,
                    **v,
                })

        # 生成报告
        generator = ReportGenerator(task_id, request.contract_code)
        report = generator.generate(all_vulns)

        # 存入 DB
        for r in results:
            db_record = AuditRecord(
                task_id=task_id,
                agent_id=r.agent_id,
                agent_name=r.agent_name,
                contract_hash=hashlib.sha256(request.contract_code.encode()).hexdigest()[:16],
                vulnerabilities=r.scored_vulnerabilities,
                raw_confidence_sum=sum(v.get("raw_confidence", 0) for v in r.scored_vulnerabilities),
            )
            self.database.save_record(db_record)

        return {
            "task_id": task_id,
            "report": report.to_dict(),
            "results": [
                {
                    "agent_id": r.agent_id,
                    "agent_name": r.agent_name,
                    "vuln_count": len(r.scored_vulnerabilities),
                }
                for r in results
            ],
        }

    def _run_single_agent(self, task_id: str, agent_id: str, contract_code: str) -> AgentTaskResult:
        """执行单个 Agent 审计流程"""
        profile = get_agent_profile(agent_id)

        # 1. 构建 Prompt
        messages_raw = build_audit_message(agent_id, contract_code)
        messages = [ChatMessage(role=m["role"], content=m["content"]) for m in messages_raw]

        # 2. 调用 LLM
        response = self.provider.chat(messages)

        # 3. 解析结果
        analysis = parse_json_response(agent_id, response.content)

        # 4. 计算置信度
        scored = []
        for vuln in analysis.vulnerabilities:
            scored_vuln = self.scorer.score(
                agent_id=agent_id,
                raw_confidence=vuln.confidence,
                title=vuln.title,
                severity=vuln.severity,
            )
            scored.append({
                **vuln.to_dict(),
                "final_confidence": scored_vuln.final_confidence,
                "calibration_coefficient": scored_vuln.calibration_coefficient,
            })

        return AgentTaskResult(
            agent_id=agent_id,
            agent_name=profile.name,
            analysis=analysis,
            scored_vulnerabilities=scored,
        )

    def _generate_task_id(self, contract_code: str) -> str:
        """生成任务 ID"""
        ts = datetime.now().strftime("%Y%m%d%H%M%S")
        code_hash = hashlib.sha256(contract_code.encode()).hexdigest()[:8]
        return f"T{ts}-{code_hash}"

    def feedback(self, agent_id: str, was_correct: bool):
        """外部反馈：某个发现最终是否是真实漏洞"""
        self.scorer.feedback(agent_id, was_correct)
