// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ITypes.sol";
import "./ITaskManager.sol";

/**
 * @title AgentRegistry
 * @notice Agent 注册与任务分配 —— Commit-Reveal 漏洞提交机制
 * @dev 项目方可自由选择参与任务的 Agent 类型，支持第三方开发者发布自定义 Agent
 */
contract AgentRegistry is AccessControl, ReentrancyGuard, ITypes {
    event AgentRegistered(address indexed agent, string name, AgentType agentType);
    event AgentUpdated(address indexed agent);
    event AgentSuspended(address indexed agent);
    event AgentReactivated(address indexed agent);
    event TaskAgentAssigned(uint256 indexed taskId, address indexed agent, AgentType agentType);
    event AgentCommitted(uint256 indexed taskId, address indexed agent, bytes32 commitHash);
    event AgentRevealed(uint256 indexed taskId, address indexed agent);

    ITaskManager public immutable taskManager;

    mapping(address => Agent) public agents;
    address[] public agentList;

    mapping(uint256 => mapping(address => TaskAgentConfig)) public taskAgents;
    mapping(uint256 => address[]) public taskAgentList;
    mapping(uint256 => mapping(address => CommitRecord)) public commits;

    address public securityAgent;
    address public tokenomicsAgent;
    address public staticAnalysisAgent;

    modifier onlyActiveAgent() {
        require(agents[msg.sender].status == AgentStatus.Active, "AR: not active");
        _;
    }

    constructor(address _tm) {
        require(_tm != address(0), "AR: zero addr");
        taskManager = ITaskManager(_tm);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ============ Agent 注册 ============
    function registerAgent(string calldata _name, AgentType _agentType, string calldata _endpoint) external {
        require(bytes(_name).length > 0, "AR: empty name");
        require(agents[msg.sender].registeredAt == 0, "AR: registered");
        agents[msg.sender] = Agent(msg.sender, _name, _agentType, _endpoint, 0, 0, 100, AgentStatus.Active, block.timestamp);
        agentList.push(msg.sender);
        emit AgentRegistered(msg.sender, _name, _agentType);
    }

    // ============ 默认 Agent ============
    function setDefaultAgent(AgentType _t, address _a) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_a != address(0) && agents[_a].status == AgentStatus.Active, "AR: bad agent");
        if (_t == AgentType.Security) securityAgent = _a;
        else if (_t == AgentType.Tokenomics) tokenomicsAgent = _a;
        else staticAnalysisAgent = _a;
    }
    function getDefaultAgents() external view returns (address, address, address) {
        return (securityAgent, tokenomicsAgent, staticAnalysisAgent);
    }

    // ============ 任务-Agent 分配 ============
    function assignAgentsToTask(uint256 _taskId, address[] calldata _addrs) external {
        (uint256 _id, address taskOwner, address _token, uint256 _bounty, uint256 maxAgents, uint8 _stat) = taskManager.getTaskEscrowData(_taskId);
        _id; _token; _bounty; _stat;
        require(taskOwner == msg.sender, "AR: not owner");
        require(taskAgentList[_taskId].length + _addrs.length <= maxAgents, "AR: exceeds max");

        for (uint256 i = 0; i < _addrs.length; i++) {
            address a = _addrs[i];
            require(agents[a].status == AgentStatus.Active, "AR: not active");
            require(taskAgents[_taskId][a].assignedAt == 0, "AR: assigned");
            taskAgents[_taskId][a] = TaskAgentConfig(_taskId, a, agents[a].agentType, block.timestamp, false, false);
            taskAgentList[_taskId].push(a);
            agents[a].totalTasks++;
            emit TaskAgentAssigned(_taskId, a, agents[a].agentType);
        }
    }

    // ============ Commit-Reveal ============
    function commitFinding(uint256 _taskId, bytes32 _hash) external onlyActiveAgent {
        TaskAgentConfig storage cfg = taskAgents[_taskId][msg.sender];
        require(cfg.assignedAt > 0, "AR: not assigned");
        require(!cfg.hasCommitted, "AR: committed");
        (uint256 _i, address _o, address _t, uint256 _b, uint256 _m, uint8 status) = taskManager.getTaskEscrowData(_taskId);
        _i; _o; _t; _b; _m;
        require(status == uint8(TaskStatus.Committing), "AR: not committing");

        cfg.hasCommitted = true;
        commits[_taskId][msg.sender] = CommitRecord(_hash, _taskId, msg.sender, block.timestamp, false);
        emit AgentCommitted(_taskId, msg.sender, _hash);
    }

    function revealFinding(uint256 _taskId, bytes calldata _finding, bytes32 _salt) external onlyActiveAgent {
        TaskAgentConfig storage cfg = taskAgents[_taskId][msg.sender];
        require(cfg.assignedAt > 0 && cfg.hasCommitted && !cfg.hasRevealed, "AR: bad state");
        (uint256 _i, address _o, address _t, uint256 _b, uint256 _m, uint8 status) = taskManager.getTaskEscrowData(_taskId);
        _i; _o; _t; _b; _m;
        require(status == uint8(TaskStatus.Revealing), "AR: not revealing");
        require(keccak256(abi.encode(_taskId, msg.sender, _finding, _salt)) == commits[_taskId][msg.sender].commitHash, "AR: hash mismatch");

        cfg.hasRevealed = true;
        commits[_taskId][msg.sender].revealed = true;
        emit AgentRevealed(_taskId, msg.sender);
    }

    function slashNonRevealers(uint256 _taskId, address[] calldata _addrs) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i = 0; i < _addrs.length; i++) {
            TaskAgentConfig storage cfg = taskAgents[_taskId][_addrs[i]];
            if (cfg.hasCommitted && !cfg.hasRevealed) {
                uint256 rep = agents[_addrs[i]].reputation;
                agents[_addrs[i]].reputation = rep > 20 ? rep - 20 : 1;
            }
        }
    }

    // ============ 管理 ============
    function suspendAgent(address _a) external onlyRole(DEFAULT_ADMIN_ROLE) {
        agents[_a].status = AgentStatus.Suspended;
        emit AgentSuspended(_a);
    }
    function reactivateAgent(address _a) external onlyRole(DEFAULT_ADMIN_ROLE) {
        agents[_a].status = AgentStatus.Active;
        emit AgentReactivated(_a);
    }
    function updateAgentEndpoint(address _a, string calldata _ep) external {
        require(msg.sender == _a || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "AR: unauth");
        agents[_a].endpoint = _ep;
        emit AgentUpdated(_a);
    }

    // ============ 查询 ============
    function getAgent(address _a) external view returns (Agent memory) { return agents[_a]; }
    function getAgentList() external view returns (address[] memory) { return agentList; }
    function getTaskAgents(uint256 _id) external view returns (address[] memory) { return taskAgentList[_id]; }
    function getTaskAgentConfig(uint256 _id, address _a) external view returns (TaskAgentConfig memory) { return taskAgents[_id][_a]; }
    function getCommitRecord(uint256 _id, address _a) external view returns (CommitRecord memory) { return commits[_id][_a]; }
    function getAgentCount() external view returns (uint256) { return agentList.length; }
}
