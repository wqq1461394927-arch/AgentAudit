// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ITypes.sol";

/**
 * @title TaskManager
 * @notice 任务创建与生命周期管理 —— Module 1 核心合约
 * @dev 生命周期: Created → Active → Committing → Revealing → Clustering → Challenging → Settled → Closed
 */
contract TaskManager is AccessControl, ReentrancyGuard, ITypes {
    // ============ 事件 ============
    event TaskCreated(uint256 indexed taskId, address indexed owner, uint256 bounty, string metadataURI);
    event TaskActivated(uint256 indexed taskId, uint256 bounty);
    event TaskPhaseChanged(uint256 indexed taskId, TaskStatus oldStatus, TaskStatus newStatus);
    event ProjectOwnerRegistered(address indexed owner, string name, string githubRepo);
    event MetadataUpdated(uint256 indexed taskId, string newMetadataURI);
    event MaxAgentsUpdated(uint256 indexed taskId, uint256 newMax);

    // ============ 状态变量 ============
    uint256 public nextTaskId;
    mapping(uint256 => Task) public tasks;
    mapping(address => ProjectOwner) public projectOwners;
    uint256[] public allTaskIds;

    address public bountyEscrow;
    address public agentRegistry;
    address public deadlineController;

    // 阶段时长配置
    uint256 public maxTaskDuration = 30 days;
    uint256 public defaultCommitDuration = 48 hours;
    uint256 public defaultRevealDuration = 24 hours;
    uint256 public defaultChallengeDuration = 7 days;

    // ============ 修饰符 ============
    modifier onlyTaskOwner(uint256 _taskId) {
        require(tasks[_taskId].owner == msg.sender, "TM: not owner");
        _;
    }
    modifier validTask(uint256 _taskId) {
        require(_taskId > 0 && _taskId < nextTaskId, "TM: invalid task");
        _;
    }
    modifier inStatus(uint256 _taskId, TaskStatus _status) {
        require(tasks[_taskId].status == _status, "TM: bad status");
        _;
    }
    modifier onlyEscrow() {
        require(msg.sender == bountyEscrow, "TM: only Escrow");
        _;
    }
    modifier onlyDeadlineController() {
        require(msg.sender == deadlineController, "TM: only DC");
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        nextTaskId = 1;
    }

    // ============ 项目方注册 ============
    function registerProjectOwner(
        string calldata _name, string calldata _website,
        string calldata _githubRepo, string calldata _contactEmail
    ) external {
        require(projectOwners[msg.sender].registeredAt == 0, "TM: registered");
        projectOwners[msg.sender] = ProjectOwner(
            msg.sender, _name, _website, _githubRepo, _contactEmail, 0, 100, block.timestamp
        );
        emit ProjectOwnerRegistered(msg.sender, _name, _githubRepo);
    }

    // ============ 任务创建 ============
    function createTask(
        address _bountyToken, uint256 _bounty, string calldata _metadataURI, uint256 _maxAgents
    ) external returns (uint256 taskId) {
        require(_bountyToken != address(0) && _bounty > 0 && bytes(_metadataURI).length > 0 && _maxAgents > 0, "TM: bad args");
        taskId = nextTaskId++;
        tasks[taskId] = Task(
            taskId, msg.sender, _bountyToken, _bounty, block.timestamp,
            0, 0, 0, _maxAgents, _metadataURI, TaskStatus.Created
        );
        allTaskIds.push(taskId);
        if (projectOwners[msg.sender].registeredAt > 0) projectOwners[msg.sender].totalTasks++;
        emit TaskCreated(taskId, msg.sender, _bounty, _metadataURI);
    }

    // ============ 任务激活（BountyEscrow 回调） ============
    function activateTask(uint256 _taskId) external onlyEscrow validTask(_taskId) inStatus(_taskId, TaskStatus.Created) {
        Task storage t = tasks[_taskId];
        uint256 start = block.timestamp;
        t.commitDeadline = start + defaultCommitDuration;
        t.revealDeadline = t.commitDeadline + defaultRevealDuration;
        t.challengeDeadline = t.revealDeadline + defaultChallengeDuration;
        t.status = TaskStatus.Active;
        emit TaskActivated(_taskId, t.bounty);
        emit TaskPhaseChanged(_taskId, TaskStatus.Created, TaskStatus.Active);
    }

    // ============ 统一阶段切换（替代 5 个独立 transitionTo* 函数） ============
    function transitionPhase(uint256 _taskId, uint8 _from, uint8 _to)
        external onlyDeadlineController validTask(_taskId) inStatus(_taskId, TaskStatus(_from))
    {
        _transition(_taskId, TaskStatus(_to));
    }

    // closeTask 保持独立（开放调用权限）
    function closeTask(uint256 _taskId) external validTask(_taskId) inStatus(_taskId, TaskStatus.Settled) {
        _transition(_taskId, TaskStatus.Closed);
    }

    // ============ 任务管理 ============
    function updateMetadata(uint256 _taskId, string calldata _uri) external onlyTaskOwner(_taskId) validTask(_taskId) {
        tasks[_taskId].metadataURI = _uri;
        emit MetadataUpdated(_taskId, _uri);
    }
    function updateMaxAgents(uint256 _taskId, uint256 _n) external onlyTaskOwner(_taskId) validTask(_taskId) {
        require(_n > 0, "TM: zero max");
        tasks[_taskId].maxAgents = _n;
        emit MaxAgentsUpdated(_taskId, _n);
    }

    // ============ 跨合约查询 ============
    function getTaskEscrowData(uint256 _taskId) external view returns (
        uint256 id, address owner, address bountyToken, uint256 bounty, uint256 maxAgents, uint8 status
    ) {
        Task storage t = tasks[_taskId];
        return (t.id, t.owner, t.bountyToken, t.bounty, t.maxAgents, uint8(t.status));
    }
    function getTaskDeadlineData(uint256 _taskId) external view returns (
        uint256 id, uint256 createdAt, uint256 commitDeadline,
        uint256 revealDeadline, uint256 challengeDeadline, uint8 status
    ) {
        Task storage t = tasks[_taskId];
        return (t.id, t.createdAt, t.commitDeadline, t.revealDeadline, t.challengeDeadline, uint8(t.status));
    }

    // ============ 查询 ============
    function getTask(uint256 _taskId) external view returns (Task memory) { return tasks[_taskId]; }
    function getTaskCount() external view returns (uint256) { return nextTaskId - 1; }
    function getAllTaskIds() external view returns (uint256[] memory) { return allTaskIds; }
    function getProjectOwner(address _o) external view returns (ProjectOwner memory) { return projectOwners[_o]; }
    function isTaskOwner(uint256 _taskId, address _a) external view returns (bool) { return tasks[_taskId].owner == _a; }

    // ============ 管理 ============
    function setExternalContracts(address _e, address _a, address _d) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bountyEscrow = _e; agentRegistry = _a; deadlineController = _d;
    }
    function setDurations(uint256 _c, uint256 _r, uint256 _ch) external onlyRole(DEFAULT_ADMIN_ROLE) {
        defaultCommitDuration = _c; defaultRevealDuration = _r; defaultChallengeDuration = _ch;
    }

    // ============ 内部 ============
    function _transition(uint256 _taskId, TaskStatus _to) internal {
        TaskStatus old = tasks[_taskId].status;
        tasks[_taskId].status = _to;
        emit TaskPhaseChanged(_taskId, old, _to);
    }
}
