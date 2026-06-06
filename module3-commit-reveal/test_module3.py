"""
模块3 综合测试 — 后端 + 合约编译 + 全流程模拟

测试覆盖:
  1. Solidity 合约编译
  2. Hash 生成与验证 (与链上逻辑一致)
  3. 完整 Commit-Reveal 流程模拟
  4. 边界条件测试
  5. 多 Agent 并发测试
"""
import os
import sys
import json
import time
import secrets
from dataclasses import dataclass, field
from typing import List, Dict, Optional
from eth_abi import encode
from eth_utils import keccak
from datetime import datetime, timedelta


# ============ 辅助：模拟时钟 ============

class MockClock:
    """模拟时钟，方便测试时间相关的逻辑"""

    def __init__(self, start_time: float = 1000000):
        self._now = start_time

    def now(self) -> float:
        return self._now

    def advance(self, seconds: float):
        self._now += seconds


# ============ 合约编译 ============

def test_contract_compile():
    """测试 Solidity 合约能否编译"""
    print("=" * 60)
    print("[TEST 1] Compile CommitReveal.sol")

    import pathlib
    this_dir = pathlib.Path(__file__).parent
    contract_path = this_dir / "contracts" / "CommitReveal.sol"

    print(f"  Contract path: {contract_path}")
    if not contract_path.exists():
        print(f"  ERROR: Contract not found at {contract_path}")
        return False

    try:
        from solcx import compile_standard, install_solc
        install_solc("0.8.20")
    except Exception:
        from solcx import get_installed_solc_versions
        versions = get_installed_solc_versions()
        if not versions:
            print("  ERROR: No solc found. Run: python -m solcx.install v0.8.20")
            return False

    with open(contract_path, "r", encoding="utf-8") as f:
        source = f.read()

    compiled = compile_standard(
        {
            "language": "Solidity",
            "sources": {"CommitReveal.sol": {"content": source}},
            "settings": {
                "outputSelection": {
                    "*": {"*": ["abi", "evm.bytecode.object"]},
                }
            },
        },
        solc_version="0.8.20",
    )

    artifact = compiled["contracts"]["CommitReveal.sol"]["CommitReveal"]
    if artifact.get("abi") and artifact["evm"]["bytecode"]["object"]:
        func_count = len([a for a in artifact["abi"] if a.get("type") == "function"])
        bytecode_len = len(artifact["evm"]["bytecode"]["object"]) // 2
        print(f"  PASS: Contract compiled successfully ({func_count} functions, {bytecode_len} bytes bytecode)")
        return True
    else:
        print("  FAIL: Incomplete compilation output")
        return False


# ============ Python 模拟链上合约逻辑 ============

@dataclass
class Report:
    title: str
    severity: str
    confidence: int
    description: str
    recommendation: str


@dataclass
class Submission:
    submitter: str
    commit_hash: str
    report_uri: str = ""
    salt: str = ""
    commit_time: float = 0.0
    reveal_time: float = 0.0
    revealed: bool = False
    valid: bool = False


class MockCommitReveal:
    """模拟链上 CommitReveal 合约逻辑，使用 MockClock 控制时间"""

    def __init__(self, clock: MockClock, report_stake: float = 0.01):
        self.clock = clock
        self.report_stake = report_stake
        self.tasks: Dict[int, dict] = {}
        self.task_submissions: Dict[int, List[Submission]] = {}
        self.has_committed: Dict[int, Dict[str, bool]] = {}

    def create_task(self, task_id: int, commit_deadline: float, reveal_deadline: float):
        if task_id in self.tasks:
            raise RuntimeError("Task already exists")
        if commit_deadline <= self.clock.now():
            raise RuntimeError("Commit deadline must be future")
        if reveal_deadline <= commit_deadline:
            raise RuntimeError("Reveal must be after commit")

        self.tasks[task_id] = {
            "commit_deadline": commit_deadline,
            "reveal_deadline": reveal_deadline,
            "status": "Open",
        }
        self.task_submissions[task_id] = []
        self.has_committed[task_id] = {}

    def commit_report(self, task_id: int, submitter: str, report_hash: str, stake: float):
        if task_id not in self.tasks:
            raise RuntimeError("Task does not exist")
        if self.tasks[task_id]["status"] != "Open":
            raise RuntimeError("Not in Commit phase")
        if self.clock.now() > self.tasks[task_id]["commit_deadline"]:
            raise RuntimeError("Commit phase ended")
        if self.has_committed[task_id].get(submitter):
            raise RuntimeError("Already committed")
        if not report_hash or report_hash == "0x" + "00" * 32:
            raise RuntimeError("Hash cannot be empty")
        if stake < self.report_stake:
            raise RuntimeError("Insufficient stake")

        self.has_committed[task_id][submitter] = True
        sub = Submission(
            submitter=submitter,
            commit_hash=report_hash,
            commit_time=self.clock.now(),
        )
        self.task_submissions[task_id].append(sub)
        return sub

    def reveal_report(self, task_id: int, submission_id: int, report_uri: str,
                      report_json: str, salt: str):
        t = self.task_submissions[task_id]
        task = self.tasks[task_id]
        if task["status"] != "Reveal":
            raise RuntimeError("Not in Reveal phase")
        if not (self.clock.now() > task["commit_deadline"] and self.clock.now() <= task["reveal_deadline"]):
            raise RuntimeError("Not in Reveal window")

        sub = t[submission_id]
        if sub.revealed:
            raise RuntimeError("Already revealed")

        computed_hash = _compute_commit_hash(task_id, sub.submitter, report_json, salt)
        is_valid = computed_hash == sub.commit_hash

        sub.report_uri = report_uri
        sub.salt = salt
        sub.reveal_time = self.clock.now()
        sub.revealed = True
        sub.valid = is_valid

        return is_valid, computed_hash


def generate_salt() -> str:
    """生成随机 32 bytes salt"""
    return "0x" + secrets.token_bytes(32).hex()


def _compute_commit_hash(task_id: int, submitter: str, report_json: str, salt: str):
    """与链上一致的 hash 计算: keccak256(abi.encode(taskId, submitter, reportJson, salt))"""
    encoded = encode(
        ["uint256", "address", "string", "bytes32"],
        [task_id, submitter, report_json, bytes.fromhex(salt[2:])],
    )
    return "0x" + keccak(encoded).hex()


# ============ 测试用例 ============

def test_hash_generation():
    """测试 Hash 生成一致性"""
    print("=" * 60)
    print("[TEST 2] Hash Generation Consistency")

    salt = generate_salt()
    report_json = '{"title":"Reentrancy","severity":"High","confidence":86,"description":"desc","recommendation":"fix"}'

    # 两次相同输入应产生相同 hash
    h1 = _compute_commit_hash(1, "0x1234000000000000000000000000000000000000", report_json, salt)
    h2 = _compute_commit_hash(1, "0x1234000000000000000000000000000000000000", report_json, salt)
    assert h1 == h2, "Same input should produce same hash"
    print(f"  PASS: Deterministic hash: {h1[:20]}...")

    # 不同 salt 应产生不同 hash
    salt2 = generate_salt()
    h3 = _compute_commit_hash(1, "0x1234000000000000000000000000000000000000", report_json, salt2)
    assert h1 != h3, "Different salt should produce different hash"
    print(f"  PASS: Different salt = different hash: {h3[:20]}...")

    # 不同 taskId 应产生不同 hash
    h4 = _compute_commit_hash(2, "0x1234000000000000000000000000000000000000", report_json, salt)
    assert h1 != h4, "Different taskId should produce different hash"
    print(f"  PASS: Different taskId = different hash")

    # 不同 submitter 应产生不同 hash
    h5 = _compute_commit_hash(1, "0x5678000000000000000000000000000000000000", report_json, salt)
    assert h1 != h5, "Different submitter should produce different hash"
    print(f"  PASS: Different submitter = different hash")

    # 不同 report 应产生不同 hash
    report_json2 = '{"title":"Fake","severity":"Low","confidence":10,"description":"x","recommendation":"y"}'
    h6 = _compute_commit_hash(1, "0x1234000000000000000000000000000000000000", report_json2, salt)
    assert h1 != h6, "Different report should produce different hash"
    print(f"  PASS: Different report = different hash")

    return True


def test_full_commit_reveal_flow():
    """测试完整 Commit-Reveal 流程"""
    print("=" * 60)
    print("[TEST 3] Full Commit-Reveal Flow")

    clock = MockClock()
    contract = MockCommitReveal(clock, report_stake=0.01)
    agent = "0x1234000000000000000000000000000000000000"

    # 创建任务: Commit 1h, Reveal 1h 后
    commit_deadline = clock.now() + 3600
    reveal_deadline = commit_deadline + 3600
    contract.create_task(1, commit_deadline, reveal_deadline)
    print("  PASS: Task created")

    # 生成 salt 和 hash
    salt = generate_salt()
    report_json = json.dumps({
        "title": "Reentrancy in withdraw()",
        "severity": "High",
        "confidence": 86,
        "description": "The withdraw() function lacks reentrancy protection.",
        "recommendation": "Use OpenZeppelin ReentrancyGuard."
    })
    report_hash = _compute_commit_hash(1, agent, report_json, salt)
    print(f"  Generated hash: {report_hash[:20]}...")

    # Commit
    sub = contract.commit_report(1, agent, report_hash, 0.01)
    print(f"  PASS: Commit at t={sub.commit_time:.0f}")

    # 快进到 Reveal 阶段
    clock.advance(3601)  # 过了 commit deadline
    contract.tasks[1]["status"] = "Reveal"

    # Reveal
    is_valid, computed = contract.reveal_report(1, 0, "ipfs://QmTest", report_json, salt)
    assert is_valid, "Reveal should be valid"
    assert computed == report_hash, "Computed hash must match commit hash"
    print(f"  PASS: Reveal valid = {is_valid}")

    # 验证 Submission 状态
    target_sub = contract.task_submissions[1][0]
    assert target_sub.revealed, "Submission should be marked revealed"
    assert target_sub.valid, "Submission should be marked valid"
    assert target_sub.reveal_time > target_sub.commit_time, "Reveal time must > commit time"
    print(f"  PASS: Submission state updated correctly")

    return True


def test_invalid_reveal():
    """测试无效 Reveal（报告内容被篡改）"""
    print("=" * 60)
    print("[TEST 4] Invalid Reveal Detection")

    clock = MockClock()
    contract = MockCommitReveal(clock)
    agent = "0x1234000000000000000000000000000000000000"

    commit_deadline = clock.now() + 3600
    reveal_deadline = commit_deadline + 3600
    contract.create_task(2, commit_deadline, reveal_deadline)

    salt = generate_salt()
    report_json = '{"title":"Real Bug"}'
    report_hash = _compute_commit_hash(2, agent, report_json, salt)

    contract.commit_report(2, agent, report_hash, 0.01)

    # 进入 Reveal 阶段
    clock.advance(3601)
    contract.tasks[2]["status"] = "Reveal"

    # 用篡改后的报告 content reveal
    fake_report = '{"title":"Fake Bug"}'
    is_valid, _ = contract.reveal_report(2, 0, "ipfs://QmFake", fake_report, salt)

    assert not is_valid, "Fake report should be detected as invalid"
    assert not contract.task_submissions[2][0].valid, "valid flag should be False"
    print(f"  PASS: Fake reveal correctly rejected")

    return True


def test_edge_cases():
    """测试边界条件"""
    print("=" * 60)
    print("[TEST 5] Edge Cases")

    clock = MockClock()
    contract = MockCommitReveal(clock, report_stake=0.01)
    agent = "0x1234000000000000000000000000000000000000"

    commit_deadline = clock.now() + 3600
    reveal_deadline = commit_deadline + 3600
    contract.create_task(3, commit_deadline, reveal_deadline)

    # 1. 重复 Commit 应被拒绝
    salt = generate_salt()
    report_hash = _compute_commit_hash(3, agent, '{"title":"Test"}', salt)
    contract.commit_report(3, agent, report_hash, 0.01)

    try:
        contract.commit_report(3, agent, report_hash, 0.01)
        print("  FAIL: Duplicate commit should be rejected")
        return False
    except RuntimeError as e:
        assert "Already committed" in str(e)
        print(f"  PASS: Duplicate commit rejected: '{e}'")

    # 2. 空 Hash 应被拒绝
    clock2 = MockClock()
    contract2 = MockCommitReveal(clock2)
    contract2.create_task(4, clock2.now() + 3600, clock2.now() + 7200)
    try:
        contract2.commit_report(4, "0x5678000000000000000000000000000000000000",
                                 "0x" + "00" * 32, 0.01)
        print("  FAIL: Empty hash should be rejected")
        return False
    except RuntimeError as e:
        print(f"  PASS: Empty hash rejected: '{e}'")

    # 3. 押金不足应被拒绝
    try:
        contract2.commit_report(4, "0x5678000000000000000000000000000000000000", report_hash, 0.001)
        print("  FAIL: Insufficient stake should be rejected")
        return False
    except RuntimeError as e:
        assert "Insufficient" in str(e)
        print(f"  PASS: Insufficient stake rejected: '{e}'")

    # 4. 非 Reveal 阶段 Reveal 应被拒绝
    clock3 = MockClock()
    contract3 = MockCommitReveal(clock3)
    contract3.create_task(5, clock3.now() + 3600, clock3.now() + 7200)
    salt3 = generate_salt()
    hash3 = _compute_commit_hash(5, agent, '{"title":"T"}', salt3)
    contract3.commit_report(5, agent, hash3, 0.01)

    try:
        contract3.reveal_report(5, 0, "uri", '{"title":"T"}', salt3)
        print("  FAIL: Reveal in Commit phase should be rejected")
        return False
    except RuntimeError as e:
        print(f"  PASS: Phase restriction enforced: '{e}'")

    # 5. Commit 截止后不能再 Commit
    clock4 = MockClock()
    contract4 = MockCommitReveal(clock4)
    contract4.create_task(6, clock4.now() + 10, clock4.now() + 20)
    clock4.advance(11)  # 过了 commit deadline

    try:
        contract4.commit_report(6, agent, report_hash, 0.01)
        print("  FAIL: Commit after deadline should be rejected")
        return False
    except RuntimeError as e:
        print(f"  PASS: Commit after deadline rejected: '{e}'")

    return True


def test_multi_agent_ordering():
    """测试多 Agent 提交时间排序"""
    print("=" * 60)
    print("[TEST 6] Multi-Agent Commit Time Ordering")

    clock = MockClock()
    contract = MockCommitReveal(clock)
    agents = [
        "0xAAAA000000000000000000000000000000000000",
        "0xBBBB000000000000000000000000000000000000",
        "0xCCCC000000000000000000000000000000000000",
    ]

    commit_deadline = clock.now() + 3600
    reveal_deadline = commit_deadline + 3600
    contract.create_task(7, commit_deadline, reveal_deadline)

    # 模拟不同时间戳提交
    for i, agent in enumerate(agents):
        clock.advance(5)  # 每个 Agent 间隔 5 秒
        salt = generate_salt()
        report = json.dumps({"title": f"Bug found by Agent {i + 1}"})
        report_hash = _compute_commit_hash(7, agent, report, salt)
        contract.commit_report(7, agent, report_hash, 0.01)

    submissions = contract.task_submissions[7]
    assert len(submissions) == 3, f"Expected 3 submissions, got {len(submissions)}"

    # 验证按时间排序
    for i in range(1, len(submissions)):
        assert submissions[i].commit_time >= submissions[i - 1].commit_time, \
            f"Submissions not in commit time order at pos {i}"
    print(f"  PASS: 3 agents committed, order: {[s.submitter[:8] + '...' for s in submissions]}")

    winner = submissions[0].submitter
    print(f"  PASS: First submitter (70% reward share): {winner[:8]}...")
    print(f"  2nd (20%): {submissions[1].submitter[:8]}...")
    print(f"  3rd (10%): {submissions[2].submitter[:8]}...")

    return True


def test_salt_uniqueness():
    """测试 salt 唯一性（碰撞检测）"""
    print("=" * 60)
    print("[TEST 7] Salt Uniqueness")

    salts = set()
    for _ in range(1000):
        s = generate_salt()
        assert s not in salts, f"Salt collision detected at iteration {_}"
        salts.add(s)

    print(f"  PASS: 1000 salts generated, all unique")
    return True


# ============ 主入口 ============

def main():
    print()
    print("=" * 60)
    print("  模块3 Commit-Reveal 综合测试")
    print(f"  时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    results = []
    passed = 0
    failed = 0

    tests = [
        ("Contract Compile", test_contract_compile),
        ("Hash Generation", test_hash_generation),
        ("Full Commit-Reveal Flow", test_full_commit_reveal_flow),
        ("Invalid Reveal Detection", test_invalid_reveal),
        ("Edge Cases", test_edge_cases),
        ("Multi-Agent Ordering", test_multi_agent_ordering),
        ("Salt Uniqueness", test_salt_uniqueness),
    ]

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
