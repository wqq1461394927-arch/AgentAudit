// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITypes
 * @notice 协议全局类型、枚举、结构体定义
 */
interface ITypes {
    // ============ 任务生命周期状态 ============
    enum TaskStatus {
        Created,       // 任务已创建（待锁仓激活）
        Active,        // 资金已锁仓，任务活跃
        Committing,    // Commit 阶段：Agent 提交漏洞 Hash
        Revealing,     // Reveal 阶段：Agent 公开漏洞报告
        Clustering,    // 聚类阶段：对漏洞去重归并
        Challenging,   // 挑战阶段：项目方可挑战聚类结果
        Settled,       // 已结算：赏金分配完成
        Closed         // 已关闭
    }

    // ============ Agent 类型 ============
    enum AgentType {
        Security,       // 安全 Agent：重入攻击/权限绕过/业务逻辑漏洞
        Tokenomics,     // 经济 Agent：治理攻击/闪电贷/经济模型风险
        StaticAnalysis  // 静态分析 Agent：危险调用/整数溢出/未授权访问
    }

    // ============ Agent 状态 ============
    enum AgentStatus {
        Inactive,
        Active,
        Suspended
    }

    // ============ 罚款类型 ============
    enum PenaltyType {
        None,
        FalseReport,       // 提交虚假报告
        Plagiarism,        // 抄袭他人报告
        Spam,              // 垃圾提交
        Collusion          // 串通作弊
    }

    // ============ 任务 ============
    struct Task {
        uint256 id;
        address owner;                      // 项目方地址
        address bountyToken;                // 赏金代币地址 (USDC)
        uint256 bounty;                     // 赏金总额
        uint256 createdAt;
        uint256 commitDeadline;             // Commit 阶段截止
        uint256 revealDeadline;             // Reveal 阶段截止
        uint256 challengeDeadline;          // Challenge 阶段截止
        uint256 maxAgents;                  // 最大参与 Agent 数量
        string metadataURI;                 // 任务元数据 URI (IPFS/Arweave)
        TaskStatus status;
    }

    // ============ Agent 信息 ============
    struct Agent {
        address agentAddress;
        string name;
        AgentType agentType;
        string endpoint;                    // Agent API 端点
        uint256 totalTasks;
        uint256 successfulFinds;
        uint256 reputation;                 // 信誉分
        AgentStatus status;
        uint256 registeredAt;
    }

    // ============ Task-Agent 关联 ============
    struct TaskAgentConfig {
        uint256 taskId;
        address agent;
        AgentType agentType;
        uint256 assignedAt;
        bool hasCommitted;                  // 是否已完成 Commit
        bool hasRevealed;                   // 是否已完成 Reveal
    }

    // ============ Commit 记录 ============
    struct CommitRecord {
        bytes32 commitHash;                 // keccak256(finding + salt)
        uint256 taskId;
        address agent;
        uint256 timestamp;
        bool revealed;                      // 是否已 Reveal
    }

    // ============ 项目方信息 ============
    struct ProjectOwner {
        address owner;
        string name;
        string website;
        string githubRepo;
        string contactEmail;
        uint256 totalTasks;
        uint256 reputation;                 // 历史信誉
        uint256 registeredAt;
    }
}
