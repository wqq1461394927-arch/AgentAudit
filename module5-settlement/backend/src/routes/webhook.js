/**
 * Webhook API - 事件通知接口
 * Module 5: Settlement & Reputation System
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const axios = require('axios');

const prisma = new PrismaClient();

/**
 * POST /api/v1/webhooks
 * 创建Webhook配置
 */
router.post('/', async (req, res) => {
    try {
        const { name, event, url, secret, retryCount } = req.body;
        
        const webhook = await prisma.webhookConfig.create({
            data: {
                name,
                event,
                url,
                secret: secret || crypto.randomBytes(32).toString('hex'),
                retryCount: retryCount || 3
            }
        });
        
        res.status(201).json(webhook);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/webhooks
 * 获取Webhook列表
 */
router.get('/', async (req, res) => {
    try {
        const { active } = req.query;
        
        let where = {};
        if (active !== undefined) where.active = active === 'true';
        
        const webhooks = await prisma.webhookConfig.findMany({ where });
        res.json(webhooks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/v1/webhooks/:id
 * 删除Webhook
 */
router.delete('/:id', async (req, res) => {
    try {
        await prisma.webhookConfig.delete({
            where: { id: req.params.id }
        });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/v1/webhooks/trigger
 * 触发Webhook (内部调用)
 * 
 * Body:
 * - event: 事件类型
 * - data: 事件数据
 */
router.post('/trigger', async (req, res) => {
    try {
        const { event, data } = req.body;
        
        const webhooks = await prisma.webhookConfig.findMany({
            where: {
                event,
                active: true
            }
        });
        
        const results = await Promise.allSettled(
            webhooks.map(webhook => sendWebhook(webhook, data))
        );
        
        res.json({
            triggered: webhooks.length,
            succeeded: results.filter(r => r.status === 'fulfilled').length,
            failed: results.filter(r => r.status === 'rejected').length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== Webhook触发事件定义 ====================

/**
 * 触发漏洞接收事件
 */
async function triggerVulnerabilityReceived(vulId, bounty, project) {
    return triggerWebhook('VULNERABILITY_RECEIVED', {
        vulId,
        bounty,
        project,
        timestamp: new Date().toISOString()
    });
}

/**
 * 触发结算完成事件
 */
async function triggerSettlementCompleted(vulId, totalBounty, distributions) {
    return triggerWebhook('SETTLEMENT_COMPLETED', {
        vulId,
        totalBounty,
        distributions,
        timestamp: new Date().toISOString()
    });
}

/**
 * 触发仲裁开始事件
 */
async function triggerArbitrationStarted(vulId, reason) {
    return triggerWebhook('ARBITRATION_STARTED', {
        vulId,
        reason,
        timestamp: new Date().toISOString()
    });
}

/**
 * 触发审计师声誉更新事件
 */
async function triggerReputationUpdated(auditorId, newReputation, level) {
    return triggerWebhook('REPUTATION_UPDATED', {
        auditorId,
        newReputation,
        level,
        timestamp: new Date().toISOString()
    });
}

// ==================== 内部函数 ====================

async function triggerWebhook(module, event, data) {
    const webhooks = await prisma.webhookConfig.findMany({
        where: { module, event, active: true }
    });
    
    return Promise.allSettled(
        webhooks.map(webhook => sendWebhook(webhook, data))
    );
}

async function sendWebhook(webhook, data) {
    const payload = JSON.stringify(data);
    const signature = webhook.secret 
        ? crypto.createHmac('sha256', webhook.secret).update(payload).digest('hex')
        : null;
    
    const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': webhook.event,
        'X-Webhook-Module': webhook.module
    };
    
    if (signature) {
        headers['X-Webhook-Signature'] = signature;
    }
    
    let lastError;
    for (let i = 0; i < webhook.retryCount; i++) {
        try {
            const response = await axios.post(webhook.url, payload, { 
                headers,
                timeout: 10000 
            });
            return { success: true, status: response.status };
        } catch (error) {
            lastError = error;
            if (i < webhook.retryCount - 1) {
                await sleep(Math.pow(2, i) * 1000); // 指数退避
            }
        }
    }
    
    throw lastError;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = router;
module.exports.triggerVulnerabilityReceived = triggerVulnerabilityReceived;
module.exports.triggerSettlementCompleted = triggerSettlementCompleted;
module.exports.triggerArbitrationStarted = triggerArbitrationStarted;
module.exports.triggerReputationUpdated = triggerReputationUpdated;
