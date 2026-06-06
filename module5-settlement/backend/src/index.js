/**
 * Module 5: Settlement & Reputation API
 * 
 * 本模块负责：
 * 1. 项目方 Accept / Challenge
 * 2. 超时默认接受
 * 3. 奖励自动分配
 * 4. Agent Calibration Score
 * 5. 审计师 Reputation
 * 
 * 对接其他模块：
 * - 模块1: 任务市场和资金
 * - 模块2: AI发现漏洞
 * - 模块3: 防抄袭
 * - 模块4: 去重聚类
 */

'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const settlementRoutes = require('./routes/settlement');
const reputationRoutes = require('./routes/reputation');
const calibrationRoutes = require('./routes/calibration');
const webhookRoutes = require('./routes/webhook');

const app = express();
const prisma = new PrismaClient();

// 中间件
app.use(cors());
app.use(express.json());

// 健康检查
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        module: 'settlement-reputation',
        timestamp: new Date().toISOString() 
    });
});

// 数据库重置 (仅开发/MVP阶段)
app.post('/api/reset', async (req, res) => {
    try {
        // 执行 seed 脚本中的重置+填充逻辑
        const { PrismaClient } = require('@prisma/client');
        const seedPrisma = new PrismaClient();
        
        // 按依赖顺序清空
        await seedPrisma.auditLog.deleteMany();
        await seedPrisma.rewardDistribution.deleteMany();
        await seedPrisma.submission.deleteMany();
        await seedPrisma.vulnerability.deleteMany();
        await seedPrisma.arbitration.deleteMany();
        await seedPrisma.juror.deleteMany();
        await seedPrisma.auditor.deleteMany();
        await seedPrisma.aIAgent.deleteMany();
        await seedPrisma.webhookConfig.deleteMany();

        // 重新填充演示数据
        // 注意: JSON 字段 (如 details, distributions, selectedJurors) 在 SQLite 中存储为 String
        
        await seedPrisma.auditor.createMany({ data: [
            { walletAddress: '0xAgentD000000000000000000000000C4', name: '安全审计专家 D', level: 'Gold', reputation: 8920, totalSubmissions: 19, validSubmissions: 18, invalidSubmissions: 1, totalBounty: 12500, maxSubmissions: 20 },
            { walletAddress: '0xAgentA000000000000000000000000F1', name: '安全审计专家 A', level: 'Silver', reputation: 6540, totalSubmissions: 14, validSubmissions: 12, invalidSubmissions: 2, totalBounty: 7800, maxSubmissions: 10 },
            { walletAddress: '0xAgentB000000000000000000000000E2', name: '代币经济审计师 B', level: 'Silver', reputation: 5410, totalSubmissions: 11, validSubmissions: 10, invalidSubmissions: 1, totalBounty: 6200, maxSubmissions: 10 },
            { walletAddress: '0xAgentE000000000000000000000000B5', name: '静态分析器 E', level: 'Bronze', reputation: 3200, totalSubmissions: 10, validSubmissions: 7, invalidSubmissions: 3, totalBounty: 3400, maxSubmissions: 7 },
            { walletAddress: '0xAgentC000000000000000000000000D3', name: '审计师 C', level: 'Rookie', reputation: 1200, totalSubmissions: 5, validSubmissions: 3, invalidSubmissions: 2, totalBounty: 800, maxSubmissions: 5 },
        ]});
        await seedPrisma.aIAgent.createMany({ data: [
            { agentId: 'security-1', name: '🔒 安全审计专家', calibration: 87, totalReports: 23, correctPredictions: 20, avgConfidence: 85, avgActualAccuracy: 82, reputation: 8920, multiplier: 95 },
            { agentId: 'tokenomics-1', name: '📊 代币经济审计师', calibration: 82, totalReports: 15, correctPredictions: 12, avgConfidence: 78, avgActualAccuracy: 80, reputation: 6540, multiplier: 90 },
            { agentId: 'static-1', name: '🔍 静态代码分析器', calibration: 91, totalReports: 41, correctPredictions: 37, avgConfidence: 90, avgActualAccuracy: 88, reputation: 9100, multiplier: 98 },
        ]});
        await seedPrisma.juror.createMany({ data: [
            { walletAddress: '0xJuror00111111111111111111111111A1', name: '仲裁员 Alpha', stake: 5000, reputation: 95, totalVotes: 12, correctVotes: 11, incorrectVotes: 1 },
            { walletAddress: '0xJuror00222222222222222222222222B2', name: '仲裁员 Beta', stake: 3000, reputation: 88, totalVotes: 8, correctVotes: 7, incorrectVotes: 1 },
        ]});
        await seedPrisma.vulnerability.createMany({ data: [
            { vulId: 'TASK-001-VUL-001', title: 'Vault.withdraw() Reentrancy Attack', description: 'Reentrancy via fallback', bounty: 500, status: 'PENDING', submitter: '0xAgentA...F1', projectAddress: '0x1234...5678', projectName: 'Vault Security Audit', totalConfidence: 92 },
            { vulId: 'TASK-001-VUL-002', title: 'Price Oracle Manipulation', description: 'Flashloan price manipulation', bounty: 300, status: 'ACCEPTED', submitter: '0xAgentD...C4', projectAddress: '0x1234...5678', projectName: 'Vault Security Audit', totalConfidence: 78 },
            { vulId: 'TASK-001-VUL-003', title: 'Unchecked Integer Overflow', description: 'uint256 overflow in stake()', bounty: 200, status: 'PENDING', submitter: '0xAgentE...B5', projectAddress: '0x1234...5678', projectName: 'Vault Security Audit', totalConfidence: 95 },
            { vulId: 'TASK-002-VUL-001', title: 'swap() Missing Slippage Protection', description: 'Sandwich attack vector', bounty: 500, status: 'CHALLENGED', submitter: '0xAgentG...D7', projectAddress: '0xabcd...ef12', projectName: 'DEX Smart Contract Audit', totalConfidence: 91, challengeBond: 100, challengeReason: 'Off-chain protection exists.' },
        ]});
        await seedPrisma.auditLog.create({ data: { action: 'RESET', operator: 'ADMIN', operatorType: 'SYSTEM' } });
        await seedPrisma.$disconnect();

        res.json({ success: true, message: '数据库已重置为初始演示状态', timestamp: new Date().toISOString() });
    } catch (err) {
        console.error('Reset error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// API路由
app.use('/api/v1/settlement', settlementRoutes);
app.use('/api/v1/reputation', reputationRoutes);
app.use('/api/v1/calibration', calibrationRoutes);
app.use('/api/v1/webhooks', webhookRoutes);

// 错误处理
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message 
    });
});

// 启动服务器
const PORT = process.env.PORT || 3005;
const server = app.listen(PORT, () => {
    console.log(`Module 5 API running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// 优雅关闭
process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await prisma.$disconnect();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = { app, prisma };
