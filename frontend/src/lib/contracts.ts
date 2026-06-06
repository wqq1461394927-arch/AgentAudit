import { parseAbi } from "viem";

// ============================================================
// Contract ABIs (simplified inline ABIs)
// ============================================================

export const TaskManagerABI = parseAbi([
  // --- Task CRUD ---
  "function createTask(string name, string repo, address bountyToken, uint256 bountyAmount, uint256 maxAgents, string metadataURI) returns (uint256)",
  "function getTask(uint256 taskId) view returns (address owner, string name, string repo, address bountyToken, uint256 bountyAmount, uint256 maxAgents, string metadataURI, uint8 status, uint256 createdAt, uint256 deadline, uint256 agentCount)",
  "function getAllTaskIds() view returns (uint256[])",
  "function getTaskEscrowData(uint256 taskId) view returns (address escrowAddress, uint256 lockedAmount)",
  // --- Project Owner ---
  "function registerProjectOwner(string name, string email) external",
  "function getProjectOwner(address owner) view returns (string name, string email, uint256 tasksCreated, bool registered)",
  // --- Events ---
  "event TaskCreated(uint256 indexed taskId, address indexed owner, string name, uint256 bountyAmount)",
  "event TaskStatusUpdated(uint256 indexed taskId, uint8 oldStatus, uint8 newStatus)",
  "event AgentsAssigned(uint256 indexed taskId, address[] agents, uint256[] agentTypes)",
]);

export const BountyEscrowABI = parseAbi([
  "function lockBounty(uint256 taskId) external payable",
  "function getLockedAmount(uint256 taskId) view returns (uint256)",
  "function releaseBounty(uint256 taskId) external",
  "function distributeRewards(uint256 taskId, address[] calldata agents, uint256[] calldata amounts) external",
  "event BountyLocked(uint256 indexed taskId, address indexed depositor, uint256 amount)",
  "event BountyReleased(uint256 indexed taskId, address indexed recipient, uint256 amount)",
]);

export const AgentRegistryABI = parseAbi([
  // --- Agent Management ---
  "function registerAgent(string name, uint8 agentType, string endpoint, uint256 stakeAmount) external",
  "function getAgent(address agent) view returns (string name, uint8 agentType, string endpoint, uint256 reputation, uint256 tasksCompleted, bool registered, uint256 stakeAmount)",
  "function getDefaultAgents() view returns (address[])",
  // --- Task-Agent Assignment ---
  "function assignAgentsToTask(uint256 taskId, address[] agents, uint256[] agentTypes) external",
  "function getTaskAgents(uint256 taskId) view returns (address[], uint256[])",
  // --- Commit-Reveal ---
  "function commitFinding(uint256 taskId, bytes32 commitHash) external",
  "function revealFinding(uint256 taskId, string calldata findingData, string calldata salt) external",
  // --- Events ---
  "event AgentRegistered(address indexed agent, string name, uint8 agentType)",
  "event AgentsAssigned(uint256 indexed taskId, address[] agents)",
  "event FindingCommitted(uint256 indexed taskId, address indexed agent, bytes32 commitHash)",
  "event FindingRevealed(uint256 indexed taskId, address indexed agent)",
]);

// ============================================================
// Contract Addresses
// ============================================================

// Default addresses (Hardhat localhost deploy - replace with actual deploy addresses)
const DEFAULT_ADDRESSES = {
  TaskManager: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  BountyEscrow: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  AgentRegistry: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
};

type ContractName = keyof typeof DEFAULT_ADDRESSES;

export function getContractAddress(name: ContractName): `0x${string}` {
  const envKey = `NEXT_PUBLIC_${name.toUpperCase()}_ADDRESS`;
  const envValue = process.env[envKey];
  if (envValue) return envValue as `0x${string}`;
  return DEFAULT_ADDRESSES[name] as `0x${string}`;
}

// ============================================================
// Type Definitions
// ============================================================

/** Task status enum matching the Solidity contract */
export enum TaskStatus {
  Created = 0,
  Active = 1,
  Committing = 2,
  Revealing = 3,
  Clustering = 4,
  Challenging = 5,
  Settled = 6,
  Closed = 7,
}

/** Agent type enum */
export enum AgentType {
  Security = 0,
  Tokenomics = 1,
  Static = 2,
}

/** Parsed task data from contract */
export interface TaskData {
  owner: string;
  name: string;
  repo: string;
  bountyToken: string;
  bountyAmount: bigint;
  maxAgents: number;
  metadataURI: string;
  status: TaskStatus;
  createdAt: bigint;
  deadline: bigint;
  agentCount: number;
  id?: number;
}

/** Parsed agent data from contract */
export interface AgentData {
  name: string;
  agentType: AgentType;
  endpoint: string;
  reputation: bigint;
  tasksCompleted: bigint;
  registered: boolean;
  stakeAmount: bigint;
  address?: string;
}

// ============================================================
// Status & Type Helpers
// ============================================================

export const STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.Created]: "已创建",
  [TaskStatus.Active]: "活跃中",
  [TaskStatus.Committing]: "提交中",
  [TaskStatus.Revealing]: "公示中",
  [TaskStatus.Clustering]: "聚类中",
  [TaskStatus.Challenging]: "挑战中",
  [TaskStatus.Settled]: "已结算",
  [TaskStatus.Closed]: "已关闭",
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  [TaskStatus.Created]: "bg-gray-500",
  [TaskStatus.Active]: "bg-blue-500",
  [TaskStatus.Committing]: "bg-indigo-500",
  [TaskStatus.Revealing]: "bg-purple-500",
  [TaskStatus.Clustering]: "bg-yellow-500",
  [TaskStatus.Challenging]: "bg-orange-500",
  [TaskStatus.Settled]: "bg-green-500",
  [TaskStatus.Closed]: "bg-gray-700",
};

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  [AgentType.Security]: "安全审计",
  [AgentType.Tokenomics]: "经济模型",
  [AgentType.Static]: "静态分析",
};

export const ALL_PHASES: TaskStatus[] = [
  TaskStatus.Created,
  TaskStatus.Active,
  TaskStatus.Committing,
  TaskStatus.Revealing,
  TaskStatus.Clustering,
  TaskStatus.Challenging,
  TaskStatus.Settled,
  TaskStatus.Closed,
];

export const ALL_AGENT_TYPES: AgentType[] = [
  AgentType.Security,
  AgentType.Tokenomics,
  AgentType.Static,
];

// ============================================================
// Ethers v6 helpers (for utilities not covered by viem)
// ============================================================

export function formatEther(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(4);
}

export function formatAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatDate(ts: bigint | number): string {
  const d = new Date(Number(ts) * 1000);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
