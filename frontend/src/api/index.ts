const GATEWAY = '/api';
const MODULE5 = '/api/v1';

async function request(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

/** ── 模块1: 任务市场 ── */
export const taskApi = {
  list: () => request(`${GATEWAY}/tasks`),
  detail: (id: number) => request(`${GATEWAY}/tasks/${id}`),
  create: (data: Record<string, unknown>) =>
    request(`${GATEWAY}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  agents: (id: number) => request(`${GATEWAY}/tasks/${id}/agents`),
};

export const agentApi = {
  list: () => request(`${GATEWAY}/agents`),
  detail: (addr: string) => request(`${GATEWAY}/agents/${addr}`),
};

export const bountyApi = {
  locked: (taskId: number) => request(`${GATEWAY}/bounties/locked/${taskId}`),
  total: (token?: string) =>
    request(`${GATEWAY}/bounties/total${token ? `?token=${token}` : ''}`),
};

export const healthApi = {
  check: () => request(`${GATEWAY}/health`),
};

/** ── 模块5: 结算与声誉 ── */
export const settlementApi = {
  listVulnerabilities: (taskId?: number) =>
    request(`${MODULE5}/settlement/vulnerabilities${taskId ? `?taskId=${taskId}` : ''}`),
  accept: (vulId: string) =>
    request(`${MODULE5}/settlement/accept`, {
      method: 'POST',
      body: JSON.stringify({ vulId }),
    }),
  challenge: (vulId: string, reason: string) =>
    request(`${MODULE5}/settlement/challenge`, {
      method: 'POST',
      body: JSON.stringify({ vulId, reason }),
    }),
  distribution: (taskId?: number) =>
    request(`${MODULE5}/settlement/distribution${taskId ? `?taskId=${taskId}` : ''}`),
};

export const reputationApi = {
  list: () => request(`${MODULE5}/reputation`),
  detail: (addr: string) => request(`${MODULE5}/reputation/${addr}`),
  leaderboard: () => request(`${MODULE5}/reputation/leaderboard`),
};

export const calibrationApi = {
  list: () => request(`${MODULE5}/calibration`),
  detail: (agentId: string) => request(`${MODULE5}/calibration/${agentId}`),
};
