import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type {
  Task, AuditReport, CommitRecord, VulnCluster, SettlementVuln, SharedState,
} from './types';
import { INIT_MOCK_TASKS, INIT_MOCK_CLUSTERS, INIT_MOCK_SETTLEMENTS } from './types';
import { fetchVulnerabilities, fetchAuditors } from './api';
import type { ApiVulnerability } from './api';

// ==================== 持久化 key ====================
const STORAGE_KEY = 'agentaudit_shared_state';

// ==================== Action 类型 ====================
type Action =
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'UPDATE_TASK'; payload: { id: number; changes: Partial<Task> } }
  | { type: 'ADD_REPORT'; payload: AuditReport }
  | { type: 'SET_REPORTS'; payload: AuditReport[] }
  | { type: 'ADD_COMMIT'; payload: CommitRecord }
  | { type: 'REVEAL_COMMIT'; payload: { commitHash: string; reportContent: string } }
  | { type: 'ADD_CLUSTER'; payload: VulnCluster }
  | { type: 'UPDATE_CLUSTER'; payload: { vulId: string; changes: Partial<VulnCluster> } }
  | { type: 'UPDATE_SETTLEMENT'; payload: { vulId: string; status: SettlementVuln['status']; deadline?: string | null } }
  | { type: 'ADD_SETTLEMENT'; payload: SettlementVuln }
  | { type: 'RESET' }
  | { type: 'SYNC_SETTLEMENTS'; payload: SettlementVuln[] }
  | { type: 'LOAD'; payload: SharedState };

// ==================== 工具函数 ====================

/** 映射后端状态到前端状态 */
function mapApiStatus(apiStatus: string): SettlementVuln['status'] {
  const map: Record<string, SettlementVuln['status']> = {
    PENDING: 'pending', ACCEPTED: 'accepted', CHALLENGED: 'challenged',
    ARBITRATING: 'challenged', VALID: 'accepted', INVALID: 'rejected',
    SETTLED: 'accepted',
  };
  return map[apiStatus] || 'pending';
}

/** 将后端漏洞数据转为前端 SettlementVuln */
function apiVulnToSettlement(v: ApiVulnerability): SettlementVuln {
  return {
    vulId: v.vulId,
    title: v.title,
    bounty: v.bounty || 0,
    status: mapApiStatus(v.status),
    deadline: null,
    submitters: v.submissions?.length || 1,
  };
}

/** 合并本地和后端 settlement 数据（本地已修改的优先保留） */
function mergeSettlements(local: SettlementVuln[], remote: SettlementVuln[]): SettlementVuln[] {
  if (remote.length === 0) return local;
  const remoteIds = new Set(remote.map(r => r.vulId));
  // 保留本地已修改过的（非初始pending/accepted），以及不在远程列表中的
  const localModified = local.filter(l => {
    const inRemote = remoteIds.has(l.vulId);
    const isModified = l.status === 'challenged' || l.status === 'rejected';
    return (isModified && inRemote) || !inRemote;
  });
  // 远程数据覆盖本地同名待确认/已接受
  const result = [...remote];
  for (const l of localModified) {
    if (!result.some(r => r.vulId === l.vulId)) {
      result.push(l);
    } else {
      // 本地已修改的优先
      const idx = result.findIndex(r => r.vulId === l.vulId);
      if (idx >= 0) result[idx] = l;
    }
  }
  return result;
}

// ==================== 初始状态 ====================
const initialState: SharedState = {
  tasks: INIT_MOCK_TASKS,
  reports: [],
  commits: [],
  clusters: INIT_MOCK_CLUSTERS,
  settlements: INIT_MOCK_SETTLEMENTS,
};

function reducer(state: SharedState, action: Action): SharedState {
  switch (action.type) {
    case 'ADD_TASK':
      // 去重
      if (state.tasks.some(t => t.id === action.payload.id)) return state;
      return { ...state, tasks: [...state.tasks, action.payload] };
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(t => t.id === action.payload.id
          ? { ...t, ...action.payload.changes } : t),
      };
    case 'ADD_REPORT':
      if (state.reports.some(r => r.id === action.payload.id)) return state;
      return { ...state, reports: [...state.reports, action.payload] };
    case 'SET_REPORTS':
      return { ...state, reports: action.payload };
    case 'ADD_COMMIT':
      if (state.commits.some(c => c.commitHash === action.payload.commitHash)) return state;
      return { ...state, commits: [...state.commits, action.payload] };
    case 'REVEAL_COMMIT':
      return {
        ...state,
        commits: state.commits.map(c => c.commitHash === action.payload.commitHash
          ? { ...c, revealed: true, reportContent: action.payload.reportContent } : c),
      };
    case 'ADD_CLUSTER':
      if (state.clusters.some(c => c.vulId === action.payload.vulId)) return state;
      return { ...state, clusters: [...state.clusters, action.payload] };
    case 'UPDATE_CLUSTER':
      return {
        ...state,
        clusters: state.clusters.map(c => c.vulId === action.payload.vulId
          ? { ...c, ...action.payload.changes } : c),
      };
    case 'UPDATE_SETTLEMENT':
      return {
        ...state,
        settlements: state.settlements.map(s => s.vulId === action.payload.vulId
          ? { ...s, status: action.payload.status, deadline: action.payload.deadline ?? s.deadline } : s),
      };
    case 'ADD_SETTLEMENT':
      if (state.settlements.some(s => s.vulId === action.payload.vulId)) return state;
      return { ...state, settlements: [...state.settlements, action.payload] };
    case 'RESET':
      return { ...initialState };
    case 'SYNC_SETTLEMENTS':
      // 从后端同步：保留本地已修改的记录，仅合并后端新增/更新的
      return {
        ...state,
        settlements: mergeSettlements(state.settlements, action.payload),
      };
    case 'LOAD':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

// ==================== 事件回调注册（简易事件总线） ====================
type EventType = 'task_created' | 'task_updated' | 'report_generated' | 'commit_added' | 'cluster_created' | 'cluster_updated' | 'settlement_updated' | 'reset';
type EventCallback = (payload?: any) => void;

let listeners: Map<EventType, EventCallback[]> = new Map();

function emit(event: EventType, payload?: any) {
  (listeners.get(event) || []).forEach(cb => cb(payload));
}

// ==================== Context ====================
interface StoreContextValue {
  state: SharedState;
  dispatch: React.Dispatch<Action>;
  /** 订阅事件，返回取消订阅函数 */
  on: (event: EventType, cb: EventCallback) => () => void;
  /** 手动从后端同步数据 */
  syncFromBackend: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

// ==================== 初始化状态（合并 sessionStorage） ====================
function loadFromStorage(): Partial<SharedState> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveToStorage(state: SharedState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      tasks: state.tasks,
      reports: state.reports,
      commits: state.commits,
      clusters: state.clusters,
      settlements: state.settlements,
    }));
  } catch { /* ignore */ }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, initialState, () => {
    const stored = loadFromStorage();
    if (stored) return { ...initialState, ...stored };
    return initialState;
  });

  // 启动时尝试从后端同步数据（静默，不影响离线运行）
  useEffect(() => {
    (async () => {
      try {
        const vulns = await fetchVulnerabilities();
        if (vulns.length > 0) {
          const settlements = vulns.map(apiVulnToSettlement);
          rawDispatch({ type: 'SYNC_SETTLEMENTS', payload: settlements });
        }
        const auditors = await fetchAuditors();
        if (auditors.length > 0) {
          // 审计师数据暂存一份到 sessionStorage 供模块5使用
          sessionStorage.setItem('agentaudit_api_auditors', JSON.stringify(auditors));
        }
      } catch { /* 后端不可用，使用本地数据 */ }
    })();
  }, []);

  // 包装 dispatch：写入后自动保存并发射事件
  const dispatch = useCallback((action: Action) => {
    rawDispatch(action);
    // 延迟保存（批量更新场景避免频繁写入）
    setTimeout(() => {
      // 用函数式更新获取最新状态
      // (reducer 是同步的，action 已经应用，但我们无法在这里读取最新 state)
      // 使用微任务延迟来确保在 reducer 生效后再保存
    }, 0);

    // 发射事件
    switch (action.type) {
      case 'ADD_TASK': emit('task_created', action.payload); break;
      case 'UPDATE_TASK': emit('task_updated', action.payload); break;
      case 'SET_REPORTS': emit('report_generated', action.payload); break;
      case 'ADD_COMMIT': emit('commit_added', action.payload); break;
      case 'REVEAL_COMMIT': emit('commit_added', action.payload); break;
      case 'ADD_CLUSTER': emit('cluster_created', action.payload); break;
      case 'UPDATE_CLUSTER': emit('cluster_updated', action.payload); break;
      case 'UPDATE_SETTLEMENT': emit('settlement_updated', action.payload); break;
      case 'SYNC_SETTLEMENTS': emit('settlement_updated', action.payload); break;
      case 'RESET': emit('reset'); break;
    }
  }, []);

  // 持久化到 sessionStorage
  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  // 手动同步函数（暴露给组件）
  const syncFromBackend = useCallback(async () => {
    try {
      const vulns = await fetchVulnerabilities();
      if (vulns.length > 0) {
        const settlements = vulns.map(apiVulnToSettlement);
        rawDispatch({ type: 'SYNC_SETTLEMENTS', payload: settlements });
      }
      const auditors = await fetchAuditors();
      if (auditors.length > 0) {
        sessionStorage.setItem('agentaudit_api_auditors', JSON.stringify(auditors));
      }
    } catch { /* 静默失败 */ }
  }, []);

  const on = useCallback((event: EventType, cb: EventCallback) => {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event)!.push(cb);
    return () => {
      const arr = listeners.get(event) || [];
      listeners.set(event, arr.filter(c => c !== cb));
    };
  }, []);

  return (
    <StoreContext.Provider value={{ state, dispatch, on, syncFromBackend }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

// ==================== 便利 hooks ====================
export function useTasks() {
  const { state, dispatch } = useStore();
  return {
    tasks: state.tasks,
    addTask: (t: Task) => dispatch({ type: 'ADD_TASK', payload: t }),
    updateTask: (id: number, changes: Partial<Task>) => dispatch({ type: 'UPDATE_TASK', payload: { id, changes } }),
  };
}

export function useReports() {
  const { state, dispatch } = useStore();
  return {
    reports: state.reports,
    addReport: (r: AuditReport) => dispatch({ type: 'ADD_REPORT', payload: r }),
    setReports: (reports: AuditReport[]) => dispatch({ type: 'SET_REPORTS', payload: reports }),
  };
}

export function useCommits() {
  const { state, dispatch } = useStore();
  return {
    commits: state.commits,
    addCommit: (c: CommitRecord) => dispatch({ type: 'ADD_COMMIT', payload: c }),
    reveal: (commitHash: string, reportContent: string) => dispatch({ type: 'REVEAL_COMMIT', payload: { commitHash, reportContent } }),
  };
}

export function useClusters() {
  const { state, dispatch } = useStore();
  return {
    clusters: state.clusters,
    addCluster: (c: VulnCluster) => dispatch({ type: 'ADD_CLUSTER', payload: c }),
    updateCluster: (vulId: string, changes: Partial<VulnCluster>) => dispatch({ type: 'UPDATE_CLUSTER', payload: { vulId, changes } }),
  };
}

export function useSettlements() {
  const { state, dispatch, syncFromBackend } = useStore();
  return {
    settlements: state.settlements,
    updateSettlement: (vulId: string, status: SettlementVuln['status']) => dispatch({ type: 'UPDATE_SETTLEMENT', payload: { vulId, status } }),
    addSettlement: (s: SettlementVuln) => dispatch({ type: 'ADD_SETTLEMENT', payload: s }),
    syncFromBackend,
  };
}
