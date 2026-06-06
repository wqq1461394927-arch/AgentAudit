/**
 * CommitReveal 合约 ABI & 部署地址
 *
 * ABI 由 Foundry/forge 编译生成，这里手工维护 MVP 用的核心接口。
 *
 * 部署地址：部署后用实际地址替换 __COMMIT_REVEAL_ADDRESS__
 */

export const COMMIT_REVEAL_ADDRESS = "0x__COMMIT_REVEAL_ADDRESS__" as `0x${string}`;

export const COMMIT_REVEAL_ABI = [
  // ======== 读函数 ========
  {
    name: "tasks",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [
      { name: "commitDeadline", type: "uint256" },
      { name: "revealDeadline", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "submissionCount", type: "uint256" },
    ],
  },
  {
    name: "taskSubmissions",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "taskId", type: "uint256" },
      { name: "index", type: "uint256" },
    ],
    outputs: [
      { name: "submitter", type: "address" },
      { name: "commitHash", type: "bytes32" },
      { name: "reportURI", type: "string" },
      { name: "salt", type: "bytes32" },
      { name: "commitTime", type: "uint256" },
      { name: "revealTime", type: "uint256" },
      { name: "revealed", type: "bool" },
      { name: "valid", type: "bool" },
    ],
  },
  {
    name: "hasCommitted",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "taskId", type: "uint256" },
      { name: "submitter", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getSubmissions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "submitter", type: "address" },
          { name: "commitHash", type: "bytes32" },
          { name: "reportURI", type: "string" },
          { name: "salt", type: "bytes32" },
          { name: "commitTime", type: "uint256" },
          { name: "revealTime", type: "uint256" },
          { name: "revealed", type: "bool" },
          { name: "valid", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getSubmissionCount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getSubmissionId",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "taskId", type: "uint256" },
      { name: "submitter", type: "address" },
    ],
    outputs: [{ name: "", type: "int256" }],
  },
  {
    name: "reportStake",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },

  // ======== 写函数 ========
  {
    name: "createTask",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "taskId", type: "uint256" },
      { name: "_commitDeadline", type: "uint256" },
      { name: "_revealDeadline", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "commitReport",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "taskId", type: "uint256" },
      { name: "reportHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "revealReport",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "taskId", type: "uint256" },
      { name: "submissionId", type: "uint256" },
      { name: "reportURI", type: "string" },
      { name: "reportJson", type: "string" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "updateTaskStatus",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "taskId", type: "uint256" },
      { name: "_status", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "setReportStake",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_reportStake", type: "uint256" }],
    outputs: [],
  },

  // ======== 事件 ========
  {
    name: "TaskCreated",
    type: "event",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "commitDeadline", type: "uint256", indexed: false },
      { name: "revealDeadline", type: "uint256", indexed: false },
    ],
  },
  {
    name: "Committed",
    type: "event",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "submitter", type: "address", indexed: true },
      { name: "commitHash", type: "bytes32", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "Revealed",
    type: "event",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "submissionId", type: "uint256", indexed: true },
      { name: "submitter", type: "address", indexed: true },
      { name: "valid", type: "bool", indexed: false },
    ],
  },
  {
    name: "TaskStatusUpdated",
    type: "event",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "status", type: "uint8", indexed: false },
    ],
  },
  {
    name: "ReportStakeUpdated",
    type: "event",
    inputs: [{ name: "newStake", type: "uint256", indexed: false }],
  },
] as const;
