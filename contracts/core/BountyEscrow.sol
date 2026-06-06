// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/ITypes.sol";

/**
 * @title BountyEscrow
 * @notice 赏金资金托管合约 —— 链上锁仓 + 自动结算
 * @dev 项目方创建任务时必须预先将赏金锁定至合约。
 *      只有任务进入 Settled 状态后，资金才按规则分配给有效漏洞发现者。
 *      剩余资金退还给项目方。
 */
contract BountyEscrow is AccessControl, ReentrancyGuard, ITypes {
    using SafeERC20 for IERC20;

    // ============ 事件 ============
    event BountyLocked(uint256 indexed taskId, address indexed owner, address token, uint256 amount);
    event RewardDistributed(uint256 indexed taskId, address indexed recipient, uint256 amount);
    event RemainingRefunded(uint256 indexed taskId, address indexed owner, uint256 amount);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);

    // ============ 状态变量 ============
    address public taskManager;

    mapping(uint256 => mapping(address => uint256)) public lockedBounties;
    mapping(uint256 => bool) public isSettled;
    mapping(address => uint256) public totalLocked;

    // ============ 修饰符 ============
    modifier onlyTaskManager() {
        require(msg.sender == taskManager, "BountyEscrow: only TaskManager");
        _;
    }

    // ============ 构造函数 ============
    constructor(address _taskManager) {
        require(_taskManager != address(0), "BountyEscrow: zero address");
        taskManager = _taskManager;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ============ 赏金锁定 ============

    /**
     * @notice 项目方锁仓赏金并激活任务
     * @param _taskId 任务 ID
     */
    function lockBounty(uint256 _taskId) external nonReentrant {
        // 从 TaskManager 获取任务精简数据
        (bool success, bytes memory data) = taskManager.staticcall(
            abi.encodeWithSignature("getTaskEscrowData(uint256)", _taskId)
        );
        require(success, "BountyEscrow: getTaskEscrowData failed");

        (, address owner, address bountyToken, uint256 bounty,, uint8 status) =
            abi.decode(data, (uint256, address, address, uint256, uint256, uint8));

        require(owner == msg.sender, "BountyEscrow: not task owner");
        require(status == uint8(TaskStatus.Created), "BountyEscrow: task not in Created");
        require(bounty > 0, "BountyEscrow: zero bounty");
        require(bountyToken != address(0), "BountyEscrow: zero token");

        IERC20(bountyToken).safeTransferFrom(msg.sender, address(this), bounty);

        lockedBounties[_taskId][bountyToken] = bounty;
        totalLocked[bountyToken] += bounty;

        emit BountyLocked(_taskId, owner, bountyToken, bounty);

        (bool activated,) = taskManager.call(abi.encodeWithSignature("activateTask(uint256)", _taskId));
        require(activated, "BountyEscrow: activate failed");
    }

    // ============ 赏金分配 ============

    /**
     * @notice 任务结算后分配赏金给漏洞发现者
     */
    function distributeRewards(uint256 _taskId, address[] calldata _recipients, uint256[] calldata _amounts)
        external
        nonReentrant
    {
        require(!isSettled[_taskId], "BountyEscrow: already settled");
        require(_recipients.length == _amounts.length, "BountyEscrow: length mismatch");

        // 获取任务数据
        (bool success, bytes memory data) = taskManager.staticcall(
            abi.encodeWithSignature("getTaskEscrowData(uint256)", _taskId)
        );
        require(success, "BountyEscrow: getTaskEscrowData failed");

        (, address owner, address bountyToken, uint256 bounty,, uint8 status) =
            abi.decode(data, (uint256, address, address, uint256, uint256, uint8));

        require(
            status == uint8(TaskStatus.Settled) || status == uint8(TaskStatus.Closed),
            "BountyEscrow: not settled"
        );

        uint256 totalDistributed;
        for (uint256 i = 0; i < _recipients.length; i++) {
            require(_amounts[i] > 0, "BountyEscrow: zero amount");
            totalDistributed += _amounts[i];
            IERC20(bountyToken).safeTransfer(_recipients[i], _amounts[i]);
            emit RewardDistributed(_taskId, _recipients[i], _amounts[i]);
        }

        require(totalDistributed <= bounty, "BountyEscrow: exceeds bounty");

        uint256 remaining = bounty - totalDistributed;
        if (remaining > 0) {
            IERC20(bountyToken).safeTransfer(owner, remaining);
            emit RemainingRefunded(_taskId, owner, remaining);
        }

        lockedBounties[_taskId][bountyToken] = 0;
        totalLocked[bountyToken] -= bounty;
        isSettled[_taskId] = true;
    }

    // ============ 查询功能 ============

    function getLockedAmount(uint256 _taskId, address _token) external view returns (uint256) {
        return lockedBounties[_taskId][_token];
    }

    function getTotalLocked(address _token) external view returns (uint256) {
        return totalLocked[_token];
    }

    // ============ 紧急功能 ============

    function emergencyWithdraw(address _token, address _to, uint256 _amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        IERC20(_token).safeTransfer(_to, _amount);
        emit EmergencyWithdraw(_token, _to, _amount);
    }
}
