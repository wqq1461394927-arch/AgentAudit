// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/ITypes.sol";

/**
 * @title TaskManager
 * @notice 任务创建与生命周期管理 —— Module 1 核心合约
 * @dev 管理审计任务的完整生命周期:
 *      Created → Active → Committing → Revealing → Clustering → Challenging → Settled → Closed
 */
contract TaskManager is AccessControl, ReentrancyGuard, ITypes {
    // ============ 事件 ============
    event TaskCreated(uint256 indexed taskId, address indexed owner, uint256 bounty, string metadataURI);
    event TaskActivated(uint256 indexed taskId, uint256 bounty);
    event TaskPhaseChanged(uint256 indexed taskId, TaskStatus oldStatus, TaskStatus newStatus);
    event TaskClosed(uint256 indexed taskId);
    event ProjectOwnerRegistered(address indexed owner, string name, string githubRepo);
    event MetadataUpdated(uint256 indexed taskId, string newMetadataURI);
    event MaxAgentsUpdated(uint256 indexed taskId, uint256 newMax);

    // ============ 状态变量 ============
    uint256 public nextTaskId;
    mapping(uint256 => Task) public tasks;
    mapping(address => ProjectOwner) public projectOwners;
    uint256[] public allTaskIds;

    // 外部合约引用
    address public bountyEscrow;
    address public agentRegistry;
    address public deadlineController;

    // 配置参数
    uint256 public maxTaskDuration = 30 days;
    uint256 public defaultCommitDuration = 48 hours;
    uint256 public defaultRevealDuration = 24 hours;
    uint256 public defaultChallengeDuration = 7 days;

    // ============ 修饰符 ============
    modifier onlyTaskOwner(uint256 _taskId) {
        require(tasks[_taskId].owner == msg.sender, "TaskManager: not task owner");
        _;
    }

    modifier validTask(uint256 _taskId) {
        require(_taskId > 0 && _taskId < nextTaskId, "TaskManager: invalid task");
        _;
    }

    modifier inStatus(uint256 _taskId, TaskStatus _status) {
        require(tasks[_taskId].status == _status, "TaskManager: invalid status");
        _;
    }

    modifier onlyEscrow() {
        require(msg.sender == bountyEscrow, "TaskManager: only BountyEscrow");
        _;
    }

    modifier onlyDeadlineController() {
        require(msg.sender == deadlineController, "TaskManager: only DeadlineController");
        _;
    }

    // ============ 构造函数 ============
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        nextTaskId = 1; // 从 1 开始，0 视为无效
    }

    // ============ 项目方注册 ============

    /**
     * @notice 注册项目方身份
     * @param _name 项目名称
     * @param _website 官网
     * @param _githubRepo GitHub 仓库
     * @param _contactEmail 联系方式
     */
    function registerProjectOwner(
        string calldata _name,
        string calldata _website,
        string calldata _githubRepo,
        string calldata _contactEmail
    ) external {
        require(projectOwners[msg.sender].registeredAt == 0, "TaskManager: already registered");

        projectOwners[msg.sender] = ProjectOwner({
            owner: msg.sender,
            name: _name,
            website: _website,
            githubRepo: _githubRepo,
            contactEmail: _contactEmail,
            totalTasks: 0,
            reputation: 100,
            registeredAt: block.timestamp
        });

        emit ProjectOwnerRegistered(msg.sender, _name, _githubRepo);
    }

    // ============ 任务创建 ============

    /**
     * @notice 创建审计任务（创建后需调用 BountyEscrow.lockBounty 锁仓激活）
     * @param _bountyToken 赏金代币地址（推荐 USDC）
     * @param _bounty 赏金金额
     * @param _metadataURI 任务元数据 URI (IPFS/Arweave)
     * @param _maxAgents 最大参与 Agent 数量
     * @return taskId 任务 ID
     */
    function createTask(
        address _bountyToken,
        uint256 _bounty,
        string calldata _metadataURI,
        uint256 _maxAgents
    ) external returns (uint256 taskId) {
        require(_bountyToken != address(0), "TaskManager: zero token");
        require(_bounty > 0, "TaskManager: zero bounty");
        require(bytes(_metadataURI).length > 0, "TaskManager: empty metadata");
        require(_maxAgents > 0, "TaskManager: zero max agents");

        taskId = nextTaskId++;

        tasks[taskId] = Task({
            id: taskId,
            owner: msg.sender,
            bountyToken: _bountyToken,
            bounty: _bounty,
            createdAt: block.timestamp,
            commitDeadline: 0,
            revealDeadline: 0,
            challengeDeadline: 0,
            maxAgents: _maxAgents,
            metadataURI: _metadataURI,
            status: TaskStatus.Created
        });

        allTaskIds.push(taskId);

        if (projectOwners[msg.sender].registeredAt > 0) {
            projectOwners[msg.sender].totalTasks++;
        }

        emit TaskCreated(taskId, msg.sender, _bounty, _metadataURI);
    }

    // ============ 任务激活（由 BountyEscrow 回调） ============

    /**
     * @notice BountyEscrow 锁仓成功后回调激活任务
     * @param _taskId 任务 ID
     */
    function activateTask(uint256 _taskId) external onlyEscrow validTask(_taskId) inStatus(_taskId, TaskStatus.Created) {
        Task storage task = tasks[_taskId];

        uint256 start = block.timestamp;
        task.commitDeadline = start + defaultCommitDuration;
        task.revealDeadline = task.commitDeadline + defaultRevealDuration;
        task.challengeDeadline = task.revealDeadline + defaultChallengeDuration;
        task.status = TaskStatus.Active;

        emit TaskActivated(_taskId, task.bounty);
        emit TaskPhaseChanged(_taskId, TaskStatus.Created, TaskStatus.Active);
    }

    // ============ 阶段切换（由 DeadlineController 触发） ============

    function transitionToCommitting(uint256 _taskId)
        external
        onlyDeadlineController
        validTask(_taskId)
        inStatus(_taskId, TaskStatus.Active)
    {
        _transition(_taskId, TaskStatus.Committing);
    }

    function transitionToRevealing(uint256 _taskId)
        external
        onlyDeadlineController
        validTask(_taskId)
        inStatus(_taskId, TaskStatus.Committing)
    {
        _transition(_taskId, TaskStatus.Revealing);
    }

    function transitionToClustering(uint256 _taskId)
        external
        onlyDeadlineController
        validTask(_taskId)
        inStatus(_taskId, TaskStatus.Revealing)
    {
        _transition(_taskId, TaskStatus.Clustering);
    }

    function transitionToChallenging(uint256 _taskId)
        external
        onlyDeadlineController
        validTask(_taskId)
        inStatus(_taskId, TaskStatus.Clustering)
    {
        _transition(_taskId, TaskStatus.Challenging);
    }

    function transitionToSettled(uint256 _taskId)
        external
        onlyDeadlineController
        validTask(_taskId)
        inStatus(_taskId, TaskStatus.Challenging)
    {
        _transition(_taskId, TaskStatus.Settled);
    }

    function closeTask(uint256 _taskId)
        external
        validTask(_taskId)
        inStatus(_taskId, TaskStatus.Settled)
    {
        _transition(_taskId, TaskStatus.Closed);
    }

    // ============ 任务管理 ============

    function updateMetadata(uint256 _taskId, string calldata _newURI)
        external
        onlyTaskOwner(_taskId)
        validTask(_taskId)
    {
        tasks[_taskId].metadataURI = _newURI;
        emit MetadataUpdated(_taskId, _newURI);
    }

    function updateMaxAgents(uint256 _taskId, uint256 _newMax)
        external
        onlyTaskOwner(_taskId)
        validTask(_taskId)
    {
        require(_newMax > 0, "TaskManager: zero max agents");
        tasks[_taskId].maxAgents = _newMax;
        emit MaxAgentsUpdated(_taskId, _newMax);
    }

    // ============ 查询功能 (跨合约) ============

    /**
     * @notice 供 BountyEscrow 和 AgentRegistry 调用的精简任务数据查询
     */
    function getTaskEscrowData(uint256 _taskId) external view returns (
        uint256 id,
        address owner,
        address bountyToken,
        uint256 bounty,
        uint256 maxAgents,
        uint8 status
    ) {
        Task storage t = tasks[_taskId];
        return (t.id, t.owner, t.bountyToken, t.bounty, t.maxAgents, uint8(t.status));
    }

    /**
     * @notice 供 DeadlineController 调用的截止时间数据查询
     */
    function getTaskDeadlineData(uint256 _taskId) external view returns (
        uint256 id,
        uint256 createdAt,
        uint256 commitDeadline,
        uint256 revealDeadline,
        uint256 challengeDeadline,
        uint8 status
    ) {
        Task storage t = tasks[_taskId];
        return (t.id, t.createdAt, t.commitDeadline, t.revealDeadline, t.challengeDeadline, uint8(t.status));
    }

    // ============ 管理功能 ============

    function setExternalContracts(address _escrow, address _agentReg, address _deadlineCtrl)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        bountyEscrow = _escrow;
        agentRegistry = _agentReg;
        deadlineController = _deadlineCtrl;
    }

    function setDurations(uint256 _commit, uint256 _reveal, uint256 _challenge)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        defaultCommitDuration = _commit;
        defaultRevealDuration = _reveal;
        defaultChallengeDuration = _challenge;
    }

    // ============ 查询功能 ============

    function getTask(uint256 _taskId) external view returns (Task memory) {
        return tasks[_taskId];
    }

    function getTaskCount() external view returns (uint256) {
        return nextTaskId - 1;
    }

    function getAllTaskIds() external view returns (uint256[] memory) {
        return allTaskIds;
    }

    function getProjectOwner(address _owner) external view returns (ProjectOwner memory) {
        return projectOwners[_owner];
    }

    function isTaskOwner(uint256 _taskId, address _account) external view returns (bool) {
        return tasks[_taskId].owner == _account;
    }

    // ============ 内部函数 ============

    function _transition(uint256 _taskId, TaskStatus _newStatus) internal {
        TaskStatus old = tasks[_taskId].status;
        tasks[_taskId].status = _newStatus;
        emit TaskPhaseChanged(_taskId, old, _newStatus);
    }
}
