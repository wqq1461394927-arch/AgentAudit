"""
模块2 综合测试 — AI Agent Audit Engine

测试覆盖:
  1. Prompt Templates — Agent 配置加载
  2. Vulnerability Analyzer — JSON 解析、标准化
  3. Confidence Scorer — 置信度计算、历史校准
  4. Report Generator — JSON/Markdown 双格式输出
  5. Agent Manager — 端到端并行审计流程
  6. LLM Provider — Mock/Factory
"""
import sys
import json
import os

# 确保模块路径正确
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime


SAMPLE_CONTRACT = """// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VulnerableVault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        balances[msg.sender] = 0;
    }
}"""


def test_prompt_templates():
    print("=" * 60)
    print("[TEST 1] Prompt Templates — Agent 配置加载")

    from prompts.prompt_templates import (
        get_agent_profile,
        get_all_agent_ids,
        build_audit_message,
        AGENT_PROFILES,
    )

    # 加载所有 Agent
    ids = get_all_agent_ids()
    assert len(ids) == 3, f"Expected 3 agents, got {len(ids)}"
    print(f"  PASS: {len(ids)} agents registered: {ids}")

    # 检查每个 Agent 配置完整
    for aid in ids:
        profile = get_agent_profile(aid)
        assert profile.agent_id == aid
        assert len(profile.name) > 0
        assert len(profile.system_prompt) > 100
        assert len(profile.focus_areas) > 0
        print(f"  PASS: {profile.name} ({aid}) — {len(profile.focus_areas)} focus areas")

    # 构建消息
    msgs = build_audit_message("security", SAMPLE_CONTRACT)
    assert len(msgs) == 2
    assert msgs[0]["role"] == "system"
    assert msgs[1]["role"] == "user"
    assert "withdraw" in msgs[1]["content"]
    print(f"  PASS: Message built ({len(msgs)} messages)")

    return True


def test_vulnerability_analyzer():
    print("=" * 60)
    print("[TEST 2] Vulnerability Analyzer — JSON 解析")

    from analyzers.vulnerability_analyzer import parse_json_response, Vulnerability

    # 测试标准 JSON 格式
    raw = json.dumps({
        "vulnerabilities": [
            {
                "title": "Reentrancy in withdraw()",
                "severity": "High",
                "confidence": 85,
                "location": "withdraw() lines 10-15",
                "description": "CEI pattern violation",
                "impact": "Funds can be drained",
                "recommendation": "Use ReentrancyGuard"
            },
            {
                "title": "Missing zero-address check",
                "severity": "Low",
                "confidence": 90,
                "location": "constructor",
                "description": "No zero-address validation",
                "impact": "Minor",
                "recommendation": "Add require(address != 0)"
            }
        ]
    })

    result = parse_json_response("security", raw)
    assert len(result.vulnerabilities) == 2, f"Expected 2 vulns, got {len(result.vulnerabilities)}"
    assert result.vulnerabilities[0].severity == "High"
    assert result.vulnerabilities[0].confidence == 85
    print(f"  PASS: Parsed {len(result.vulnerabilities)} vulnerabilities")

    # 测试 Markdown 代码块包裹的 JSON
    md_raw = '```json\n{"vulnerabilities": [{"title": "Test", "severity": "Critical", "confidence": 100, "location": "line 1", "description": "desc", "impact": "impact", "recommendation": "fix"}]}\n```'
    result_md = parse_json_response("security", md_raw)
    assert len(result_md.vulnerabilities) == 1
    assert result_md.vulnerabilities[0].severity == "Critical"
    print(f"  PASS: Markdown-wrapped JSON parsed correctly")

    # 测试空结果
    empty_result = parse_json_response("security", '{"vulnerabilities": []}')
    assert len(empty_result.vulnerabilities) == 0
    print(f"  PASS: Empty result handled")

    # 测试无效 JSON
    bad_result = parse_json_response("security", "not json at all")
    assert bad_result.parse_error is not None
    print(f"  PASS: Invalid JSON detected: {bad_result.parse_error[:30]}...")

    # 测试严重等级标准化
    weird_raw = '{"vulnerabilities": [{"title":"T","severity":"super critical","confidence":200,"location":"x","description":"d","impact":"i","recommendation":"r"}]}'
    weird_result = parse_json_response("security", weird_raw)
    v = weird_result.vulnerabilities[0]
    assert v.severity == "Medium", f"Expected Medium, got {v.severity}"
    assert v.confidence == 100, f"Expected 100, got {v.confidence}"
    print(f"  PASS: Severity/confidence normalized")

    return True


def test_confidence_scorer():
    print("=" * 60)
    print("[TEST 3] Confidence Scorer — 置信度计算")

    from scorer.confidence_scorer import ConfidenceScorer

    scorer = ConfidenceScorer()

    # 新 Agent 校准系数 = 1.0
    sv = scorer.score("new_agent", raw_confidence=90, title="Test Bug")
    assert sv.final_confidence == 90
    assert sv.calibration_coefficient == 1.0
    print(f"  PASS: New agent: raw={sv.raw_confidence}, final={sv.final_confidence}")

    # 模拟 Agent 历史表现变差后置信度下降
    for _ in range(80):
        scorer.feedback("experimented_agent", was_correct=True)
    for _ in range(20):
        scorer.feedback("experimented_agent", was_correct=False)
    # 准确率 = 80/100 = 0.8

    sv2 = scorer.score("experimented_agent", raw_confidence=90, title="Bug")
    expected = int(90 * 0.8)
    assert sv2.final_confidence == expected, f"Expected {expected}, got {sv2.final_confidence}"
    print(f"  PASS: Calibrated: raw=90, calibration=0.8, final={sv2.final_confidence}")

    # 校准系数范围检查
    cal = scorer.get_agent_calibration("experimented_agent")
    assert 0 <= cal <= 1.0, f"Calibration out of range: {cal}"
    print(f"  PASS: Calibration in range [0,1]: {cal:.3f}")

    return True


def test_report_generator():
    print("=" * 60)
    print("[TEST 4] Report Generator — 报告生成")

    from reporter.report_generator import ReportGenerator

    gen = ReportGenerator("TASK123", SAMPLE_CONTRACT)

    vulns = [
        {
            "agent_id": "security",
            "agent_name": "Security Agent",
            "title": "Reentrancy in withdraw()",
            "severity": "High",
            "confidence": 85,
            "final_confidence": 85,
            "location": "withdraw() lines 10-15",
            "description": "CEI pattern violation",
            "impact": "Funds can be drained",
            "recommendation": "Use ReentrancyGuard",
        },
        {
            "agent_id": "tokenomics",
            "agent_name": "Tokenomics Agent",
            "title": "No withdrawal limit",
            "severity": "Medium",
            "confidence": 70,
            "final_confidence": 56,
            "location": "withdraw() function",
            "description": "Single user can drain entire pool",
            "impact": "Liquidity depletion",
            "recommendation": "Add daily limit",
        },
    ]

    report = gen.generate(vulns)

    # JSON 输出
    json_str = report.to_json()
    data = json.loads(json_str)
    assert data["task_id"] == "TASK123"
    assert len(data["reports"]) == 2
    assert data["summary"]["total"] == 2
    assert data["summary"]["high"] == 1
    assert data["summary"]["medium"] == 1
    print(f"  PASS: JSON report: {data['summary']}")

    # Markdown 输出
    md = report.to_markdown()
    assert "# Audit Report" in md
    assert "Reentrancy" in md
    assert "### Description" in md
    assert "### Recommendation" in md
    print(f"  PASS: Markdown report generated ({len(md)} chars)")

    return True


def test_agent_manager():
    print("=" * 60)
    print("[TEST 5] Agent Manager — 端到端并行审计")

    from manager.agent_manager import AgentManager, AuditRequest

    manager = AgentManager()

    # 单 Agent 测试
    req = AuditRequest(
        contract_code=SAMPLE_CONTRACT,
        selected_agents=["security"],
    )
    result = manager.audit(req)

    assert "task_id" in result
    assert result["report"]["summary"]["total"] >= 0
    print(f"  Task ID: {result['task_id']}")
    print(f"  Total vulns: {result['report']['summary']['total']}")

    # 多 Agent 并行测试
    req2 = AuditRequest(
        contract_code=SAMPLE_CONTRACT,
        selected_agents=["security", "tokenomics", "static"],
    )
    result2 = manager.audit(req2)

    assert len(result2["results"]) == 3, f"Expected 3 agents, got {len(result2['results'])}"
    agent_ids = [r["agent_id"] for r in result2["results"]]
    assert "security" in agent_ids
    assert "tokenomics" in agent_ids
    assert "static" in agent_ids
    print(f"  PASS: 3 agents parallel audit completed")
    for r in result2["results"]:
        print(f"    {r['agent_name']}: {r['vuln_count']} vulnerabilities")

    return True


def test_llm_provider():
    print("=" * 60)
    print("[TEST 6] LLM Provider — Mock & Factory")

    from providers.llm_provider import get_provider, MockProvider, ChatMessage
    from analyzers.vulnerability_analyzer import parse_json_response

    # 默认 Mock
    provider = get_provider("mock")
    assert isinstance(provider, MockProvider)
    print(f"  PASS: Mock provider created")

    # Mock 返回预设响应
    custom_response = json.dumps({"vulnerabilities": [{"title":"Custom Bug","severity":"Low","confidence":30,"location":"x","description":"d","impact":"i","recommendation":"r"}]})
    provider2 = get_provider("mock", preset_response=custom_response)
    response = provider2.chat([])
    data = json.loads(response.content)
    assert data["vulnerabilities"][0]["title"] == "Custom Bug"
    print(f"  PASS: Mock returns preset response")

    # Mock 默认响应可解析
    provider3 = MockProvider()
    resp = provider3.chat([])
    result = parse_json_response("test", resp.content)
    assert len(result.vulnerabilities) >= 1
    print(f"  PASS: Default mock response parses to {len(result.vulnerabilities)} vulns")

    return True


def test_database():
    print("=" * 60)
    print("[TEST 7] Audit Database — 数据存取")

    from database.audit_database import AuditDatabase, AuditRecord

    db = AuditDatabase()

    record = AuditRecord(
        task_id="TASK001",
        agent_id="security",
        agent_name="Security Agent",
        contract_hash="abc123",
        vulnerabilities=[{"title": "Test Bug", "severity": "High"}],
    )
    db.save_record(record)

    records = db.get_task_records("TASK001")
    assert len(records) == 1
    assert records[0].agent_id == "security"
    print(f"  PASS: Record saved and retrieved")

    # 历史查询
    history = db.get_agent_history("security")
    assert len(history) == 1
    print(f"  PASS: Agent history query works")

    # 校准记录
    db.update_calibration("security", 0.85)
    assert db.get_calibration("security") == 0.85
    print(f"  PASS: Calibration updated and retrieved")

    return True


def test_edge_cases():
    print("=" * 60)
    print("[TEST 8] Edge Cases")

    from prompts.prompt_templates import get_agent_profile

    # 未知 Agent
    try:
        get_agent_profile("nonexistent")
        print("  FAIL: Should raise ValueError")
        return False
    except ValueError as e:
        print(f"  PASS: Unknown agent rejected: {e}")

    # Analyzer 处理空字符串
    from analyzers.vulnerability_analyzer import parse_json_response
    empty = parse_json_response("test", "")
    assert empty.parse_error is not None
    print(f"  PASS: Empty string handled")

    # Scorer 边界值
    from scorer.confidence_scorer import ConfidenceScorer
    s = ConfidenceScorer()
    sv_low = s.score("agent", raw_confidence=0)
    assert sv_low.final_confidence == 0
    sv_high = s.score("agent", raw_confidence=100)
    assert sv_high.final_confidence == 100
    print(f"  PASS: Confidence bounds [0,100] respected")

    # Reporter 空漏洞列表
    from reporter.report_generator import ReportGenerator
    gen = ReportGenerator("T", "code")
    empty_report = gen.generate([])
    assert empty_report.summary["total"] == 0
    print(f"  PASS: Empty report handled")

    return True


# ============ 主入口 ============

def main():
    print()
    print("=" * 60)
    print("  模块2 AI Agent Audit Engine 综合测试")
    print(f"  时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    tests = [
        ("Prompt Templates", test_prompt_templates),
        ("Vulnerability Analyzer", test_vulnerability_analyzer),
        ("Confidence Scorer", test_confidence_scorer),
        ("Report Generator", test_report_generator),
        ("Agent Manager E2E", test_agent_manager),
        ("LLM Provider", test_llm_provider),
        ("Audit Database", test_database),
        ("Edge Cases", test_edge_cases),
    ]

    passed = 0
    failed = 0
    for name, test_fn in tests:
        try:
            ok = test_fn()
            if ok:
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"  ERROR: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print()
    print("=" * 60)
    print(f"  结果: {passed}/{len(tests)} 通过, {failed}/{len(tests)} 失败")
    if failed == 0:
        print("  所有测试通过!")
    else:
        print(f"  {failed} 个测试失败，请检查!")
    print("=" * 60)
    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
