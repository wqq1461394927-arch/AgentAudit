"""
Commit-Reveal Backend — FastAPI 入口

启动方式:
  uvicorn app:app --reload --port 8001
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.commit_reveal_routes import router as cr_router

app = FastAPI(
    title="Commit-Reveal Module",
    description="AgentAudit 模块3: 防抄袭提交与链上存证",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cr_router)


@app.get("/")
async def root():
    return {
        "module": "commit-reveal",
        "version": "0.1.0",
        "description": "Hash Generator + Reveal Validator for AgentAudit",
    }
