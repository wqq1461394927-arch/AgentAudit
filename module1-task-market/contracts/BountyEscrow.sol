// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/ITypes.sol";
import "../interfaces/ITaskManager.sol";

/**
 * @title BountyEscrow
 * @notice 赏金资金托管 —— 链上锁仓 + 自动结算
 * @dev 项目方创建任务时必须预先锁仓。进入 Settled 后按规则分配，剩余退还。
 */
contract BountyEscrow is AccessControl, ReentrancyGuard, ITypes {
    using SafeERC20 for IERC20;

    event BountyLocked(uint256 indexed taskId, address indexed owner, address token, uint256 amount);
    event RewardDistributed(uint256 indexed taskId, address indexed recipient, uint256 amount);
    event RemainingRefunded(uint256 indexed taskId, address indexed owner, uint256 amount);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);

    ITaskManager public immutable taskManager;
    mapping(uint256 => mapping(address => uint256)) public lockedBounties;
    mapping(uint256 => bool) public isSettled;
    mapping(address => uint256) public totalLocked;

    constructor(address _tm) {
        require(_tm != address(0), "BE: zero addr");
        taskManager = ITaskManager(_tm);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ============ 赏金锁定 ============
    function lockBounty(uint256 _taskId) external nonReentrant {
        (uint256 _id, address owner, address token, uint256 bounty, uint256 _max, uint8 status) = taskManager.getTaskEscrowData(_taskId);
        _id; _max;
        require(owner == msg.sender, "BE: not owner");
        require(status == uint8(TaskStatus.Created), "BE: not Created");
        require(bounty > 0 && token != address(0), "BE: bad args");

        IERC20(token).safeTransferFrom(msg.sender, address(this), bounty);
        lockedBounties[_taskId][token] = bounty;
        totalLocked[token] += bounty;
        emit BountyLocked(_taskId, owner, token, bounty);

        (bool ok,) = address(taskManager).call(abi.encodeWithSignature("activateTask(uint256)", _taskId));
        require(ok, "BE: activate failed");
    }

    // ============ 赏金分配 ============
    function distributeRewards(uint256 _taskId, address[] calldata _recipients, uint256[] calldata _amounts)
        external nonReentrant
    {
        require(!isSettled[_taskId], "BE: settled");
        require(_recipients.length == _amounts.length, "BE: len mismatch");
        (uint256 _id, address owner, address token, uint256 bounty, uint256 _max, uint8 status) = taskManager.getTaskEscrowData(_taskId);
        _id; _max;
        require(status == uint8(TaskStatus.Settled) || status == uint8(TaskStatus.Closed), "BE: not settled");

        uint256 total;
        for (uint256 i = 0; i < _recipients.length; i++) {
            require(_amounts[i] > 0, "BE: zero amount");
            total += _amounts[i];
            IERC20(token).safeTransfer(_recipients[i], _amounts[i]);
            emit RewardDistributed(_taskId, _recipients[i], _amounts[i]);
        }
        require(total <= bounty, "BE: exceeds bounty");

        uint256 remaining = bounty - total;
        if (remaining > 0) {
            IERC20(token).safeTransfer(owner, remaining);
            emit RemainingRefunded(_taskId, owner, remaining);
        }
        lockedBounties[_taskId][token] = 0;
        totalLocked[token] -= bounty;
        isSettled[_taskId] = true;
    }

    function getLockedAmount(uint256 _taskId, address _token) external view returns (uint256) {
        return lockedBounties[_taskId][_token];
    }
    function getTotalLocked(address _token) external view returns (uint256) {
        return totalLocked[_token];
    }
    function emergencyWithdraw(address _token, address _to, uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(_token).safeTransfer(_to, _amount);
        emit EmergencyWithdraw(_token, _to, _amount);
    }
}
