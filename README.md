# AgentAudit

AgentAudit 是一个基于多 AI Agent 协同的去中心化安全审计平台。项目方将赏金锁入智能合约，系统自动调度多个拥有不同专业提示词的 AI Agent（安全专家、代币经济审计师、静态扫描专家）并行审计合约代码，输出带置信度的漏洞报告。通过 Commit-Reveal 机制防止抄袭，利用漏洞聚类生成唯一 VUL-ID 杜绝重复领奖，并引入挑战与信誉惩罚机制，确保审计结果公平可信。AgentAudit 旨在以更低成本、更高覆盖率，重塑 Web3 安全审计的协作方式。

---

## 项目结构

```
AgentAudit/
├── contracts_compile/          # Hardhat 合约（集成编译）
├── module1-task-market/        # 模块1: 任务市场 (Solidity)
├── module2-ai-audit-engine/    # 模块2: AI审计引擎 (Python)
├── module3-commit-reveal/      # 模块3: Commit-Reveal (Python + Solidity)
├── module4-vuln-clustering/    # 模块4: 漏洞聚类 (Python + 前端)
├── module5-settlement/         # 模块5: 结算与声誉
│   ├── backend/                #   Node.js + Prisma + SQLite
│   └── contracts/              #   Solidity 合约
├── frontend/                   # React SPA 前端 (5模块统一)
├── server/                     # Gateway API 网关 (Express + TypeScript)
├── test/                       # Hardhat 智能合约测试
├── document/                   # 各模块设计文档
├── start.bat / start.ps1       # 一键启动脚本
├── TEST_GUIDE.md               # 完整测试手册 (67项)
└── 操作文档.md                 # 模块5 API 操作文档
```

## 快速启动

```bash
# 1. 安装依赖
npm install                    # 根目录 (Hardhat)
cd server && npm install       # 网关
cd ../frontend && npm install  # 前端
cd ../module5-settlement/backend && npm install  # 模块5后端

# 2. 配置环境变量
cp .env.example .env

# 3. 初始化模块5数据库
cd module5-settlement/backend
npx prisma migrate dev --name init
npx prisma db seed              # 填充演示数据

# 4. 一键启动所有服务
# 双击根目录 start.bat
# 或: powershell -ExecutionPolicy Bypass -File start.ps1
```

启动后访问:
| 服务 | 地址 |
|------|------|
| 前端 SPA | http://localhost:5173 |
| Gateway API | http://localhost:3000/api/health |
| Module5 API | http://localhost:3005/health |
| 数据库重置 | POST http://localhost:3005/api/reset |

## 技术栈

| 层 | 技术 |
|----|------|
| 智能合约 | Solidity, Hardhat, Foundry |
| 后端 | Node.js, Express, Prisma, SQLite |
| AI引擎 | Python, LLM Agent |
| 前端 | React, TypeScript, Vite |
| 测试 | Hardhat Test (82个用例) |

## 协议规则

核心原则: **代码即法律** — 所有资金锁定、任务转换、奖励分配均由智能合约自动执行。

详细规则见 [TEST_GUIDE.md](./TEST_GUIDE.md) 和项目根目录下的协议规则文档。
