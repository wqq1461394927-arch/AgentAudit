// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ReputationSystem - 声誉与校准系统
/// @notice 负责：审计师Reputation、AI Calibration Score、仲裁员信誉
/// @dev 支持模块间对接，通过事件接收来自Settlement的更新请求
contract ReputationSystem is Ownable {
    // ==================== 数据结构 ====================
    
    enum AuditorLevel { Rookie, Bronze, Silver, Gold, Elite }
    
    struct Auditor {
        address wallet;
        string name;
        uint256 reputation;
        AuditorLevel level;
        uint256 totalVulnerabilities;
        uint256 validVulnerabilities;
        uint256 totalBounty;
        uint256 submissions;
        uint256 maxSubmissions;
        uint256 lastActive;
    }
    
    struct AIAgent {
        bytes32 agentId;
        string name;
        uint256 totalReports;
        uint256 correctPredictions;
        uint256 calibration;          // 校准度 0-100
        uint256 reputation;
        uint256 lastCalibrationUpdate;
        uint256 avgConfidence;
        uint256 avgActualAccuracy;
    }
    
    struct Juror {
        address wallet;
        uint256 stake;
        uint256 reputation;
        uint256 totalVotes;
        uint256 correctVotes;
        uint256 slashedAmount;
        uint256 lastActive;
        bool active;
    }
    
    // ==================== 状态变量 ====================
    
    mapping(address => Auditor) public auditors;
    mapping(bytes32 => AIAgent) public aiAgents;
    mapping(address => Juror) public jurors;
    
    address[] public auditorList;
    bytes32[] public agentList;
    address[] public jurorList;
    
    // 等级阈值
    uint256 public constant ROOKIE_THRESHOLD = 0;
    uint256 public constant BRONZE_THRESHOLD = 100;
    uint256 public constant SILVER_THRESHOLD = 500;
    uint256 public constant GOLD_THRESHOLD = 2000;
    uint256 public constant ELITE_THRESHOLD = 5000;
    
    // 仲裁员参数
    uint256 public constant MIN_JUROR_STAKE = 1000 ether;
    uint256 public constant SLASH_20 = 20;
    uint256 public constant SLASH_50 = 50;
    uint256 public constant SLASH_100 = 100;
    
    // AI校准乘数
    uint256 public constant CALIB_90_MULTIPLIER = 120;  // >=90% 校准度 1.2x
    uint256 public constant CALIB_80_MULTIPLIER = 110;
    uint256 public constant CALIB_70_MULTIPLIER = 100;
    uint256 public constant CALIB_60_MULTIPLIER = 90;
    uint256 public constant CALIB_50_MULTIPLIER = 80;
    uint256 public constant CALIB_DEFAULT_MULTIPLIER = 50;
    
    // ==================== 事件定义 ====================
    
    event AuditorRegistered(address indexed auditor, string name);
    event AuditorLevelUp(address indexed auditor, AuditorLevel newLevel, uint256 reputation);
    event AuditorReputationUpdated(address indexed auditor, uint256 newReputation);
    event AuditorSlashed(address indexed auditor, uint256 amount);
    
    event AIAgentRegistered(bytes32 indexed agentId, string name);
    event AIAgentCalibrationUpdated(
        bytes32 indexed agentId, 
        uint256 totalReports, 
        uint256 correctPredictions, 
        uint256 calibration
    );
    event AIAgentReputationUpdated(bytes32 indexed agentId, uint256 newReputation);
    
    event JurorRegistered(address indexed juror, uint256 stake);
    event JurorSlashed(address indexed juror, uint256 amount, uint256 percentage);
    event JurorRewarded(address indexed juror, uint256 amount);
    
    // ==================== 审计员相关 ====================
    
    function registerAuditor(address _auditor, string calldata _name) external {
        require(auditors[_auditor].wallet == address(0), "Already registered");
        
        auditors[_auditor] = Auditor({
            wallet: _auditor,
            name: _name,
            reputation: 0,
            level: AuditorLevel.Rookie,
            totalVulnerabilities: 0,
            validVulnerabilities: 0,
            totalBounty: 0,
            submissions: 0,
            maxSubmissions: 5,
            lastActive: block.timestamp
        });
        
        auditorList.push(_auditor);
        emit AuditorRegistered(_auditor, _name);
    }
    
    /// @notice 更新审计员信誉 (由Settlement模块调用)
    /// @param _auditor 审计员地址
    /// @param isValid 漏洞是否有效
    /// @param bounty 奖金金额
    function updateAuditorReputation(address _auditor, bool isValid, uint256 bounty) external onlyOwner {
        require(auditors[_auditor].wallet != address(0), "Not registered");
        
        Auditor storage auditor = auditors[_auditor];
        auditor.totalVulnerabilities++;
        auditor.submissions++;
        auditor.lastActive = block.timestamp;
        
        if (isValid) {
            auditor.validVulnerabilities++;
            auditor.totalBounty += bounty;
            
            // 计算声誉增益
            uint256 gain = calculateReputationGain(bounty, auditor.level);
            auditor.reputation += gain;
            
            // 检查升级
            AuditorLevel newLevel = calculateLevel(auditor.reputation);
            if (newLevel > auditor.level) {
                auditor.level = newLevel;
                auditor.maxSubmissions = 5 + uint256(newLevel) * 3;
                emit AuditorLevelUp(_auditor, newLevel, auditor.reputation);
            }
        } else {
            // 失败惩罚
            uint256 penalty = 10;
            auditor.reputation = auditor.reputation > penalty ? auditor.reputation - penalty : 0;
        }
        
        emit AuditorReputationUpdated(_auditor, auditor.reputation);
    }
    
    function calculateReputationGain(uint256 bounty, AuditorLevel level) public pure returns (uint256) {
        uint256 baseGain = bounty / 1000;
        uint256 multiplier = uint256(level) + 1; // Rookie=1, Bronze=2, ...
        return baseGain * multiplier;
    }
    
    function calculateLevel(uint256 reputation) public view returns (AuditorLevel) {
        if (reputation >= ELITE_THRESHOLD) return AuditorLevel.Elite;
        if (reputation >= GOLD_THRESHOLD) return AuditorLevel.Gold;
        if (reputation >= SILVER_THRESHOLD) return AuditorLevel.Silver;
        if (reputation >= BRONZE_THRESHOLD) return AuditorLevel.Bronze;
        return AuditorLevel.Rookie;
    }
    
    function getAuditorInfo(address _auditor) external view returns (
        uint256 reputation,
        string memory level,
        uint256 totalVulns,
        uint256 validVulns,
        uint256 maxSubmissions
    ) {
        Auditor storage auditor = auditors[_auditor];
        return (
            auditor.reputation,
            _levelToString(auditor.level),
            auditor.totalVulnerabilities,
            auditor.validVulnerabilities,
            auditor.maxSubmissions
        );
    }
    
    // ==================== AI Agent校准系统 ====================
    
    /// @notice 注册AI Agent
    function registerAIAgent(bytes32 _agentId, string calldata _name) external {
        require(aiAgents[_agentId].agentId == bytes32(0), "Already registered");
        
        aiAgents[_agentId] = AIAgent({
            agentId: _agentId,
            name: _name,
            totalReports: 0,
            correctPredictions: 0,
            calibration: 100,
            reputation: 0,
            lastCalibrationUpdate: block.timestamp,
            avgConfidence: 0,
            avgActualAccuracy: 0
        });
        
        agentList.push(_agentId);
        emit AIAgentRegistered(_agentId, _name);
    }
    
    /// @notice 更新AI校准 (由Settlement模块调用)
    /// @param _agentId Agent ID
    /// @param confidence 预测置信度
    /// @param actuallyCorrect 是否实际正确
    function updateAIAgentCalibration(
        bytes32 _agentId, 
        uint256 confidence, 
        bool actuallyCorrect
    ) external onlyOwner {
        require(aiAgents[_agentId].agentId != bytes32(0), "Not registered");
        
        AIAgent storage agent = aiAgents[_agentId];
        agent.totalReports++;
        
        if (actuallyCorrect) {
            agent.correctPredictions++;
        }
        
        // 计算新校准度
        uint256 newCalibration = (agent.correctPredictions * 100) / agent.totalReports;
        agent.calibration = newCalibration;
        
        // 更新平均置信度
        uint256 totalConfidence = agent.avgConfidence * (agent.totalReports - 1) + confidence;
        agent.avgConfidence = totalConfidence / agent.totalReports;
        
        // 更新实际准确度
        uint256 totalAccuracy = agent.avgActualAccuracy * (agent.totalReports - 1) + 
            (actuallyCorrect ? 100 : 0);
        agent.avgActualAccuracy = totalAccuracy / agent.totalReports;
        
        // 声誉更新
        agent.reputation += actuallyCorrect ? 5 : 0;
        
        agent.lastCalibrationUpdate = block.timestamp;
        
        emit AIAgentCalibrationUpdated(
            _agentId, 
            agent.totalReports, 
            agent.correctPredictions, 
            agent.calibration
        );
    }
    
    /// @notice 获取校准乘数 (供奖励计算使用)
    /// @param _agentId Agent ID
    /// @return multiplier 校准乘数 (基数为100)
    function getCalibrationMultiplier(bytes32 _agentId) external view returns (uint256 multiplier) {
        require(aiAgents[_agentId].agentId != bytes32(0), "Not registered");
        
        uint256 calib = aiAgents[_agentId].calibration;
        
        if (calib >= 90) return CALIB_90_MULTIPLIER;   // 1.2x
        if (calib >= 80) return CALIB_80_MULTIPLIER;   // 1.1x
        if (calib >= 70) return CALIB_70_MULTIPLIER;   // 1.0x
        if (calib >= 60) return CALIB_60_MULTIPLIER;   // 0.9x
        if (calib >= 50) return CALIB_50_MULTIPLIER;   // 0.8x
        return CALIB_DEFAULT_MULTIPLIER;                // 0.5x
    }
    
    /// @notice 获取多个Agent的校准乘数
    function getCalibrationMultipliers(bytes32[] calldata _agentIds) 
        external 
        view 
        returns (uint256[] memory multipliers) 
    {
        multipliers = new uint256[](_agentIds.length);
        for (uint256 i = 0; i < _agentIds.length; i++) {
            multipliers[i] = getCalibrationMultiplier(_agentIds[i]);
        }
    }
    
    function getAIAgentInfo(bytes32 _agentId) external view returns (
        uint256 calibration,
        uint256 reputation,
        uint256 totalReports,
        uint256 correctPredictions,
        uint256 multiplier
    ) {
        AIAgent storage agent = aiAgents[_agentId];
        return (
            agent.calibration,
            agent.reputation,
            agent.totalReports,
            agent.correctPredictions,
            getCalibrationMultiplier(_agentId)
        );
    }
    
    // ==================== 仲裁员相关 ====================
    
    function registerJuror() external payable {
        require(jurors[msg.sender].wallet == address(0), "Already registered");
        require(msg.value >= MIN_JUROR_STAKE, "Insufficient stake");
        
        jurors[msg.sender] = Juror({
            wallet: msg.sender,
            stake: msg.value,
            reputation: 100,
            totalVotes: 0,
            correctVotes: 0,
            slashedAmount: 0,
            lastActive: block.timestamp,
            active: true
        });
        
        jurorList.push(msg.sender);
        emit JurorRegistered(msg.sender, msg.value);
    }
    
    /// @notice 更新仲裁员投票记录 (由Settlement模块调用)
    function updateJurorVote(address _juror, bool voteCorrect) external onlyOwner {
        require(jurors[_juror].wallet != address(0), "Not registered");
        
        Juror storage juror = jurors[_juror];
        juror.totalVotes++;
        juror.lastActive = block.timestamp;
        
        if (voteCorrect) {
            juror.correctVotes++;
            juror.reputation = juror.reputation < 100 ? juror.reputation + 1 : 100;
        } else {
            juror.reputation = juror.reputation > 0 ? juror.reputation - 2 : 0;
        }
    }
    
    /// @notice 惩罚仲裁员
    function slashJuror(address _juror, uint256 percentage) external onlyOwner {
        require(jurors[_juror].wallet != address(0), "Not registered");
        require(
            percentage == SLASH_20 || percentage == SLASH_50 || percentage == SLASH_100,
            "Invalid percentage"
        );
        
        Juror storage juror = jurors[_juror];
        uint256 slashAmount = (juror.stake * percentage) / 100;
        
        juror.stake -= slashAmount;
        juror.slashedAmount += slashAmount;
        juror.reputation = juror.reputation > 20 ? juror.reputation - 20 : 0;
        
        emit JurorSlashed(_juror, slashAmount, percentage);
    }
    
    /// @notice 奖励仲裁员
    function rewardJuror(address _juror) external payable onlyOwner {
        require(jurors[_juror].wallet != address(0), "Not registered");
        require(msg.value > 0, "No reward");
        
        Juror storage juror = jurors[_juror];
        juror.stake += msg.value;
        
        emit JurorRewarded(_juror, msg.value);
    }
    
    function getJurorInfo(address _juror) external view returns (
        uint256 stake,
        uint256 reputation,
        uint256 totalVotes,
        uint256 correctVotes,
        bool active
    ) {
        Juror storage juror = jurors[_juror];
        return (
            juror.stake,
            juror.reputation,
            juror.totalVotes,
            juror.correctVotes,
            juror.active
        );
    }
    
    // ==================== Leaderboard ====================
    
    function getTopAuditors(uint256 limit) external view returns (address[] memory) {
        uint256 n = limit < auditorList.length ? limit : auditorList.length;
        address[] memory top = new address[](n);
        
        // 简单选择排序
        for (uint256 i = 0; i < n; i++) {
            uint256 maxIdx = i;
            for (uint256 j = i + 1; j < auditorList.length; j++) {
                if (auditors[auditorList[j]].reputation > auditors[auditorList[maxIdx]].reputation) {
                    maxIdx = j;
                }
            }
            top[i] = auditorList[maxIdx];
        }
        
        return top;
    }
    
    function getTopAIAgents(uint256 limit) external view returns (bytes32[] memory) {
        uint256 n = limit < agentList.length ? limit : agentList.length;
        bytes32[] memory top = new bytes32[](n);
        
        for (uint256 i = 0; i < n; i++) {
            uint256 maxIdx = i;
            for (uint256 j = i + 1; j < agentList.length; j++) {
                if (aiAgents[agentList[j]].reputation > aiAgents[agentList[maxIdx]].reputation) {
                    maxIdx = j;
                }
            }
            top[i] = agentList[maxIdx];
        }
        
        return top;
    }
    
    // ==================== 辅助函数 ====================
    
    function _levelToString(AuditorLevel level) internal pure returns (string memory) {
        if (level == AuditorLevel.Rookie) return "Rookie";
        if (level == AuditorLevel.Bronze) return "Bronze";
        if (level == AuditorLevel.Silver) return "Silver";
        if (level == AuditorLevel.Gold) return "Gold";
        return "Elite";
    }
    
    function getAuditorCount() external view returns (uint256) {
        return auditorList.length;
    }
    
    function getAIAgentCount() external view returns (uint256) {
        return agentList.length;
    }
    
    function getJurorCount() external view returns (uint256) {
        return jurorList.length;
    }
}
