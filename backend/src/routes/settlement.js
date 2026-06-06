/**
 * Settlement API - 结算与挑战接口
 * Module 5: Settlement & Reputation System
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * POST /api/v1/settlement/vulnerabilities
 * 创建漏洞并启动结算流程
 * 
 * Body:
 * - vulId: 漏洞唯一标识
 * - title: 漏洞标题
 * - description: 漏洞描述
 * - bounty: 奖金金额
 * - submitter: 提交者地址
 * - projectAddress: 项目方地址
 */
router.post('/vulnerabilities', async (req, res) => {
    try {
        const { vulId, title, description, bounty, submitter, projectAddress, projectName } = req.body;
        
        // 检查是否已存在
        const existing = await prisma.vulnerability.findUnique({
            where: { vulId }
        });
        
        if (existing) {
            return res.status(409).json({ error: 'Vulnerability already exists' });
        }
        
        const vulnerability = await prisma.vulnerability.create({
            data: {
                vulId,
                title,
                description,
                bounty,
                submitter,
                projectAddress,
                projectName,
                status: 'PENDING'
            }
        });
        
        // 创建审计日志
        await prisma.auditLog.create({
            data: {
                action: 'RECEIVE_VULNERABILITY',
                vulnerabilityId: vulId,
                operator: projectAddress,
                operatorType: 'PROJECT'
            }
        });
        
        res.status(201).json(vulnerability);
    } catch (error) {
        console.error('Error creating vulnerability:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/settlement/vulnerabilities
 * 获取漏洞列表
 */
router.get('/vulnerabilities', async (req, res) => {
    try {
        const { status, projectAddress, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        let where = {};
        if (status) where.status = status;
        if (projectAddress) where.projectAddress = projectAddress;
        
        const [vulnerabilities, total] = await Promise.all([
            prisma.vulnerability.findMany({
                where,
                include: { 
                    submissions: {
                        orderBy: { ranking: 'asc' },
                        take: 10
                    }
                },
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' }
            }),
            prisma.vulnerability.count({ where })
        ]);
        
        res.json({
            data: vulnerabilities,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/settlement/vulnerabilities/:vulId
 * 获取漏洞详情
 */
router.get('/vulnerabilities/:vulId', async (req, res) => {
    try {
        const vulnerability = await prisma.vulnerability.findUnique({
            where: { vulId: req.params.vulId },
            include: { 
                submissions: {
                    orderBy: { ranking: 'asc' }
                },
                rewardDistributions: true
            }
        });
        
        if (!vulnerability) {
            return res.status(404).json({ error: 'Vulnerability not found' });
        }
        
        res.json(vulnerability);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/v1/settlement/vulnerabilities/:vulId/accept
 * 项目方接受漏洞
 */
router.post('/vulnerabilities/:vulId/accept', async (req, res) => {
    try {
        const { projectAddress } = req.body;
        
        const vulnerability = await prisma.vulnerability.findUnique({
            where: { vulId: req.params.vulId }
        });
        
        if (!vulnerability) {
            return res.status(404).json({ error: 'Vulnerability not found' });
        }
        
        if (vulnerability.projectAddress !== projectAddress) {
            return res.status(403).json({ error: 'Not the project owner' });
        }
        
        if (vulnerability.status !== 'PENDING') {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        const updated = await prisma.vulnerability.update({
            where: { vulId: req.params.vulId },
            data: { status: 'ACCEPTED' }
        });
        
        await prisma.auditLog.create({
            data: {
                action: 'ACCEPT',
                vulnerabilityId: req.params.vulId,
                operator: projectAddress,
                operatorType: 'PROJECT',
                details: { previousStatus: 'PENDING' }
            }
        });
        
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/v1/settlement/vulnerabilities/:vulId/challenge
 * 项目方挑战漏洞
 */
router.post('/vulnerabilities/:vulId/challenge', async (req, res) => {
    try {
        const { projectAddress, reason, bond } = req.body;
        
        const vulnerability = await prisma.vulnerability.findUnique({
            where: { vulId: req.params.vulId }
        });
        
        if (!vulnerability) {
            return res.status(404).json({ error: 'Vulnerability not found' });
        }
        
        if (vulnerability.projectAddress !== projectAddress) {
            return res.status(403).json({ error: 'Not the project owner' });
        }
        
        if (vulnerability.status !== 'PENDING') {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        const updated = await prisma.vulnerability.update({
            where: { vulId: req.params.vulId },
            data: {
                status: 'CHALLENGED',
                challengeReason: reason,
                challengeBond: bond,
                challengeAt: new Date()
            }
        });
        
        await prisma.auditLog.create({
            data: {
                action: 'CHALLENGE',
                vulnerabilityId: req.params.vulId,
                operator: projectAddress,
                operatorType: 'PROJECT',
                details: { reason, bond }
            }
        });
        
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/v1/settlement/vulnerabilities/:vulId/submissions
 * 添加漏洞提交（审计师或AI）
 */
router.post('/vulnerabilities/:vulId/submissions', async (req, res) => {
    try {
        const { subVulId, submitter, walletAddress, agentId, confidence, qualityScore, ranking, pocQuality, fixQuality } = req.body;
        
        const vulnerability = await prisma.vulnerability.findUnique({
            where: { vulId: req.params.vulId }
        });
        
        if (!vulnerability) {
            return res.status(404).json({ error: 'Vulnerability not found' });
        }
        
        const submission = await prisma.submission.create({
            data: {
                vulId: req.params.vulId,
                subVulId,
                submitter,
                walletAddress,
                agentId,
                confidence,
                qualityScore,
                ranking,
                pocQuality,
                fixQuality
            }
        });
        
        // 更新漏洞总置信度
        await prisma.vulnerability.update({
            where: { vulId: req.params.vulId },
            data: {
                totalConfidence: {
                    increment: confidence
                }
            }
        });
        
        res.status(201).json(submission);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/v1/settlement/vulnerabilities/:vulId/settle
 * 结算奖励
 */
router.post('/vulnerabilities/:vulId/settle', async (req, res) => {
    try {
        const { txHash, blockNumber } = req.body;
        
        const vulnerability = await prisma.vulnerability.findUnique({
            where: { vulId: req.params.vulId },
            include: { submissions: true }
        });
        
        if (!vulnerability) {
            return res.status(404).json({ error: 'Vulnerability not found' });
        }
        
        if (vulnerability.status !== 'ACCEPTED' && vulnerability.status !== 'VALID') {
            return res.status(400).json({ error: 'Cannot settle: invalid status' });
        }
        
        // 计算奖励分配
        const sortedSubmissions = vulnerability.submissions
            .sort((a, b) => a.ranking - b.ranking);
        
        const totalBounty = parseFloat(vulnerability.bounty);
        const distributions = [];
        let totalDistributed = 0;
        
        for (const sub of sortedSubmissions.slice(0, 3)) {
            let baseShare = 0;
            if (sub.ranking === 1) baseShare = totalBounty * 0.7;
            else if (sub.ranking === 2) baseShare = totalBounty * 0.2;
            else if (sub.ranking === 3) baseShare = totalBounty * 0.1;
            
            // 应用校准乘数
            const multiplier = parseFloat(sub.calibrationMult || 100) / 100;
            const finalShare = baseShare * multiplier;
            
            distributions.push({
                address: sub.walletAddress,
                subVulId: sub.subVulId,
                ranking: sub.ranking,
                baseReward: baseShare,
                calibrationMult: sub.calibrationMult || 100,
                finalReward: finalShare
            });
            
            totalDistributed += finalShare;
            
            // 标记为已奖励
            await prisma.submission.update({
                where: { id: sub.id },
                data: {
                    rewarded: true,
                    rewardedAt: new Date(),
                    baseReward: baseShare,
                    calibratedReward: finalShare
                }
            });
        }
        
        // 创建奖励分配记录
        const rewardRecord = await prisma.rewardDistribution.create({
            data: {
                vulId: req.params.vulId,
                totalBounty,
                distributions,
                totalDistributed,
                txHash,
                blockNumber
            }
        });
        
        // 更新漏洞状态
        await prisma.vulnerability.update({
            where: { vulId: req.params.vulId },
            data: {
                status: 'SETTLED',
                settledAt: new Date()
            }
        });
        
        // 创建审计日志
        await prisma.auditLog.create({
            data: {
                action: 'SETTLE',
                vulnerabilityId: req.params.vulId,
                operator: 'SYSTEM',
                operatorType: 'SYSTEM',
                details: { totalDistributed, distributions }
            }
        });
        
        res.json({
            vulnerabilityId: req.params.vulId,
            rewardDistribution: rewardRecord,
            distributions
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/v1/settlement/vulnerabilities/:vulId/auto-accept
 * 超时自动接受 (由定时任务调用)
 */
router.post('/vulnerabilities/:vulId/auto-accept', async (req, res) => {
    try {
        const vulnerability = await prisma.vulnerability.findUnique({
            where: { vulId: req.params.vulId }
        });
        
        if (!vulnerability) {
            return res.status(404).json({ error: 'Vulnerability not found' });
        }
        
        if (vulnerability.status !== 'PENDING') {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        // 检查是否超时 (7天)
        const now = new Date();
        const createdAt = new Date(vulnerability.createdAt);
        const daysDiff = (now - createdAt) / (1000 * 60 * 60 * 24);
        
        if (daysDiff < 7) {
            return res.status(400).json({ 
                error: 'Challenge period not expired',
                daysRemaining: 7 - daysDiff
            });
        }
        
        const updated = await prisma.vulnerability.update({
            where: { vulId: req.params.vulId },
            data: { status: 'ACCEPTED' }
        });
        
        await prisma.auditLog.create({
            data: {
                action: 'TIMEOUT_AUTO_ACCEPT',
                vulnerabilityId: req.params.vulId,
                operator: 'SYSTEM',
                operatorType: 'SYSTEM',
                details: { daysSinceCreation: daysDiff }
            }
        });
        
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/settlement/statistics
 * 获取统计数据
 */
router.get('/statistics', async (req, res) => {
    try {
        const [
            totalVulnerabilities,
            pendingCount,
            acceptedCount,
            settledCount,
            challengedCount
        ] = await Promise.all([
            prisma.vulnerability.count(),
            prisma.vulnerability.count({ where: { status: 'PENDING' } }),
            prisma.vulnerability.count({ where: { status: 'ACCEPTED' } }),
            prisma.vulnerability.count({ where: { status: 'SETTLED' } }),
            prisma.vulnerability.count({ where: { status: 'CHALLENGED' } })
        ]);
        
        const rewardStats = await prisma.rewardDistribution.aggregate({
            _sum: { totalDistributed: true },
            _avg: { totalDistributed: true }
        });
        
        res.json({
            total: totalVulnerabilities,
            pending: pendingCount,
            accepted: acceptedCount,
            settled: settledCount,
            challenged: challengedCount,
            totalRewards: rewardStats._sum.totalDistributed || 0,
            avgReward: rewardStats._avg.totalDistributed || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
