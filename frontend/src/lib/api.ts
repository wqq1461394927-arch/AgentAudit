// ============================================================
// Backend API Client
// Base URL: NEXT_PUBLIC_API_URL or http://localhost:3001
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;

  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(
        `API Error ${res.status}: ${errorBody || res.statusText}`
      );
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(`Network error: ${String(err)}`);
  }
}

// ============================================================
// Task API
// ============================================================

export async function fetchTasks() {
  return request<any[]>("/api/tasks");
}

export async function fetchTask(id: number | string) {
  return request<any>(`/api/tasks/${id}`);
}

export async function createTask(data: {
  name: string;
  repo: string;
  bountyToken: string;
  bountyAmount: string;
  maxAgents: number;
  metadataURI: string;
  owner?: string;
}) {
  return request<any>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ============================================================
// Agent API
// ============================================================

export async function fetchAgents() {
  return request<any[]>("/api/agents");
}

export async function fetchAgent(address: string) {
  return request<any>(`/api/agents/${address}`);
}

// ============================================================
// Task-Agent API
// ============================================================

export async function fetchTaskAgents(taskId: number | string) {
  return request<any[]>(`/api/tasks/${taskId}/agents`);
}

// ============================================================
// Bounty / Escrow API
// ============================================================

export async function fetchBountyLocked(taskId: number | string) {
  return request<{ lockedAmount: string; escrowAddress: string }>(
    `/api/tasks/${taskId}/bounty`
  );
}
