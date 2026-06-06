// ==================== 共享数据类型 ====================
// AgentAudit 平台跨模块统一数据模型

export interface Task {
  id: number;
  owner: string;
  bountyAmount: string;
  metadata: {
    name: string;
    repository: string;
    bounty: string;
    duration: number;
    agents: string[];
  };
  status: number;   // 0=等待中, 1=审计中, 2=Reveal, 3=聚类, 4=确认中, 5=已结算
  phase: string;
  createdAt: string;
  deadline: string;
}

export interface AuditReport {
  id: string;
  taskId: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  confidence: number;
  poc: string;
  agent: string;
  timestamp: string;
}

export interface CommitRecord {
  id: string;
  taskId: string;
  submitter: string;
  commitHash: string;
  commitTime: string;
  revealed: boolean;
  reportContent?: string;
  salt?: string;
}

export interface VulnCluster {
  vulId: string;
  taskId: string;
  title: string;
  severity: string;
  submitters: string[];
  commitTimes: string[];
  status: 'dispute_open' | 'finalized';
  disputeDeadline: string | null;
}

export interface SettlementVuln {
  vulId: string;
  title: string;
  bounty: number;
  status: 'pending' | 'accepted' | 'challenged' | 'rejected';
  deadline: string | null;
  submitters: number;
  _fromTask?: boolean;
}

// ==================== 共享状态 ====================
export interface SharedState {
  tasks: Task[];
  reports: AuditReport[];
  commits: CommitRecord[];
  clusters: VulnCluster[];
  settlements: SettlementVuln[];
}

// ==================== 初始演示数据 ====================
export const INIT_MOCK_TASKS: Task[] = [
  { id: 1, owner: '0x1234567890abcdef1234567890abcdef12345678', bountyAmount: '1000000000',
    createdAt: '1749200000', deadline: '1749459200', status: 1, phase: '1',
    metadata: { name: 'Vault Security Audit', repository: 'github.com/defi/vault', bounty: '1000', duration: 72, agents: ['Security','Tokenomics','Static'] } },
  { id: 2, owner: '0xabcdef1234567890abcdef1234567890abcdef12', bountyAmount: '500000000',
    createdAt: '1749100000', deadline: '1749700000', status: 5, phase: '5',
    metadata: { name: 'DEX Smart Contract Audit', repository: 'github.com/defi/dex', bounty: '500', duration: 168, agents: ['Security','Static'] } },
];

export const INIT_MOCK_CLUSTERS: VulnCluster[] = [
  { vulId: 'TASK-001-VUL-001', taskId: 'TASK-001', title: 'Vault.withdraw() Reentrancy Attack', severity: 'Critical',
    submitters: ['0xAgentA...F1', '0xAgentB...E2', '0xAgentC...D3'],
    commitTimes: ['2026-06-07 10:23:45', '2026-06-07 10:25:10', '2026-06-07 10:28:55'],
    status: 'dispute_open', disputeDeadline: '2026-06-08 12:00:00' },
  { vulId: 'TASK-001-VUL-002', taskId: 'TASK-001', title: 'Price Oracle Manipulation via Flashloan', severity: 'High',
    submitters: ['0xAgentD...C4'],
    commitTimes: ['2026-06-07 10:24:12'],
    status: 'finalized', disputeDeadline: null },
  { vulId: 'TASK-001-VUL-003', taskId: 'TASK-001', title: 'Unchecked Integer Overflow in stake()', severity: 'Medium',
    submitters: ['0xAgentE...B5', '0xAgentF...A6'],
    commitTimes: ['2026-06-07 10:25:01', '2026-06-07 10:30:44'],
    status: 'finalized', disputeDeadline: null },
  { vulId: 'TASK-002-VUL-001', taskId: 'TASK-002', title: 'swap() Missing Slippage Protection — Sandwich Attack', severity: 'Critical',
    submitters: ['0xAgentG...D7', '0xAgentH...E8'],
    commitTimes: ['2026-06-07 11:15:33', '2026-06-07 11:18:02'],
    status: 'finalized', disputeDeadline: null },
  { vulId: 'TASK-002-VUL-002', taskId: 'TASK-002', title: 'Liquidity Removal Missing Deadline Check', severity: 'High',
    submitters: ['0xAgentI...F9'],
    commitTimes: ['2026-06-07 11:16:21'],
    status: 'dispute_open', disputeDeadline: '2026-06-08 15:30:00' },
  { vulId: 'TASK-002-VUL-003', taskId: 'TASK-002', title: 'feeTo Zero-Address Lock / approve() Unsafe Pattern', severity: 'Medium',
    submitters: ['0xAgentJ...0A', '0xAgentK...1B'],
    commitTimes: ['2026-06-07 11:17:45', '2026-06-07 11:20:11'],
    status: 'finalized', disputeDeadline: null },
  { vulId: 'TASK-003-VUL-001', taskId: 'TASK-003', title: 'mint() Reentrancy Leading to Over-Minting', severity: 'Critical',
    submitters: ['0xAgentL...2C'],
    commitTimes: ['2026-06-07 12:05:08'],
    status: 'dispute_open', disputeDeadline: '2026-06-08 18:00:00' },
  { vulId: 'TASK-003-VUL-002', taskId: 'TASK-003', title: 'Royalty Calculation Precision Truncation / tokenURI DoS', severity: 'Medium',
    submitters: ['0xAgentM...3D', '0xAgentN...4E'],
    commitTimes: ['2026-06-07 12:06:30', '2026-06-07 12:09:55'],
    status: 'finalized', disputeDeadline: null },
  { vulId: 'TASK-004-VUL-001', taskId: 'TASK-004', title: 'Liquidation Missing Health Factor Floor Check', severity: 'Critical',
    submitters: ['0xAgentO...5F'],
    commitTimes: ['2026-06-07 13:20:14'],
    status: 'finalized', disputeDeadline: null },
  { vulId: 'TASK-004-VUL-002', taskId: 'TASK-004', title: 'Interest Rate Model Governance Attack / Oracle Delay Arbitrage', severity: 'High',
    submitters: ['0xAgentP...6G', '0xAgentQ...7H', '0xAgentR...8I'],
    commitTimes: ['2026-06-07 13:21:02', '2026-06-07 13:23:17', '2026-06-07 13:26:40'],
    status: 'dispute_open', disputeDeadline: '2026-06-08 20:00:00' },
];

export const INIT_MOCK_SETTLEMENTS: SettlementVuln[] = [
  { vulId: 'TASK-001-VUL-001', title: 'Vault.withdraw() Reentrancy Attack', bounty: 500, status: 'pending', deadline: '2026-06-14 12:00', submitters: 3 },
  { vulId: 'TASK-001-VUL-002', title: 'Price Oracle Manipulation', bounty: 300, status: 'accepted', deadline: null, submitters: 1 },
  { vulId: 'TASK-001-VUL-003', title: 'Unchecked Integer Overflow', bounty: 200, status: 'pending', deadline: '2026-06-14 18:00', submitters: 2 },
];
