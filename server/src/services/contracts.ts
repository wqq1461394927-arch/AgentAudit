import { ethers, Contract, JsonRpcProvider } from 'ethers';
import { config } from '../config';

let provider: JsonRpcProvider | null = null;

export function getProvider(): JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(config.rpc.url, config.rpc.chainId);
  }
  return provider;
}

// ──────────── ABI fragments ────────────

const TASK_MANAGER_ABI = [
  'function tasks(uint256) view returns (tuple(uint256 id, address owner, string title, string description, uint256 bountyToken, uint256 bountyAmount, uint8 agentCount, uint8 status, uint256 createdAt, uint256 deadline))',
  'function taskCount() view returns (uint256)',
  'function getTask(uint256 taskId) view returns (tuple(uint256 id, address owner, string title, string description, uint256 bountyToken, uint256 bountyAmount, uint8 agentCount, uint8 status, uint256 createdAt, uint256 deadline))',
];

const BOUNTY_ESCROW_ABI = [
  'function lockedBounties(address,uint256) view returns (uint256)',
  'function totalLockedByToken(address) view returns (uint256)',
  'function getLockedBounty(address token, uint256 taskId) view returns (uint256)',
];

const AGENT_REGISTRY_ABI = [
  'function isRegistered(address) view returns (bool)',
  'function getAgent(address agent) view returns (tuple(address agentAddress, string name, uint8 reputation, bool registered))',
  'function getAllAgents() view returns (tuple(address agentAddress, string name, uint8 reputation, bool registered)[])',
  'function getTaskAgents(uint256 taskId) view returns (address[])',
  'function getCommitRecord(uint256 taskId, address agent) view returns (tuple(bytes32 commitHash, bool revealed, bytes32 revealData, uint256 timestamp))',
  'function registeredAgentCount() view returns (uint256)',
];

// ──────────── Contract instances (lazy) ────────────

let taskManagerContract: Contract | null = null;
let bountyEscrowContract: Contract | null = null;
let agentRegistryContract: Contract | null = null;

export function getTaskManagerContract(): Contract {
  if (!taskManagerContract) {
    taskManagerContract = new ethers.Contract(
      config.contracts.taskManager,
      TASK_MANAGER_ABI,
      getProvider()
    );
  }
  return taskManagerContract;
}

export function getBountyEscrowContract(): Contract {
  if (!bountyEscrowContract) {
    bountyEscrowContract = new ethers.Contract(
      config.contracts.bountyEscrow,
      BOUNTY_ESCROW_ABI,
      getProvider()
    );
  }
  return bountyEscrowContract;
}

export function getAgentRegistryContract(): Contract {
  if (!agentRegistryContract) {
    agentRegistryContract = new ethers.Contract(
      config.contracts.agentRegistry,
      AGENT_REGISTRY_ABI,
      getProvider()
    );
  }
  return agentRegistryContract;
}

// ──────────── Task operations ────────────

export interface TaskInfo {
  id: number;
  owner: string;
  title: string;
  description: string;
  bountyToken: string;
  bountyAmount: bigint;
  agentCount: number;
  status: number;
  createdAt: bigint;
  deadline: bigint;
}

export async function getTask(taskId: number): Promise<TaskInfo> {
  try {
    const contract = getTaskManagerContract();
    const task = await contract.getTask(taskId);
    return {
      id: Number(task.id),
      owner: task.owner,
      title: task.title,
      description: task.description,
      bountyToken: task.bountyToken,
      bountyAmount: BigInt(task.bountyAmount),
      agentCount: Number(task.agentCount),
      status: Number(task.status),
      createdAt: BigInt(task.createdAt),
      deadline: BigInt(task.deadline),
    };
  } catch (err) {
    throw new Error(`Failed to get task ${taskId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function getAllTasks(): Promise<TaskInfo[]> {
  try {
    const contract = getTaskManagerContract();
    const count = await contract.taskCount();
    const tasks: TaskInfo[] = [];
    for (let i = 1; i <= Number(count); i++) {
      try {
        const task = await contract.getTask(i);
        tasks.push({
          id: Number(task.id),
          owner: task.owner,
          title: task.title,
          description: task.description,
          bountyToken: task.bountyToken,
          bountyAmount: BigInt(task.bountyAmount),
          agentCount: Number(task.agentCount),
          status: Number(task.status),
          createdAt: BigInt(task.createdAt),
          deadline: BigInt(task.deadline),
        });
      } catch {
        // Skip tasks that fail to load
        continue;
      }
    }
    return tasks;
  } catch (err) {
    throw new Error(`Failed to get all tasks: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ──────────── Agent operations ────────────

export async function getTaskAgents(taskId: number): Promise<string[]> {
  try {
    const contract = getAgentRegistryContract();
    const agents = await contract.getTaskAgents(taskId);
    return agents;
  } catch (err) {
    throw new Error(`Failed to get agents for task ${taskId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export interface CommitRecord {
  commitHash: string;
  revealed: boolean;
  revealData: string;
  timestamp: bigint;
}

export async function getCommitRecord(taskId: number, agent: string): Promise<CommitRecord> {
  try {
    const contract = getAgentRegistryContract();
    const record = await contract.getCommitRecord(taskId, agent);
    return {
      commitHash: record.commitHash,
      revealed: record.revealed,
      revealData: record.revealData,
      timestamp: BigInt(record.timestamp),
    };
  } catch (err) {
    throw new Error(
      `Failed to get commit record for task ${taskId}, agent ${agent}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
