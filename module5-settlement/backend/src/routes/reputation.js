/**
 * Reputation API - 声誉系统接口
 * 审计师和仲裁员声誉管理
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==================== 审计师 ====================

/**
 * POST /api/v1/reputation/auditors
 * 注册审计师
 */
router.post('/auditors', async (req, res) => {
    try {
        const { walletAddress, name, email } = req.body;
        
        const existing = await prisma.auditor.findUnique({
            where: { walletAddress }
        });
        
        if (existing) {
            return res.status(409).json({ error: 'Auditor already exists' });
        }
        
        const auditor = await prisma.auditor.create({
            data: {
                walletAddress,
                name,
                email,
                level: 'Rookie',
                maxSubmissions: 5
            }
        });
        
        await prisma.auditLog.create({
            data: {
                action: 'REGISTER',
                auditorId: auditor.id,
                operator: walletAddress,
                operatorType: 'AUDITOR',
                details: { name }
            }
        });
        
        res.status(201).json(auditor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/reputation/auditors
 * 获取审计师列表
 */
router.get('/auditors', async (req, res) => {
    try {
        const { level, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        let where = {};
        if (level) where.level = level;
        
        const [auditors, total] = await Promise.all([
            prisma.auditor.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { reputation: 'desc' }
            }),
            prisma.auditor.count({ where })
        ]);
        
        res.json({
            data: auditors,
            pagination: { page: parseInt(page), limit: parseInt(limit), total }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/reputation/auditors/:id
 * 获取审计师详情
 */
router.get('/auditors/:id', async (req, res) => {
    try {
        const auditor = await prisma.auditor.findUnique({
            where: { id: req.params.id }
        });
        
        if (!auditor) {
            return res.status(404).json({ error: 'Auditor not found' });
        }
        
        // 计算有效率
        const validRate = auditor.totalSubmissions > 0 
            ? (auditor.validSubmissions / auditor.totalSubmissions * 100).toFixed(2)
            : 0;
        
        res.json({
            ...auditor,
            validRate: `${validRate}%`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/v1/reputation/auditors/:id/update
 * 更新审计师声誉 (由结算后调用)
 */
router.post('/auditors/:id/update', async (req, res) => {
    try {
        const { isValid, bounty, action } = req.body;
        
        const auditor = await prisma.auditor.findUnique({
            where: { id: req.params.id }
        });
        
        if (!auditor) {
            return res.status(404).json({ error: 'Auditor not found' });
        }
        
        let newReputation = parseFloat(auditor.reputation);
        let newLevel = auditor.level;
        let newMaxSubmissions = auditor.maxSubmissions;
        
        // 更新统计数据
        const updates = {
            totalSubmissions: { increment: 1 },
            lastActive: new Date()
        };
        
        if (isValid) {
            updates.validSubmissions = { increment: 1 };
            updates.totalBounty = { increment: bounty };
            
            // 计算声誉增益
            const levelMultiplier = getLevelMultiplier(auditor.level);
            const gain = (parseFloat(bounty) / 1000) * levelMultiplier;
            newReputation += gain;
            
            // 检查升级
            newLevel = calculateLevel(newReputation);
            if (newLevel !== auditor.level) {
                newMaxSubmissions = 5 + getLevelNumber(newLevel) * 3;
                updates.level = newLevel;
                updates.maxSubmissions = newMaxSubmissions;
            }
        } else {
            // 失败惩罚
            newReputation = Math.max(0, newReputation - 10);
            updates.invalidSubmissions = { increment: 1 };
        }
        
        updates.reputation = newReputation;
        
        const updated = await prisma.auditor.update({
            where: { id: req.params.id },
            data: updates
        });
        
        await prisma.auditLog.create({
            data: {
                action: 'UPDATE_REP',
                auditorId: auditor.id,
                operator: 'SETTLEMENT_MODULE',
                operatorType: 'SYSTEM',
                details: { isValid, bounty, newReputation, levelUp: newLevel !== auditor.level }
            }
        });
        
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/reputation/auditors/leaderboard
 * 审计师排行榜
 */
router.get('/auditors/leaderboard', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        
        const auditors = await prisma.auditor.findMany({
            take: limit,
            orderBy: { reputation: 'desc' }
        });
        
        res.json(auditors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== 仲裁员 ====================

/**
 * POST /api/v1/reputation/jurors
 * 注册仲裁员
 */
router.post('/jurors', async (req, res) => {
    try {
        const { walletAddress, name, stake } = req.body;
        
        const existing = await prisma.juror.findUnique({
            where: { walletAddress }
        });
        
        if (existing) {
            return res.status(409).json({ error: 'Juror already exists' });
        }
        
        const juror = await prisma.juror.create({
            data: {
                walletAddress,
                name,
                stake,
                reputation: 100
            }
        });
        
        res.status(201).json(juror);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/reputation/jurors
 * 获取仲裁员列表
 */
router.get('/jurors', async (req, res) => {
    try {
        const { active, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        let where = {};
        if (active !== undefined) where.active = active === 'true';
        
        const [jurors, total] = await Promise.all([
            prisma.juror.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { reputation: 'desc' }
            }),
            prisma.juror.count({ where })
        ]);
        
        res.json({
            data: jurors,
            pagination: { page: parseInt(page), limit: parseInt(limit), total }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/v1/reputation/jurors/:id/slash
 * 惩罚仲裁员
 */
router.post('/jurors/:id/slash', async (req, res) => {
    try {
        const { percentage, reason } = req.body;
        
        if (![20, 50, 100].includes(percentage)) {
            return res.status(400).json({ error: 'Invalid percentage' });
        }
        
        const juror = await prisma.juror.findUnique({
            where: { id: req.params.id }
        });
        
        if (!juror) {
            return res.status(404).json({ error: 'Juror not found' });
        }
        
        const slashAmount = parseFloat(juror.stake) * percentage / 100;
        
        const updated = await prisma.juror.update({
            where: { id: req.params.id },
            data: {
                stake: parseFloat(juror.stake) - slashAmount,
                slashedAmount: parseFloat(juror.slashedAmount) + slashAmount,
                reputation: Math.max(0, parseFloat(juror.reputation) - 20)
            }
        });
        
        await prisma.auditLog.create({
            data: {
                action: 'SLASH',
                jurorId: juror.id,
                operator: 'SYSTEM',
                operatorType: 'SYSTEM',
                details: { percentage, slashAmount, reason }
            }
        });
        
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/reputation/jurors/leaderboard
 * 仲裁员排行榜
 */
router.get('/jurors/leaderboard', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        
        const jurors = await prisma.juror.findMany({
            where: { active: true },
            take: limit,
            orderBy: { reputation: 'desc' }
        });
        
        res.json(jurors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== 辅助函数 ====================

function getLevelMultiplier(level) {
    const multipliers = {
        'Rookie': 1,
        'Bronze': 2,
        'Silver': 3,
        'Gold': 4,
        'Elite': 5
    };
    return multipliers[level] || 1;
}

function getLevelNumber(level) {
    const numbers = {
        'Rookie': 0,
        'Bronze': 1,
        'Silver': 2,
        'Gold': 3,
        'Elite': 4
    };
    return numbers[level] || 0;
}

function calculateLevel(reputation) {
    const rep = parseFloat(reputation);
    if (rep >= 5000) return 'Elite';
    if (rep >= 2000) return 'Gold';
    if (rep >= 500) return 'Silver';
    if (rep >= 100) return 'Bronze';
    return 'Rookie';
}

module.exports = router;
