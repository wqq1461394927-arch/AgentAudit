/**
 * Calibration API - AI校准系统接口
 * 记录AI Agent的预测置信度与实际准确度
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * POST /api/v1/calibration/agents
 * 注册AI Agent
 */
router.post('/agents', async (req, res) => {
    try {
        const { agentId, name, description } = req.body;
        
        const existing = await prisma.aIAgent.findUnique({
            where: { agentId }
        });
        
        if (existing) {
            return res.status(409).json({ error: 'Agent already exists' });
        }
        
        const agent = await prisma.aIAgent.create({
            data: {
                agentId,
                name,
                description,
                calibration: 0,
                multiplier: 100
            }
        });
        
        res.status(201).json(agent);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/calibration/agents
 * 获取AI Agent列表
 */
router.get('/agents', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [agents, total] = await Promise.all([
            prisma.aIAgent.findMany({
                skip,
                take: parseInt(limit),
                orderBy: { calibration: 'desc' }
            }),
            prisma.aIAgent.count()
        ]);
        
        res.json({
            data: agents,
            pagination: { page: parseInt(page), limit: parseInt(limit), total }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/calibration/agents/:id
 * 获取AI Agent详情
 */
router.get('/agents/:id', async (req, res) => {
    try {
        const agent = await prisma.aIAgent.findUnique({
            where: { id: req.params.id }
        });
        
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        
        // 计算置信度偏差
        const confidenceDeviation = agent.avgConfidence - agent.avgActualAccuracy;
        
        res.json({
            ...agent,
            confidenceDeviation,
            performanceGrade: getPerformanceGrade(agent.calibration)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/v1/calibration/agents/:id/report
 * 上报AI预测结果 (由结算后调用)
 * 
 * Body:
 * - confidence: 预测时的置信度
 * - actuallyCorrect: 是否实际正确
 */
router.post('/agents/:id/report', async (req, res) => {
    try {
        const { confidence, actuallyCorrect } = req.body;
        
        const agent = await prisma.aIAgent.findUnique({
            where: { id: req.params.id }
        });
        
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        
        const newTotalReports = agent.totalReports + 1;
        const newCorrectPredictions = actuallyCorrect 
            ? agent.correctPredictions + 1 
            : agent.correctPredictions;
        
        // 计算新校准度
        const newCalibration = (newCorrectPredictions / newTotalReports) * 100;
        
        // 计算新平均置信度
        const newAvgConfidence = (
            parseFloat(agent.avgConfidence) * agent.totalReports + confidence
        ) / newTotalReports;
        
        // 计算新实际准确度
        const newAvgAccuracy = (
            parseFloat(agent.avgActualAccuracy) * agent.totalReports + 
            (actuallyCorrect ? 100 : 0)
        ) / newTotalReports;
        
        // 计算新声誉
        const newReputation = parseFloat(agent.reputation) + (actuallyCorrect ? 5 : 0);
        
        // 计算新校准乘数
        const newMultiplier = calculateMultiplier(newCalibration);
        
        const updated = await prisma.aIAgent.update({
            where: { id: req.params.id },
            data: {
                totalReports: newTotalReports,
                correctPredictions: newCorrectPredictions,
                calibration: newCalibration,
                avgConfidence: newAvgConfidence,
                avgActualAccuracy: newAvgAccuracy,
                reputation: newReputation,
                multiplier: newMultiplier,
                lastCalibration: new Date()
            }
        });
        
        await prisma.auditLog.create({
            data: {
                action: 'CALIBRATION_UPDATE',
                agentId: agent.id,
                operator: 'SETTLEMENT_MODULE',
                operatorType: 'SYSTEM',
                details: { 
                    confidence, 
                    actuallyCorrect, 
                    newCalibration,
                    newMultiplier 
                }
            }
        });
        
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/calibration/agents/:id/multiplier
 * 获取校准乘数
 */
router.get('/agents/:id/multiplier', async (req, res) => {
    try {
        const agent = await prisma.aIAgent.findUnique({
            where: { id: req.params.id }
        });
        
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        
        res.json({
            agentId: agent.agentId,
            name: agent.name,
            calibration: agent.calibration,
            multiplier: agent.multiplier,
            grade: getPerformanceGrade(agent.calibration)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/calibration/agents/:id/calibrate
 * 计算校准后奖励
 * 
 * Query:
 * - baseReward: 基础奖励金额
 */
router.get('/agents/:id/calibrate', async (req, res) => {
    try {
        const { baseReward } = req.query;
        
        const agent = await prisma.aIAgent.findUnique({
            where: { id: req.params.id }
        });
        
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        
        const baseAmount = parseFloat(baseReward);
        const multiplier = parseFloat(agent.multiplier) / 100;
        const calibratedReward = baseAmount * multiplier;
        
        res.json({
            agentId: agent.agentId,
            baseReward: baseAmount,
            calibration: agent.calibration,
            multiplier: agent.multiplier,
            calibratedReward,
            grade: getPerformanceGrade(agent.calibration)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/calibration/leaderboard
 * AI Agent排行榜
 */
router.get('/leaderboard', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const sortBy = req.query.sortBy || 'calibration';
        
        const agents = await prisma.aIAgent.findMany({
            take: limit,
            orderBy: { [sortBy]: 'desc' }
        });
        
        res.json(agents.map(a => ({
            ...a,
            grade: getPerformanceGrade(a.calibration)
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/calibration/statistics
 * 获取校准统计
 */
router.get('/statistics', async (req, res) => {
    try {
        const agents = await prisma.aIAgent.findMany();
        
        if (agents.length === 0) {
            return res.json({
                totalAgents: 0,
                avgCalibration: 0,
                avgConfidence: 0,
                avgAccuracy: 0
            });
        }
        
        const stats = {
            totalAgents: agents.length,
            avgCalibration: agents.reduce((sum, a) => sum + parseFloat(a.calibration), 0) / agents.length,
            avgConfidence: agents.reduce((sum, a) => sum + parseFloat(a.avgConfidence), 0) / agents.length,
            avgAccuracy: agents.reduce((sum, a) => sum + parseFloat(a.avgActualAccuracy), 0) / agents.length,
            gradeDistribution: {
                excellent: agents.filter(a => parseFloat(a.calibration) >= 90).length,
                good: agents.filter(a => parseFloat(a.calibration) >= 80 && parseFloat(a.calibration) < 90).length,
                average: agents.filter(a => parseFloat(a.calibration) >= 70 && parseFloat(a.calibration) < 80).length,
                poor: agents.filter(a => parseFloat(a.calibration) < 70).length
            }
        };
        
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/calibration/analysis/:id
 * 获取AI Agent校准分析
 */
router.get('/analysis/:id', async (req, res) => {
    try {
        const agent = await prisma.aIAgent.findUnique({
            where: { id: req.params.id }
        });
        
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        
        const calibration = parseFloat(agent.calibration);
        const confidence = parseFloat(agent.avgConfidence);
        const accuracy = parseFloat(agent.avgActualAccuracy);
        
        // 校准分析
        const analysis = {
            agentId: agent.agentId,
            name: agent.name,
            totalReports: agent.totalReports,
            calibration,
            avgConfidence: confidence,
            avgActualAccuracy: accuracy,
            
            // 校准偏差
            deviation: confidence - accuracy,
            isOverconfident: confidence > accuracy + 10,
            isUnderconfident: confidence < accuracy - 10,
            isWellCalibrated: Math.abs(confidence - accuracy) <= 10,
            
            // 表现评估
            grade: getPerformanceGrade(calibration),
            multiplier: agent.multiplier,
            
            // 建议
            suggestions: []
        };
        
        if (analysis.isOverconfident) {
            analysis.suggestions.push('Agent tends to be overconfident. Consider reducing confidence estimates.');
        }
        if (analysis.isUnderconfident) {
            analysis.suggestions.push('Agent tends to be underconfident. It might be too conservative.');
        }
        if (calibration < 70) {
            analysis.suggestions.push('Calibration is low. Agent should focus on improving prediction accuracy.');
        }
        
        res.json(analysis);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== 辅助函数 ====================

function calculateMultiplier(calibration) {
    const calib = parseFloat(calibration);
    if (calib >= 90) return 120;
    if (calib >= 80) return 110;
    if (calib >= 70) return 100;
    if (calib >= 60) return 90;
    if (calib >= 50) return 80;
    return 50;
}

function getPerformanceGrade(calibration) {
    const calib = parseFloat(calibration);
    if (calib >= 90) return 'A (Excellent)';
    if (calib >= 80) return 'B (Good)';
    if (calib >= 70) return 'C (Average)';
    if (calib >= 60) return 'D (Below Average)';
    return 'F (Poor)';
}

module.exports = router;
