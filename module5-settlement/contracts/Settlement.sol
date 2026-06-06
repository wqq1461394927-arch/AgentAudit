// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Settlement - 结算与信誉模块 (MVP版本)
/// @notice 负责：项目方Accept/Challenge、超时默认接受、奖励自动分配
/// @dev 简化版：人工仲裁
contract Settlement is Ownable {
    enum Status { 
        PENDING,        // 待处理
        ACCEPTED,       // 已接受
        CHALLENGED,     // 被挑战
        ARBITRATING,    // 仲裁中 (MVP由owner人工裁决)
        VALID,          // 裁决有效
        INVALID,        // 裁决无效
        SETTLED         // 已结算
    }
    
    // ==================== 数据结构 ====================
    struct Vulnerability {
        bytes32 vulId;              // 漏洞唯一ID
        string title;                // 漏洞标题
        string description;          // 漏洞描述
        uint256 bounty;               // 奖金金额
        Status status;               // 当前状态
        address submitter;            // 提交者地址
        address project;              // 项目方地址
        uint256 challengeBond;        // 挑战保证金
        string challengeReason;       // 挑战原因
        uint256 createdAt;            // 创建时间
        uint256 challengeAt;          // 挑战时间
        uint256 arbitratedAt;         // 仲裁时间
        uint256 rewardDistributed;    // 已分发奖励
        uint256 totalConfidence;      // 总置信度
        bytes32[] subVulIds;          // 关联的子漏洞ID
    }
    
    struct Submission {
        bytes32 subVulId;            // 子漏洞ID
        address submitter;            // 提交者
        bytes32 agentId;              // AI Agent ID
        uint256 confidence;           // AI预测置信度
        uint256 qualityScore;         // 质量评分 (PoC、修复建议等)
        uint256 ranking;               // 排名
        uint256 calibratedReward;      // 校准后奖励
        bool rewarded;                // 是否已发放奖励
    }
    
    // ==================== 状态变量 ====================
    IERC20 public immutable usdc;
    
    mapping(bytes32 => Vulnerability) public vulnerabilities;
    mapping(bytes32 => Submission[]) public submissions;
    mapping(address => uint256) public pendingWithdrawals;
    
    // 挑战保证金比例
    uint256 public constant CHALLENGE_PERIOD = 7 days;
    uint256 public constant BOND_PERCENTAGE = 20;
    uint256 public constant MIN_BOND = 50 * 10**6;
    
    // 奖励分配比例
    uint256 public constant FIRST_PLACE_PERCENT = 70;
    uint256 public constant SECOND_PLACE_PERCENT = 20;
    uint32 public constant THIRD_PLACE_PERCENT = 10;
    
    // ==================== 事件定义 ====================
    
    // 核心流程事件
    event VulnerabilityReceived(
        bytes32 indexed vulId,
        address indexed project,
        uint256 bounty
    );
    
    event AISubmissionReceived(
        bytes32 indexed vulId,
        bytes32 indexed agentId,
        address submitter,
        uint256 confidence
    );
    
    event ProjectAccepted(bytes32 indexed vulId, address project);
    event ProjectChallenged(bytes32 indexed vulId, uint256 bond, string reason);
    event TimeoutAutoAccept(bytes32 indexed vulId);
    event ArbitrationStarted(bytes32 indexed vulId);
    event ArbitrationDecided(bytes32 indexed vulId, bool isValid, address arbitrator);
    event RewardSettled(
        bytes32 indexed vulId,
        uint256 totalBounty,
        address[] recipients,
        uint256[] amounts
    );
    
    event ReputationUpdate(
        bytes32 indexed vulId,
        address indexed auditor,
        uint256 newReputation,
        string level
    );
    
    event CalibrationUpdate(
        bytes32 indexed agentId,
        uint256 totalReports,
        uint256 correctReports,
        uint256 calibration
    );
    
    // ==================== 构造函数 ====================
    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IERC20(_usdc);
    }
    
    // ==================== 核心接口 ====================
    
    /// @notice 创建漏洞
    /// @param vulId 漏洞ID
    /// @param title 漏洞标题
    /// @param description 漏洞描述
    /// @param bounty 奖金金额
    /// @param submitter 提交者地址
    function receiveVulnerability(
        bytes32 vulId,
        string calldata title,
        string calldata description,
        uint256 bounty,
        address submitter
    ) external {
        require(vulnerabilities[vulId].vulId == bytes32(0), "Already exists");
        require(bounty > 0, "Invalid bounty");
        
        vulnerabilities[vulId] = Vulnerability({
            vulId: vulId,
            title: title,
            description: description,
            bounty: bounty,
            status: Status.PENDING,
            submitter: submitter,
            project: msg.sender,
            challengeBond: 0,
            challengeReason: "",
            createdAt: block.timestamp,
            challengeAt: 0,
            arbitratedAt: 0,
            rewardDistributed: 0,
            totalConfidence: 0,
            subVulIds: new bytes32[](0)
        });
        
        emit VulnerabilityReceived(vulId, msg.sender, bounty);
    }
    
    /// @notice 添加提交
    /// @param vulId 漏洞ID
    /// @param subVulId 子漏洞ID
    /// @param submitter 提交者
    /// @param agentId AI Agent ID
    /// @param confidence 置信度
    /// @param qualityScore 质量评分
    /// @param ranking 排名
    function receiveAISubmission(
        bytes32 vulId,
        bytes32 subVulId,
        address submitter,
        bytes32 agentId,
        uint256 confidence,
        uint256 qualityScore,
        uint256 ranking
    ) external {
        require(vulnerabilities[vulId].vulId != bytes32(0), "Vul not found");
        
        Vulnerability storage v = vulnerabilities[vulId];
        v.totalConfidence += confidence;
        
        submissions[vulId].push(Submission({
            subVulId: subVulId,
            submitter: submitter,
            agentId: agentId,
            confidence: confidence,
            qualityScore: qualityScore,
            ranking: ranking,
            calibratedReward: 0,
            rewarded: false
        }));
        
        emit AISubmissionReceived(vulId, agentId, submitter, confidence);
    }
    
    /// @notice 项目方接受漏洞
    /// @param vulId 漏洞ID
    function acceptVulnerability(bytes32 vulId) external {
        Vulnerability storage v = vulnerabilities[vulId];
        require(v.vulId != bytes32(0), "Not found");
        require(msg.sender == v.project, "Not project");
        require(v.status == Status.PENDING, "Invalid status");
        
        v.status = Status.ACCEPTED;
        emit ProjectAccepted(vulId, msg.sender);
    }
    
    /// @notice 项目方挑战漏洞 (需要支付保证金)
    /// @param vulId 漏洞ID
    /// @param reason 挑战原因
    function challengeVulnerability(bytes32 vulId, string calldata reason) external payable {
        Vulnerability storage v = vulnerabilities[vulId];
        require(v.vulId != bytes32(0), "Not found");
        require(msg.sender == v.project, "Not project");
        require(v.status == Status.PENDING, "Invalid status");
        
        uint256 requiredBond = calculateBond(v.bounty);
        require(msg.value >= requiredBond, "Insufficient bond");
        
        v.status = Status.CHALLENGED;
        v.challengeBond = msg.value;
        v.challengeReason = reason;
        v.challengeAt = block.timestamp;
        
        pendingWithdrawals[address(this)] += msg.value;
        
        emit ProjectChallenged(vulId, msg.value, reason);
    }
    
    /// @notice 超时自动接受 (可被Chainlink Automation调用)
    /// @param vulId 漏洞ID
    function autoAcceptAfterTimeout(bytes32 vulId) external {
        Vulnerability storage v = vulnerabilities[vulId];
        require(v.vulId != bytes32(0), "Not found");
        require(v.status == Status.PENDING, "Invalid status");
        require(block.timestamp >= v.createdAt + CHALLENGE_PERIOD, "Not expired");
        
        v.status = Status.ACCEPTED;
        emit TimeoutAutoAccept(vulId);
    }
    
    /// @notice 发起仲裁 (MVP版本：人工仲裁)
    /// @param vulId 漏洞ID
    function startArbitration(bytes32 vulId) external {
        Vulnerability storage v = vulnerabilities[vulId];
        require(v.vulId != bytes32(0), "Not found");
        require(v.status == Status.CHALLENGED, "Must be challenged");
        require(block.timestamp >= v.challengeAt + 1 days, "Must wait 1 day");
        
        v.status = Status.ARBITRATING;
        emit ArbitrationStarted(vulId);
    }
    
    /// @notice 裁决结果 (MVP版本：owner人工调用)
    /// @param vulId 漏洞ID
    /// @param isValid 是否有效
    /// @param arbitrator 仲裁员地址
    function decideArbitration(bytes32 vulId, bool isValid, address arbitrator) external onlyOwner {
        Vulnerability storage v = vulnerabilities[vulId];
        require(v.vulId != bytes32(0), "Not found");
        require(v.status == Status.ARBITRATING, "Must be arbitrating");
        
        v.status = isValid ? Status.VALID : Status.INVALID;
        v.arbitratedAt = block.timestamp;
        
        // 退还或没收保证金
        if (isValid) {
            // 挑战失败：保证金没收给提交者
            pendingWithdrawals[v.submitter] += v.challengeBond;
        } else {
            // 挑战成功：保证金退还项目方
            pendingWithdrawals[v.project] += v.challengeBond;
        }
        
        emit ArbitrationDecided(vulId, isValid, arbitrator);
    }
    
    /// @notice 结算奖励 (核心功能)
    /// @param vulId 漏洞ID
    /// @param calibrationMultipliers 每个提交的校准乘数 (来自声誉系统)
    function settleReward(bytes32 vulId, uint256[] calldata calibrationMultipliers) external {
        Vulnerability storage v = vulnerabilities[vulId];
        require(v.vulId != bytes32(0), "Not found");
        require(
            v.status == Status.ACCEPTED || v.status == Status.VALID,
            "Cannot settle"
        );
        require(v.rewardDistributed == 0, "Already settled");
        
        Submission[] storage subs = submissions[vulId];
        require(subs.length > 0, "No submissions");
        
        // 按排名排序
        _sortSubmissions(subs);
        
        uint256 totalBounty = v.bounty;
        uint256 totalDistributed = 0;
        address[] memory recipients = new address[](subs.length);
        uint256[] memory amounts = new uint256[](subs.length);
        
        for (uint256 i = 0; i < subs.length && i < 3; i++) {
            uint256 baseShare;
            if (subs[i].ranking == 1) {
                baseShare = (totalBounty * FIRST_PLACE_PERCENT) / 100;
            } else if (subs[i].ranking == 2) {
                baseShare = (totalBounty * SECOND_PLACE_PERCENT) / 100;
            } else if (subs[i].ranking == 3) {
                baseShare = (totalBounty * THIRD_PLACE_PERCENT) / 100;
            } else {
                continue;
            }
            
            // 应用校准乘数
            uint256 multiplier = calibrationMultipliers.length > i 
                ? calibrationMultipliers[i] 
                : 100;
            uint256 finalShare = (baseShare * multiplier) / 100;
            
            subs[i].calibratedReward = finalShare;
            subs[i].rewarded = true;
            
            // 转账
            require(usdc.transfer(subs[i].submitter, finalShare), "Transfer failed");
            
            recipients[i] = subs[i].submitter;
            amounts[i] = finalShare;
            totalDistributed += finalShare;
            
            // 触发声誉更新事件
            emit ReputationUpdate(
                vulId,
                subs[i].submitter,
                0, // 由声誉系统计算
                ""  // 由声誉系统计算
            );
            
            // 触发AI校准更新事件
            if (subs[i].agentId != bytes32(0)) {
                emit CalibrationUpdate(
                    subs[i].agentId,
                    1, // 由声誉系统累加
                    1, // 由声誉系统判断
                    0  // 由声誉系统计算
                );
            }
        }
        
        v.rewardDistributed = totalDistributed;
        v.status = Status.SETTLED;
        
        emit RewardSettled(vulId, totalBounty, recipients, amounts);
    }
    
    // ==================== 辅助函数 ====================
    
    function calculateBond(uint256 bounty) public view returns (uint256) {
        uint256 percentageBond = (bounty * BOND_PERCENTAGE) / 100;
        return percentageBond > MIN_BOND ? percentageBond : MIN_BOND;
    }
    
    function _sortSubmissions(Submission[] storage subs) internal {
        // Sort by ranking (1st, 2nd, 3rd...) — ranking should already be
        // assigned by Module 4 based on commit time order per VUL-ID.
        for (uint256 i = 1; i < subs.length; i++) {
            for (uint256 j = 0; j < i; j++) {
                if (subs[i].ranking < subs[j].ranking) {
                    Submission memory temp = subs[i];
                    subs[i] = subs[j];
                    subs[j] = temp;
                }
            }
        }
    }
    
    function getVulnerability(bytes32 vulId) external view returns (Vulnerability memory) {
        return vulnerabilities[vulId];
    }
    
    function getSubmissions(bytes32 vulId) external view returns (Submission[] memory) {
        return submissions[vulId];
    }
    
    function getSubmissionCount(bytes32 vulId) external view returns (uint256) {
        return submissions[vulId].length;
    }
    
    function getStatus(bytes32 vulId) external view returns (Status) {
        return vulnerabilities[vulId].status;
    }
    
    // ==================== 提款功能 ====================
    
    function withdraw() external {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        pendingWithdrawals[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }
}
