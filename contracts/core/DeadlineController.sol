// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/ITypes.sol";

/**
 * @title DeadlineController
 * @notice 任务时间窗口与阶段自动切换
 * @dev 管理任务各阶段的时间窗口，支持手动推进或由 Chainlink Automation / Gelato 自动调用。
 *      时间线: Commit → Reveal → Clustering → Challenge → Settled
 */
contract DeadlineController is AccessControl, ITypes {
    // ============ 事件 ============
    event PhaseDeadlinePassed(uint256 indexed taskId, TaskStatus from, TaskStatus to);
    event KeeperTriggered(uint256 indexed taskId, TaskStatus newStatus);
    event ManualTransition(uint256 indexed taskId, TaskStatus newStatus);

    // ============ 角色 ============
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    // ============ 状态变量 ============
    address public taskManager;

    // ============ 构造函数 ============
    constructor(address _taskManager) {
        require(_taskManager != address(0), "DeadlineController: zero address");
        taskManager = _taskManager;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(KEEPER_ROLE, msg.sender);
    }

    // ============ 自动化阶段检查 (Keeper 调用) ============

    /**
     * @notice Keeper 检查并推进任务阶段（供 Chainlink Automation / Gelato 调用）
     * @param _taskId 任务 ID
     * @return upkeepNeeded 是否需要执行
     */
    function checkUpkeep(uint256 _taskId) external view returns (bool upkeepNeeded) {
        (bool success, bytes memory data) = taskManager.staticcall(
            abi.encodeWithSignature("getTaskDeadlineData(uint256)", _taskId)
        );
        if (!success) return false;

        (
            ,
            uint256 createdAt,
            uint256 commitDeadline,
            uint256 revealDeadline,
            uint256 challengeDeadline,
            uint8 status
        ) = abi.decode(data, (uint256, uint256, uint256, uint256, uint256, uint8));

        TaskStatus current = TaskStatus(status);

        // Active → Committing
        if (current == TaskStatus.Active && createdAt > 0) {
            return true;
        }

        // Committing → Revealing
        if (current == TaskStatus.Committing && commitDeadline > 0 && block.timestamp >= commitDeadline) {
            return true;
        }

        // Revealing → Clustering
        if (current == TaskStatus.Revealing && revealDeadline > 0 && block.timestamp >= revealDeadline) {
            return true;
        }

        // Clustering → Challenging
        if (current == TaskStatus.Clustering && block.timestamp >= revealDeadline) {
            return true;
        }

        // Challenging → Settled
        if (current == TaskStatus.Challenging && challengeDeadline > 0 && block.timestamp >= challengeDeadline) {
            return true;
        }

        return false;
    }

    /**
     * @notice Keeper 执行阶段推进
     * @param _taskId 任务 ID
     */
    function performUpkeep(uint256 _taskId) external onlyRole(KEEPER_ROLE) {
        (bool success, bytes memory data) = taskManager.staticcall(
            abi.encodeWithSignature("getTaskDeadlineData(uint256)", _taskId)
        );
        require(success, "DeadlineController: getTaskDeadlineData failed");

        (
            ,
            ,
            uint256 commitDeadline,
            uint256 revealDeadline,
            ,
            uint8 status
        ) = abi.decode(data, (uint256, uint256, uint256, uint256, uint256, uint8));

        TaskStatus current = TaskStatus(status);

        if (current == TaskStatus.Active) {
            _callTransition(_taskId, "transitionToCommitting(uint256)");
            emit PhaseDeadlinePassed(_taskId, current, TaskStatus.Committing);
        } else if (current == TaskStatus.Committing && block.timestamp >= commitDeadline) {
            _callTransition(_taskId, "transitionToRevealing(uint256)");
            emit PhaseDeadlinePassed(_taskId, current, TaskStatus.Revealing);
        } else if (current == TaskStatus.Revealing && block.timestamp >= revealDeadline) {
            _callTransition(_taskId, "transitionToClustering(uint256)");
            emit PhaseDeadlinePassed(_taskId, current, TaskStatus.Clustering);
        } else if (current == TaskStatus.Clustering) {
            _callTransition(_taskId, "transitionToChallenging(uint256)");
            emit PhaseDeadlinePassed(_taskId, current, TaskStatus.Challenging);
        } else if (current == TaskStatus.Challenging) {
            _callTransition(_taskId, "transitionToSettled(uint256)");
            emit PhaseDeadlinePassed(_taskId, current, TaskStatus.Settled);
        }

        emit KeeperTriggered(_taskId, current);
    }

    // ============ 手动推进 ============

    /**
     * @notice 管理员手动推进任务阶段
     */
    function manualTransition(uint256 _taskId, TaskStatus _targetStatus) external onlyRole(DEFAULT_ADMIN_ROLE) {
        string memory method;
        if (_targetStatus == TaskStatus.Committing) {
            method = "transitionToCommitting(uint256)";
        } else if (_targetStatus == TaskStatus.Revealing) {
            method = "transitionToRevealing(uint256)";
        } else if (_targetStatus == TaskStatus.Clustering) {
            method = "transitionToClustering(uint256)";
        } else if (_targetStatus == TaskStatus.Challenging) {
            method = "transitionToChallenging(uint256)";
        } else if (_targetStatus == TaskStatus.Settled) {
            method = "transitionToSettled(uint256)";
        } else {
            revert("DeadlineController: invalid target status");
        }

        _callTransition(_taskId, method);
        emit ManualTransition(_taskId, _targetStatus);
    }

    // ============ 查询 ============

    /**
     * @notice 获取任务的阶段截止信息
     */
    function getDeadlines(uint256 _taskId) external view returns (
        uint256 commitDeadline,
        uint256 revealDeadline,
        uint256 challengeDeadline,
        TaskStatus currentStatus
    ) {
        (bool success, bytes memory data) = taskManager.staticcall(
            abi.encodeWithSignature("getTaskDeadlineData(uint256)", _taskId)
        );
        require(success);

        (
            ,
            ,
            uint256 cd,
            uint256 rd,
            uint256 chd,
            uint8 status
        ) = abi.decode(data, (uint256, uint256, uint256, uint256, uint256, uint8));

        return (cd, rd, chd, TaskStatus(status));
    }

    // ============ 内部函数 ============

    function _callTransition(uint256 _taskId, string memory _method) internal {
        (bool success,) = taskManager.call(abi.encodeWithSignature(_method, _taskId));
        require(success, "DeadlineController: transition failed");
    }
}
