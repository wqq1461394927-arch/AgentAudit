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
