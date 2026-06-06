/**
 * Prisma Seed — 重置并填充演示数据
 * 
 * 用法:
 *   npx prisma db seed        (读 package.json 的 prisma.seed)
 *   node prisma/seed.js       (直接执行)
 *   POST /api/reset           (HTTP 接口)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==================== 演示数据 ====================

const demoAuditors = [
  { walletAddress: '0xAgentD000000000000000000000000C4', name: '安全审计专家 D', level: 'Gold', reputation: 8920, totalSubmissions: 19, validSubmissions: 18, invalidSubmissions: 1, totalBounty: 12500, maxSubmissions: 20 },
  { walletAddress: '0xAgentA000000000000000000000000F1', name: '安全审计专家 A', level: 'Silver', reputation: 6540, totalSubmissions: 14, validSubmissions: 12, invalidSubmissions: 2, totalBounty: 7800, maxSubmissions: 10 },
  { walletAddress: '0xAgentB000000000000000000000000E2', name: '代币经济审计师 B', level: 'Silver', reputation: 5410, totalSubmissions: 11, validSubmissions: 10, invalidSubmissions: 1, totalBounty: 6200, maxSubmissions: 10 },
  { walletAddress: '0xAgentE000000000000000000000000B5', name: '静态分析器 E', level: 'Bronze', reputation: 3200, totalSubmissions: 10, validSubmissions: 7, invalidSubmissions: 3, totalBounty: 3400, maxSubmissions: 7 },
  { walletAddress: '0xAgentC000000000000000000000000D3', name: '审计师 C', level: 'Rookie', reputation: 1200, totalSubmissions: 5, validSubmissions: 3, invalidSubmissions: 2, totalBounty: 800, maxSubmissions: 5 },
];

const demoAgents = [
  { agentId: 'security-1', name: '🔒 安全审计专家', description: '专注于重入攻击、权限控制、整数溢出等常见漏洞', calibration: 87, totalReports: 23, correctPredictions: 20, avgConfidence: 85, avgActualAccuracy: 82, reputation: 8920, multiplier: 95 },
  { agentId: 'tokenomics-1', name: '📊 代币经济审计师', description: '分析经济模型、闪电贷攻击、MEV风险', calibration: 82, totalReports: 15, correctPredictions: 12, avgConfidence: 78, avgActualAccuracy: 80, reputation: 6540, multiplier: 90 },
  { agentId: 'static-1', name: '🔍 静态代码分析器', description: '基于AST和模式匹配的自动代码检测', calibration: 91, totalReports: 41, correctPredictions: 37, avgConfidence: 90, avgActualAccuracy: 88, reputation: 9100, multiplier: 98 },
];

const demoJurors = [
  { walletAddress: '0xJuror00111111111111111111111111A1', name: '仲裁员 Alpha', stake: 5000, reputation: 95, totalVotes: 12, correctVotes: 11, incorrectVotes: 1 },
  { walletAddress: '0xJuror00222222222222222222222222B2', name: '仲裁员 Beta', stake: 3000, reputation: 88, totalVotes: 8, correctVotes: 7, incorrectVotes: 1 },
  { walletAddress: '0xJuror00333333333333333333333333C3', name: '仲裁员 Gamma', stake: 2000, reputation: 92, totalVotes: 10, correctVotes: 9, incorrectVotes: 1 },
];

const demoVulnerabilities = [
  { vulId: 'TASK-001-VUL-001', title: 'Vault.withdraw() Reentrancy Attack', description: 'The withdraw function sends ETH before updating state, allowing recursive re-entry via fallback function.', bounty: 500, status: 'PENDING', submitter: '0xAgentA...F1', projectAddress: '0x1234567890abcdef1234567890abcdef12345678', projectName: 'Vault Security Audit', totalConfidence: 92 },
  { vulId: 'TASK-001-VUL-002', title: 'Price Oracle Manipulation', description: 'Price oracle susceptible to flashloan manipulation via large borrow distortions.', bounty: 300, status: 'ACCEPTED', submitter: '0xAgentD...C4', projectAddress: '0x1234567890abcdef1234567890abcdef12345678', projectName: 'Vault Security Audit', totalConfidence: 78 },
  { vulId: 'TASK-001-VUL-003', title: 'Unchecked Integer Overflow in stake()', description: 'uint256 addition can overflow in Solidity < 0.8 without SafeMath.', bounty: 200, status: 'PENDING', submitter: '0xAgentE...B5', projectAddress: '0x1234567890abcdef1234567890abcdef12345678', projectName: 'Vault Security Audit', totalConfidence: 95 },
  { vulId: 'TASK-002-VUL-001', title: 'swap() Missing Slippage Protection', description: 'No minOut parameter allows sandwich attacks on user swaps.', bounty: 500, status: 'CHALLENGED', submitter: '0xAgentG...D7', projectAddress: '0xabcdef1234567890abcdef1234567890abcdef12', projectName: 'DEX Smart Contract Audit', totalConfidence: 91, challengeBond: 100, challengeReason: 'Slippage protection exists off-chain via frontend, not a contract-level issue.' },
];

// ==================== 重置函数 ====================

async function resetAll() {
  console.log('[Seed] 清空所有表...');
  await prisma.auditLog.deleteMany();
  await prisma.rewardDistribution.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.vulnerability.deleteMany();
  await prisma.arbitration.deleteMany();
  await prisma.juror.deleteMany();
  await prisma.auditor.deleteMany();
  await prisma.aIAgent.deleteMany();
  await prisma.webhookConfig.deleteMany();
  console.log('[Seed] 清空完成');
}

async function seedAll() {
  console.log('[Seed] 开始填充演示数据...');

  // 审计师
  for (const a of demoAuditors) {
    await prisma.auditor.create({ data: a });
  }
  console.log(`[Seed] 审计师: ${demoAuditors.length} 条`);

  // AI Agent
  for (const a of demoAgents) {
    await prisma.aIAgent.create({ data: a });
  }
  console.log(`[Seed] AI Agent: ${demoAgents.length} 条`);

  // 仲裁员
  for (const j of demoJurors) {
    await prisma.juror.create({ data: j });
  }
  console.log(`[Seed] 仲裁员: ${demoJurors.length} 条`);

  // 漏洞
  for (const v of demoVulnerabilities) {
    await prisma.vulnerability.create({ data: v });
  }
  console.log(`[Seed] 漏洞: ${demoVulnerabilities.length} 条`);

  // 提交 (VUL-001 的3个提交者)
  await prisma.submission.createMany({
    data: [
      { vulId: 'TASK-001-VUL-001', subVulId: 'SUB-001-A', submitter: '0xAgentA...F1', walletAddress: '0xAgentA000000000000000000000000F1', agentId: 'security-1', confidence: 92, qualityScore: 8.5, pocQuality: 8, fixQuality: 9, ranking: 1, baseReward: 350, calibratedReward: 332.5, calibrationMult: 0.95, rewarded: true, rewardedAt: new Date('2026-06-07T12:00:00Z') },
      { vulId: 'TASK-001-VUL-001', subVulId: 'SUB-001-B', submitter: '0xAgentB...E2', walletAddress: '0xAgentB000000000000000000000000E2', agentId: 'tokenomics-1', confidence: 85, qualityScore: 7.0, pocQuality: 7, fixQuality: 7, ranking: 2, baseReward: 100, calibratedReward: 90, calibrationMult: 0.90, rewarded: true, rewardedAt: new Date('2026-06-07T12:01:00Z') },
      { vulId: 'TASK-001-VUL-001', subVulId: 'SUB-001-C', submitter: '0xAgentC...D3', walletAddress: '0xAgentC000000000000000000000000D3', agentId: 'static-1', confidence: 88, qualityScore: 6.0, pocQuality: 6, fixQuality: 6, ranking: 3, baseReward: 50, calibratedReward: 49, calibrationMult: 0.98, rewarded: true, rewardedAt: new Date('2026-06-07T12:02:00Z') },
    ],
  });
  console.log('[Seed] 提交: 3 条');

  // 奖励分配
  await prisma.rewardDistribution.create({
    data: {
      vulId: 'TASK-001-VUL-001', totalBounty: 500, totalDistributed: 500,
      distributions: JSON.stringify([
        { address: '0xAgentA...F1', amount: 350, ranking: 1 },
        { address: '0xAgentB...E2', amount: 100, ranking: 2 },
        { address: '0xAgentC...D3', amount: 50, ranking: 3 },
      ]),
    },
  });
  console.log('[Seed] 奖励分配: 1 条');

  // 审计日志
  await prisma.auditLog.createMany({
    data: [
      { action: 'REGISTER', operator: 'SYSTEM', operatorType: 'SYSTEM', createdAt: new Date('2026-06-01T00:00:00Z') },
      { action: 'ACCEPT', vulnerabilityId: 'TASK-001-VUL-002', operator: '0x1234...5678', operatorType: 'PROJECT', createdAt: new Date('2026-06-07T14:00:00Z') },
      { action: 'SETTLE', vulnerabilityId: 'TASK-001-VUL-001', operator: 'SYSTEM', operatorType: 'SYSTEM', createdAt: new Date('2026-06-07T12:05:00Z') },
    ],
  });
  console.log('[Seed] 审计日志: 3 条');

  console.log('[Seed] 全部填充完毕 ✅');
}

// ==================== 入口 ====================
async function main() {
  try {
    await resetAll();
    await seedAll();
    console.log('\n🎉 数据库已重置为初始演示状态');
  } catch (e) {
    console.error('[Seed] 错误:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
