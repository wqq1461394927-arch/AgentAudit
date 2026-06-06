"""
Hash Service — 后端哈希服务

提供与链上合约保持一致的哈希计算能力。

hash = keccak256(taskId, submitter, reportJson, salt)

技术栈:
  - Web3.py (keccak)
  - eth-abi (abi.encode)
"""

import secrets
from dataclasses import dataclass
from typing import Optional
from eth_abi import encode
from eth_utils import keccak


@dataclass
class Report:
    """漏洞报告数据结构"""
    title: str
    severity: str          # Critical | High | Medium | Low | Info
    confidence: int        # 0-100
    description: str
    recommendation: str


@dataclass
class HashInput:
    """哈希计算输入"""
    task_id: int
    agent_address: str     # 0x 开头
    report: Report
    salt: str              # 32 bytes hex


def generate_salt() -> str:
    """生成随机 salt (32 bytes hex)"""
    salt_bytes = secrets.token_bytes(32)
    return "0x" + salt_bytes.hex()


def generate_report_hash(hash_input: HashInput) -> str:
    """
    生成 reportHash

    等价于链上的:
      keccak256(abi.encode(taskId, submitter, reportJson, salt))

    Args:
        hash_input: 包含 taskId, agentAddress, report, salt

    Returns:
        0x 前缀的 32 bytes hash
    """
    import json

    report_json = json.dumps({
        "title": hash_input.report.title,
        "severity": hash_input.report.severity,
        "confidence": hash_input.report.confidence,
        "description": hash_input.report.description,
        "recommendation": hash_input.report.recommendation,
    }, ensure_ascii=False, separators=(",", ":"))

    # eth_abi.encode 对应 Solidity 的 abi.encode
    encoded = encode(
        ["uint256", "address", "string", "bytes32"],
        [
            hash_input.task_id,
            hash_input.agent_address,
            report_json,
            bytes.fromhex(hash_input.salt[2:]),
        ],
    )

    hash_bytes = keccak(encoded)
    return "0x" + hash_bytes.hex()


def verify_reveal(
    task_id: int,
    submitter: str,
    report_json: str,
    salt: str,
    commit_hash: str,
) -> bool:
    """
    独立验证 Reveal: 重新计算 hash 并与链上 commitHash 比对

    Args:
        task_id: 任务 ID
        submitter: 提交者地址
        report_json: 完整的报告 JSON 字符串
        salt: commit 时使用的 salt
        commit_hash: 链上存储的 commitHash

    Returns:
        True 如果 hash 一致
    """
    encoded = encode(
        ["uint256", "address", "string", "bytes32"],
        [
            task_id,
            submitter,
            report_json,
            bytes.fromhex(salt[2:]),
        ],
    )
    computed_hash = "0x" + keccak(encoded).hex()
    return computed_hash.lower() == commit_hash.lower()
