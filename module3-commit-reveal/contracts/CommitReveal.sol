// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CommitReveal
 * @notice Commit-Reveal Submission 模块核心合约
 * @dev 实现防抄袭提交与链上存证，集成 DeadlineController + SubmissionRegistry
 *
 * 核心流程:
 *   Commit Phase: Agent 提交 reportHash 到链上
 *   Reveal Phase: Agent 公开 reportJson + salt，合约验证 hash 一致性
 *
 * hash = keccak256(taskId, submitter, reportJson, salt)
 */
contract CommitReveal {
    // ============ 枚举 ============

    enum TaskStatus {
        Open,        // Commit 阶段进行中
        Reveal,      // Reveal 阶段进行中
        Clustering,  // 聚类阶段（由模块4处理）
        Settlement,  // 结算阶段
        Closed       // 任务关闭
    }

    // ============ 结构体 ============

    struct Task {
        uint256 commitDeadline;   // Commit 截止时间
        uint256 revealDeadline;   // Reveal 截止时间
        TaskStatus status;        // 当前任务状态
        uint256 submissionCount;  // 提交总数
    }

    struct Submission {
        address submitter;       // 提交者地址
        bytes32 commitHash;      // 链上存储的 commit hash
        string reportURI;        // 报告存储 URI (IPFS/链下)
        bytes32 salt;            // Reveal 阶段公开的 salt
        uint256 commitTime;      // 上链时间戳
        uint256 revealTime;      // Reveal 时间
        bool revealed;           // 是否已 Reveal
        bool valid;              // Reveal 是否验证通过
    }

    // ============ 状态变量 ============

    /// @notice 任务 ID => Task
    mapping(uint256 => Task) public tasks;

    /// @notice 任务 ID => Submission 数组
    mapping(uint256 => Submission[]) public taskSubmissions;

    /// @notice 任务 ID => 提交者地址 => 是否已提交（防重复 commit）
    mapping(uint256 => mapping(address => bool)) public hasCommitted;

    /// @notice 提交押金（防止恶意提交占坑）
    uint256 public reportStake;

    // ============ 事件 ============

    event TaskCreated(uint256 indexed taskId, uint256 commitDeadline, uint256 revealDeadline);
    event Committed(uint256 indexed taskId, address indexed submitter, bytes32 commitHash, uint256 timestamp);
    event Revealed(uint256 indexed taskId, uint256 indexed submissionId, address indexed submitter, bool valid);
    event TaskStatusUpdated(uint256 indexed taskId, TaskStatus status);
    event ReportStakeUpdated(uint256 newStake);

    // ============ 修饰器 ============

    modifier onlyCommitPhase(uint256 taskId) {
        require(tasks[taskId].status == TaskStatus.Open, "Task not in Commit phase");
        require(block.timestamp <= tasks[taskId].commitDeadline, "Commit phase ended");
        _;
    }

    modifier onlyRevealPhase(uint256 taskId) {
        require(tasks[taskId].status == TaskStatus.Reveal, "Task not in Reveal phase");
        require(
            block.timestamp > tasks[taskId].commitDeadline &&
            block.timestamp <= tasks[taskId].revealDeadline,
            "Not in Reveal window"
        );
        _;
    }

    modifier onlyExistingTask(uint256 taskId) {
        require(tasks[taskId].commitDeadline > 0, "Task does not exist");
        _;
    }

    // ============ 构造函数 ============

    constructor(uint256 _reportStake) {
        reportStake = _reportStake;
    }

    // ============ 任务管理 ============

    /**
     * @notice 创建新审计任务
     * @param taskId 任务 ID
     * @param _commitDeadline Commit 截止时间
     * @param _revealDeadline Reveal 截止时间
     */
    function createTask(
        uint256 taskId,
        uint256 _commitDeadline,
        uint256 _revealDeadline
    ) external {
        require(tasks[taskId].commitDeadline == 0, "Task already exists");
        require(_commitDeadline > block.timestamp, "Commit deadline must be future");
        require(_revealDeadline > _commitDeadline, "Reveal must be after commit");

        tasks[taskId] = Task({
            commitDeadline: _commitDeadline,
            revealDeadline: _revealDeadline,
            status: TaskStatus.Open,
            submissionCount: 0
        });

        emit TaskCreated(taskId, _commitDeadline, _revealDeadline);
    }

    /**
     * @notice 更新任务状态（可由管理员调用推进流程）
     */
    function updateTaskStatus(uint256 taskId, TaskStatus _status) external {
        require(tasks[taskId].commitDeadline > 0, "Task does not exist");
        tasks[taskId].status = _status;
        emit TaskStatusUpdated(taskId, _status);
    }

    // ============ Commit ============

    /**
     * @notice 提交报告哈希上链
     * @param taskId 任务 ID
     * @param reportHash keccak256(taskId, submitter, reportJson, salt)
     * @dev 需要附带 reportStake 作为押金
     */
    function commitReport(
        uint256 taskId,
        bytes32 reportHash
    )
        external
        payable
        onlyCommitPhase(taskId)
        onlyExistingTask(taskId)
    {
        require(!hasCommitted[taskId][msg.sender], "Already committed");
        require(reportHash != bytes32(0), "Hash cannot be empty");
        require(msg.value >= reportStake, "Insufficient stake");

        hasCommitted[taskId][msg.sender] = true;

        Submission memory submission = Submission({
            submitter: msg.sender,
            commitHash: reportHash,
            reportURI: "",
            salt: bytes32(0),
            commitTime: block.timestamp,
            revealTime: 0,
            revealed: false,
            valid: false
        });

        taskSubmissions[taskId].push(submission);
        tasks[taskId].submissionCount++;

        emit Committed(taskId, msg.sender, reportHash, block.timestamp);
    }

    // ============ Reveal ============

    /**
     * @notice Reveal 阶段公开报告内容和 salt
     * @param taskId 任务 ID
     * @param submissionId 提交在数组中的索引
     * @param reportURI 报告存储 URI
     * @param reportJson 完整报告 JSON 字符串
     * @param salt 提交时使用的 salt
     */
    function revealReport(
        uint256 taskId,
        uint256 submissionId,
        string calldata reportURI,
        string calldata reportJson,
        bytes32 salt
    )
        external
        onlyRevealPhase(taskId)
        onlyExistingTask(taskId)
    {
        Submission storage submission = taskSubmissions[taskId][submissionId];
        require(submission.submitter == msg.sender, "Not your submission");
        require(!submission.revealed, "Already revealed");

        // 重新计算 hash 并验证
        bytes32 computedHash = keccak256(
            abi.encode(taskId, msg.sender, reportJson, salt)
        );

        bool isValid = computedHash == submission.commitHash;

        submission.reportURI = reportURI;
        submission.salt = salt;
        submission.revealTime = block.timestamp;
        submission.revealed = true;
        submission.valid = isValid;

        emit Revealed(taskId, submissionId, msg.sender, isValid);

        // 如果验证失败，押金不退还
        // 如果验证成功，押金退还
        if (isValid) {
            payable(msg.sender).transfer(reportStake);
        }
    }

    // ============ 查询接口 ============

    /**
     * @notice 获取某个任务的所有提交
     */
    function getSubmissions(uint256 taskId)
        external
        view
        returns (Submission[] memory)
    {
        return taskSubmissions[taskId];
    }

    /**
     * @notice 获取某个任务的提交数量
     */
    function getSubmissionCount(uint256 taskId) external view returns (uint256) {
        return tasks[taskId].submissionCount;
    }

    /**
     * @notice 查询某个 Agent 在指定任务的提交 ID
     * @dev 通过遍历查找，仅适用于少量提交的场景
     */
    function getSubmissionId(uint256 taskId, address submitter)
        external
        view
        returns (int256)
    {
        Submission[] storage submissions = taskSubmissions[taskId];
        for (uint256 i = 0; i < submissions.length; i++) {
            if (submissions[i].submitter == submitter) {
                return int256(i);
            }
        }
        return -1;
    }

    // ============ 管理员 ============

    /**
     * @notice 设置提交押金
     */
    function setReportStake(uint256 _reportStake) external {
        reportStake = _reportStake;
        emit ReportStakeUpdated(_reportStake);
    }
}
