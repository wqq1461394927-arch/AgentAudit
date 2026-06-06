// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/ITypes.sol";

/**
 * @title AgentRegistry
 * @notice Agent 注册与配置系统
 * @dev 管理 AI 安全审计 Agent 的注册、发现和任务分配。
 *      项目方可自由选择参与任务的 Agent 类型。
 *      未来支持第三方开发者发布自定义 Agent。
 */
contract AgentRegistry is AccessControl, ReentrancyGuard, ITypes {
    // ============ 事件 ============
    event AgentRegistered(address indexed agent, string name, AgentType agentType);
    event AgentUpdated(address indexed agent);
    event AgentSuspended(address indexed agent);
    event AgentReactivated(address indexed agent);
    event TaskAgentAssigned(uint256 indexed taskId, address indexed agent, AgentType agentType);
    event TaskAgentRemoved(uint256 indexed taskId, address indexed agent);
    event AgentCommitted(uint256 indexed taskId, address indexed agent, bytes32 commitHash);
    event AgentRevealed(uint256 indexed taskId, address indexed agent);

    // ============ 状态变量 ============
    address public taskManager;

    // 所有已注册 Agent
    mapping(address => Agent) public agents;
    address[] public agentList;

    // taskId => agent => TaskAgentConfig
    mapping(uint256 => mapping(address => TaskAgentConfig)) public taskAgents;

    // taskId => agent address list
    mapping(uint256 => address[]) public taskAgentList;

    // Commit 记录: taskId => agent => CommitRecord
    mapping(uint256 => mapping(address => CommitRecord)) public commits;

    // 默认系统 Agent 地址
    address public securityAgent;
    address public tokenomicsAgent;
    address public staticAnalysisAgent;

    // ============ 修饰符 ============
    modifier onlyTaskManager() {
        require(msg.sender == taskManager, "AgentRegistry: only TaskManager");
        _;
    }

    modifier onlyActiveAgent() {
        require(agents[msg.sender].status == AgentStatus.Active, "AgentRegistry: not active agent");
        _;
    }

    // ============ 构造函数 ============
    constructor(address _taskManager) {
        require(_taskManager != address(0), "AgentRegistry: zero address");
        taskManager = _taskManager;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ============ Agent 注册 ============

    /**
     * @notice 注册新 Agent
     * @param _name Agent 名称
     * @param _agentType Agent 类型
     * @param _endpoint Agent API 端点
     */
    function registerAgent(string calldata _name, AgentType _agentType, string calldata _endpoint) external {
        require(bytes(_name).length > 0, "AgentRegistry: empty name");
        require(agents[msg.sender].registeredAt == 0, "AgentRegistry: already registered");

        agents[msg.sender] = Agent({
            agentAddress: msg.sender,
            name: _name,
            agentType: _agentType,
            endpoint: _endpoint,
            totalTasks: 0,
            successfulFinds: 0,
            reputation: 100,
            status: AgentStatus.Active,
            registeredAt: block.timestamp
        });

        agentList.push(msg.sender);

        emit AgentRegistered(msg.sender, _name, _agentType);
    }

    // ============ 默认系统 Agent 设置 ============

    function setDefaultAgent(AgentType _agentType, address _agentAddr) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_agentAddr != address(0), "AgentRegistry: zero address");
        require(agents[_agentAddr].status == AgentStatus.Active, "AgentRegistry: not active agent");

        if (_agentType == AgentType.Security) {
            securityAgent = _agentAddr;
        } else if (_agentType == AgentType.Tokenomics) {
            tokenomicsAgent = _agentAddr;
        } else if (_agentType == AgentType.StaticAnalysis) {
            staticAnalysisAgent = _agentAddr;
        }
    }

    function getDefaultAgents() external view returns (address, address, address) {
        return (securityAgent, tokenomicsAgent, staticAnalysisAgent);
    }

    // ============ 任务-Agent 分配 ============

    /**
     * @notice 项目方为任务分配 Agent
     * @param _taskId 任务 ID
     * @param _agents Agent 地址列表
     */
    function assignAgentsToTask(uint256 _taskId, address[] calldata _agents) external {
        // 验证调用者是任务 owner + 获取 maxAgents
        (bool success, bytes memory data) = taskManager.staticcall(
            abi.encodeWithSignature("getTaskEscrowData(uint256)", _taskId)
        );
        require(success);
        (, address taskOwner,,, uint256 maxAgents,) =
            abi.decode(data, (uint256, address, address, uint256, uint256, uint8));
        require(taskOwner == msg.sender, "AgentRegistry: not task owner");

        require(taskAgentList[_taskId].length + _agents.length <= maxAgents, "AgentRegistry: exceeds max agents");

        for (uint256 i = 0; i < _agents.length; i++) {
            address agentAddr = _agents[i];
            require(agents[agentAddr].status == AgentStatus.Active, "AgentRegistry: agent not active");
            require(taskAgents[_taskId][agentAddr].assignedAt == 0, "AgentRegistry: already assigned");

            taskAgents[_taskId][agentAddr] = TaskAgentConfig({
                taskId: _taskId,
                agent: agentAddr,
                agentType: agents[agentAddr].agentType,
                assignedAt: block.timestamp,
                hasCommitted: false,
                hasRevealed: false
            });

            taskAgentList[_taskId].push(agentAddr);
            agents[agentAddr].totalTasks++;

            emit TaskAgentAssigned(_taskId, agentAddr, agents[agentAddr].agentType);
        }
    }

    // ============ Commit-Reveal (由 Agent 调用) ============

    /**
     * @notice Agent 在 Commit 阶段提交漏洞 Hash
     * @param _taskId 任务 ID
     * @param _commitHash keccak256(漏洞内容 + salt)
     */
    function commitFinding(uint256 _taskId, bytes32 _commitHash) external onlyActiveAgent {
        TaskAgentConfig storage cfg = taskAgents[_taskId][msg.sender];
        require(cfg.assignedAt > 0, "AgentRegistry: not assigned to task");
        require(!cfg.hasCommitted, "AgentRegistry: already committed");

        // 验证任务状态
        (bool success, bytes memory data) = taskManager.staticcall(
            abi.encodeWithSignature("getTaskEscrowData(uint256)", _taskId)
        );
        require(success);
        (,,,,, uint8 status) = abi.decode(data, (uint256, address, address, uint256, uint256, uint8));
        require(status == uint8(TaskStatus.Committing), "AgentRegistry: not in committing phase");

        cfg.hasCommitted = true;

        commits[_taskId][msg.sender] = CommitRecord({
            commitHash: _commitHash,
            taskId: _taskId,
            agent: msg.sender,
            timestamp: block.timestamp,
            revealed: false
        });

        emit AgentCommitted(_taskId, msg.sender, _commitHash);
    }

    /**
     * @notice Agent 在 Reveal 阶段公开漏洞报告
     * @param _taskId 任务 ID
     * @param _rawFinding 原始漏洞数据
     * @param _salt 用于验证 CommitHash 的盐值
     */
    function revealFinding(uint256 _taskId, bytes calldata _rawFinding, bytes32 _salt) external onlyActiveAgent {
        TaskAgentConfig storage cfg = taskAgents[_taskId][msg.sender];
        require(cfg.assignedAt > 0, "AgentRegistry: not assigned");
        require(cfg.hasCommitted, "AgentRegistry: not committed");
        require(!cfg.hasRevealed, "AgentRegistry: already revealed");

        // 验证 Reveal 阶段
        (bool success, bytes memory data) = taskManager.staticcall(
            abi.encodeWithSignature("getTaskEscrowData(uint256)", _taskId)
        );
        require(success);
        (,,,,, uint8 status) = abi.decode(data, (uint256, address, address, uint256, uint256, uint8));
        require(status == uint8(TaskStatus.Revealing), "AgentRegistry: not in revealing phase");

        // 验证 Hash
        bytes32 computedHash = keccak256(abi.encodePacked(_rawFinding, _salt));
        require(computedHash == commits[_taskId][msg.sender].commitHash, "AgentRegistry: hash mismatch");

        cfg.hasRevealed = true;
        commits[_taskId][msg.sender].revealed = true;

        emit AgentRevealed(_taskId, msg.sender);
    }

    /**
     * @notice 惩罚未 Reveal 的 Agent（Commit 后未公开）
     */
    function slashNonRevealers(uint256 _taskId, address[] calldata _agents) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i = 0; i < _agents.length; i++) {
            TaskAgentConfig storage cfg = taskAgents[_taskId][_agents[i]];
            if (cfg.hasCommitted && !cfg.hasRevealed) {
                agents[_agents[i]].reputation -= 20;
                if (agents[_agents[i]].reputation == 0) {
                    agents[_agents[i]].reputation = 1;
                }
            }
        }
    }

    // ============ 管理功能 ============

    function suspendAgent(address _agent) external onlyRole(DEFAULT_ADMIN_ROLE) {
        agents[_agent].status = AgentStatus.Suspended;
        emit AgentSuspended(_agent);
    }

    function reactivateAgent(address _agent) external onlyRole(DEFAULT_ADMIN_ROLE) {
        agents[_agent].status = AgentStatus.Active;
        emit AgentReactivated(_agent);
    }

    function updateAgentEndpoint(address _agent, string calldata _endpoint) external {
        require(msg.sender == _agent || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "AgentRegistry: unauthorized");
        agents[_agent].endpoint = _endpoint;
        emit AgentUpdated(_agent);
    }

    // ============ 查询功能 ============

    function getAgent(address _addr) external view returns (Agent memory) {
        return agents[_addr];
    }

    function getAgentList() external view returns (address[] memory) {
        return agentList;
    }

    function getTaskAgents(uint256 _taskId) external view returns (address[] memory) {
        return taskAgentList[_taskId];
    }

    function getTaskAgentConfig(uint256 _taskId, address _agent) external view returns (TaskAgentConfig memory) {
        return taskAgents[_taskId][_agent];
    }

    function getCommitRecord(uint256 _taskId, address _agent) external view returns (CommitRecord memory) {
        return commits[_taskId][_agent];
    }

    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }
}
