"""
Commit-Reveal API 路由

提供生成 hash、验证 reveal 等接口。
"""

import json as json_module
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from services.hash_service import (
    generate_salt,
    generate_report_hash,
    verify_reveal,
    HashInput,
    Report,
)

router = APIRouter(prefix="/api/commit-reveal", tags=["commit-reveal"])


# ============ 请求/响应模型 ============

class ReportModel(BaseModel):
    title: str = Field(..., description="漏洞标题", example="Reentrancy in withdraw()")
    severity: str = Field(..., description="严重等级", example="High")
    confidence: int = Field(..., ge=0, le=100, description="置信度(0-100)", example=86)
    description: str = Field(..., description="漏洞描述")
    recommendation: str = Field(..., description="修复建议")


class GenerateHashRequest(BaseModel):
    task_id: int = Field(..., description="任务 ID")
    agent_address: str = Field(..., description="Agent 地址 (0x)", example="0x1234...")
    report: ReportModel


class GenerateHashResponse(BaseModel):
    salt: str = Field(..., description="随机 salt")
    report_json: str = Field(..., description="序列化后的报告 JSON")
    report_hash: str = Field(..., description="链上 commitHash")


class VerifyRevealRequest(BaseModel):
    task_id: int
    submitter: str = Field(..., description="提交者地址")
    report_json: str = Field(..., description="报告 JSON 字符串")
    salt: str = Field(..., description="commit 时的 salt")
    commit_hash: str = Field(..., description="链上 commitHash")


class VerifyRevealResponse(BaseModel):
    valid: bool
    computed_hash: str
    commit_hash: str


# ============ 路由 ============

@router.post("/generate-hash", response_model=GenerateHashResponse)
async def generate_hash(req: GenerateHashRequest):
    """
    生成 reportHash 和 salt

    输入: taskId, agentAddress, report 内容
    输出: salt, reportJson, reportHash

    前端/Agent 拿到 hash 后调用合约 commitReport()
    """
    try:
        salt = generate_salt()

        hash_input = HashInput(
            task_id=req.task_id,
            agent_address=req.agent_address,
            report=Report(
                title=req.report.title,
                severity=req.report.severity,
                confidence=req.report.confidence,
                description=req.report.description,
                recommendation=req.report.recommendation,
            ),
            salt=salt,
        )

        report_json_str = json_module.dumps({
            "title": req.report.title,
            "severity": req.report.severity,
            "confidence": req.report.confidence,
            "description": req.report.description,
            "recommendation": req.report.recommendation,
        }, ensure_ascii=False, separators=(",", ":"))

        report_hash = generate_report_hash(hash_input)

        return GenerateHashResponse(
            salt=salt,
            report_json=report_json_str,
            report_hash=report_hash,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verify-reveal", response_model=VerifyRevealResponse)
async def verify_reveal_endpoint(req: VerifyRevealRequest):
    """
    独立验证 Reveal: 重新计算 hash 并与链上 commitHash 比对

    用于前端展示验证结果，也可供其他模块调用
    """
    try:
        is_valid = verify_reveal(
            task_id=req.task_id,
            submitter=req.submitter,
            report_json=req.report_json,
            salt=req.salt,
            commit_hash=req.commit_hash,
        )

        return VerifyRevealResponse(
            valid=is_valid,
            computed_hash="",  # 生产环境可返回详细计算结果
            commit_hash=req.commit_hash,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "module": "commit-reveal"}
