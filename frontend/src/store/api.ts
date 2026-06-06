/**
 * API 服务层 — 前端 ⇄ 后端数据桥接
 * 
 * 功能:
 *   - 从模块5后端 (:3005) 加载/同步数据
 *   - 从网关 (:3000) 加载任务/Agent数据
 *   - 所有调用失败时静默降级，不影响前端独立运行
 */

const M5_BASE = 'http://localhost:3005';
const GW_BASE = 'http://localhost:3000';

// ==================== 模块5 后端 API ====================

export interface ApiVulnerability {
  vulId: string;
  title: string;
  description?: string;
  bounty: number;
  status: string;  // PENDING | ACCEPTED | CHALLENGED | etc.
  submitter: string;
  projectAddress: string;
  projectName?: string;
  challengeBond?: number;
  challengeReason?: string;
  challengeAt?: string;
  createdAt: string;
  settledAt?: string;
  totalConfidence?: number;
  submissions?: ApiSubmission[];
}

export interface ApiSubmission {
  id: string;
  vulId: string;
  subVulId: string;
  submitter: string;
  walletAddress: string;
  ranking: number;
  confidence?: number;
  qualityScore?: number;
  calibratedReward?: number;
  baseReward?: number;
  rewarded: boolean;
}

export interface ApiAuditor {
  walletAddress: string;
  name: string;
  level: string;
  reputation: number;
  totalSubmissions: number;
  validSubmissions: number;
  invalidSubmissions: number;
  totalBounty: number;
}

export interface ApiAIAgent {
  agentId: string;
  name: string;
  calibration: number;
  totalReports: number;
  correctPredictions: number;
  reputation: number;
  multiplier: number;
}

export interface ApiSettlementStats {
  total: number;
  pending: number;
  accepted: number;
  settled: number;
  challenged: number;
  totalRewards: number;
}

// ── 漏洞列表 ─────────────────────────────────────
export async function fetchVulnerabilities(): Promise<ApiVulnerability[]> {
  try {
    const resp = await fetch(`${M5_BASE}/api/v1/settlement/vulnerabilities`);
    const json = await resp.json();
    return json.data || [];
  } catch {
    return [];
  }
}

// ── 接受漏洞 ─────────────────────────────────────
export async function acceptVulnerability(vulId: string, projectAddress = '0x1234...5678'): Promise<boolean> {
  try {
    const resp = await fetch(`${M5_BASE}/api/v1/settlement/vulnerabilities/${vulId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectAddress }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

// ── 挑战漏洞 ─────────────────────────────────────
export async function challengeVulnerability(vulId: string, reason: string, bond: number, projectAddress = '0x1234...5678'): Promise<boolean> {
  try {
    const resp = await fetch(`${M5_BASE}/api/v1/settlement/vulnerabilities/${vulId}/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectAddress, reason, bond }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

// ── 声誉排名 ─────────────────────────────────────
export async function fetchAuditors(): Promise<ApiAuditor[]> {
  try {
    const resp = await fetch(`${M5_BASE}/api/v1/reputation`);
    const json = await resp.json();
    return json.data || [];
  } catch {
    return [];
  }
}

// ── AI Agent 校准 ────────────────────────────────
export async function fetchAIAgents(): Promise<ApiAIAgent[]> {
  try {
    const resp = await fetch(`${M5_BASE}/api/v1/calibration`);
    const json = await resp.json();
    return json.data || [];
  } catch {
    return [];
  }
}

// ── 统计数据 ─────────────────────────────────────
export async function fetchSettlementStats(): Promise<ApiSettlementStats | null> {
  try {
    const resp = await fetch(`${M5_BASE}/api/v1/settlement/statistics`);
    const json = await resp.json();
    return json;
  } catch {
    return null;
  }
}

// ── 数据库重置 ───────────────────────────────────
export async function resetDatabase(): Promise<boolean> {
  try {
    const resp = await fetch(`${M5_BASE}/api/reset`, { method: 'POST' });
    return resp.ok;
  } catch {
    return false;
  }
}

// ── 网关健康检查 ─────────────────────────────────
export async function checkGatewayHealth(): Promise<boolean> {
  try {
    const resp = await fetch(`${GW_BASE}/api/health`);
    return resp.ok;
  } catch {
    return false;
  }
}

// ── 模块5健康检查 ────────────────────────────────
export async function checkM5Health(): Promise<boolean> {
  try {
    const resp = await fetch(`${M5_BASE}/health`);
    return resp.ok;
  } catch {
    return false;
  }
}
