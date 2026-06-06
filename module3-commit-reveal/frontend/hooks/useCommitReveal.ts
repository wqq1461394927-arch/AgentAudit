import { useState, useCallback } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { generateSalt, generateReportHash, verifyReveal } from "../utils/hash";
import type { Report } from "../utils/hash";
import { COMMIT_REVEAL_ABI, COMMIT_REVEAL_ADDRESS } from "../utils/abi";

/**
 * useCommitReveal — Commit-Reveal 全流程 Hook
 *
 * 封装:
 *   1. 本地生成 salt + reportHash
 *   2. 链上 commitReport()
 *   3. 链上 revealReport()
 *   4. 链上查询 submission 状态
 *   5. 前端本地验证 hash
 */

export interface SubmissionState {
  submissionId: number;
  submitter: `0x${string}`;
  commitHash: `0x${string}`;
  reportURI: string;
  commitTime: number;
  revealTime: number;
  revealed: boolean;
  valid: boolean;
}

export function useCommitReveal(taskId: bigint) {
  const { address } = useAccount();

  // ========== 本地状态 ==========
  const [salt, setSalt] = useState<`0x${string}` | null>(null);
  const [reportHash, setReportHash] = useState<`0x${string}` | null>(null);
  const [reportJson, setReportJson] = useState<string>("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);

  // ========== 链上写入 ==========
  const { writeContractAsync: commitAsync, data: commitTxHash } = useWriteContract();
  const { writeContractAsync: revealAsync, data: revealTxHash } = useWriteContract();

  const { isLoading: isCommitPending } = useWaitForTransactionReceipt({
    hash: commitTxHash,
  });

  const { isLoading: isRevealPending } = useWaitForTransactionReceipt({
    hash: revealTxHash,
  });

  // ========== 链上查询 ==========

  /** 是否已提交 */
  const { data: hasCommitted } = useReadContract({
    address: COMMIT_REVEAL_ADDRESS,
    abi: COMMIT_REVEAL_ABI,
    functionName: "hasCommitted",
    args: [taskId, address!],
    query: { enabled: !!address },
  });

  /** 查询 submission ID */
  const { data: submissionId } = useReadContract({
    address: COMMIT_REVEAL_ADDRESS,
    abi: COMMIT_REVEAL_ABI,
    functionName: "getSubmissionId",
    args: [taskId, address!],
    query: { enabled: !!address && !!hasCommitted },
  });

  /** 查询 submission 详情 */
  const { data: submission } = useReadContract({
    address: COMMIT_REVEAL_ADDRESS,
    abi: COMMIT_REVEAL_ABI,
    functionName: "taskSubmissions",
    args: [taskId, submissionId ?? 0n],
    query: {
      enabled: submissionId !== undefined && submissionId >= 0,
    },
  });

  // ========== 操作函数 ==========

  /** 步骤1: 本地生成 hash */
  const generateHash = useCallback(
    (reportData: Report) => {
      if (!address) return;
      const newSalt = generateSalt();
      const json = JSON.stringify(reportData);
      const hash = generateReportHash({
        taskId,
        agentAddress: address,
        report: reportData,
        salt: newSalt,
      });

      setSalt(newSalt);
      setReportJson(json);
      setReportHash(hash);

      return { salt: newSalt, reportHash: hash, reportJson: json };
    },
    [taskId, address]
  );

  /** 步骤2: 链上 commit */
  const commit = useCallback(async () => {
    if (!reportHash || !address) throw new Error("Missing reportHash or address");
    setIsCommitting(true);
    try {
      const tx = await commitAsync({
        address: COMMIT_REVEAL_ADDRESS,
        abi: COMMIT_REVEAL_ABI,
        functionName: "commitReport",
        args: [taskId, reportHash],
        value: BigInt(0), // MVP 阶段押金可设为 0
      });
      return tx;
    } finally {
      setIsCommitting(false);
    }
  }, [taskId, reportHash, address, commitAsync]);

  /** 步骤3: 链上 reveal */
  const reveal = useCallback(
    async (submissionIdx: number, uri: string) => {
      if (!salt || !reportJson || !address) throw new Error("Missing data");
      setIsRevealing(true);
      try {
        const tx = await revealAsync({
          address: COMMIT_REVEAL_ADDRESS,
          abi: COMMIT_REVEAL_ABI,
          functionName: "revealReport",
          args: [taskId, BigInt(submissionIdx), uri, reportJson, salt],
        });
        return tx;
      } finally {
        setIsRevealing(false);
      }
    },
    [taskId, salt, reportJson, address, revealAsync]
  );

  /** 本地验证 reveal 是否有效 */
  const verify = useCallback(
    (submittedHash: `0x${string}`) => {
      if (!salt || !reportJson || !address) return false;
      return verifyReveal(taskId, address, reportJson, salt, submittedHash);
    },
    [taskId, salt, reportJson, address]
  );

  return {
    // 状态
    salt,
    reportHash,
    reportJson,
    hasCommitted: !!hasCommitted,
    submissionId: submissionId !== undefined ? Number(submissionId) : undefined,
    submission: submission as SubmissionState | undefined,

    // 加载状态
    isCommitting,
    isRevealing,
    isCommitPending,
    isRevealPending,

    // 操作
    generateHash,
    commit,
    reveal,
    verify,
  };
}
