import { keccak256, encodeAbiParameters, parseAbiParameters } from "viem";

/**
 * Hash Generator — 哈希生成器
 *
 * 生成规则（与链上合约一致）:
 *   reportHash = keccak256(taskId, submitter, reportJson, salt)
 *
 * 注意：不要只 hash reportJson，否则同一份报告可能被复制复用。
 */

export interface Report {
  title: string;
  severity: "Critical" | "High" | "Medium" | "Low" | "Info";
  confidence: number;
  description: string;
  recommendation: string;
}

export interface HashInput {
  taskId: bigint;
  agentAddress: `0x${string}`;
  report: Report;
  salt: `0x${string}`;
}

/**
 * 生成随机 salt (32 bytes)
 */
export function generateSalt(): `0x${string}` {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return `0x${Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * 生成 reportHash
 * 与链上 keccak256(abi.encode(taskId, submitter, reportJson, salt)) 保持一致
 */
export function generateReportHash(input: HashInput): `0x${string}` {
  const { taskId, agentAddress, report, salt } = input;
  const reportJson = JSON.stringify(report);

  return keccak256(
    encodeAbiParameters(
      parseAbiParameters("uint256, address, string, bytes32"),
      [taskId, agentAddress, reportJson, salt]
    )
  );
}

/**
 * 验证 reveal：前端独立计算 hash 并与 commitHash 比对
 */
export function verifyReveal(
  taskId: bigint,
  submitter: `0x${string}`,
  reportJson: string,
  salt: `0x${string}`,
  commitHash: `0x${string}`
): boolean {
  const computedHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters("uint256, address, string, bytes32"),
      [taskId, submitter, reportJson, salt]
    )
  );
  return computedHash === commitHash;
}
