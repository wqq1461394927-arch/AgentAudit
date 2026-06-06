// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ITypes.sol";
import "./ITaskManager.sol";

/**
 * @title DeadlineController
 * @notice 任务时间窗口与阶段自动切换
 * @dev 支持 Chainlink Automation / Gelato 自动调用或管理员手动推进
 */
contract DeadlineController is AccessControl, ITypes {
    event PhaseDeadlinePassed(uint256 indexed taskId, TaskStatus from, TaskStatus to);
    event KeeperTriggered(uint256 indexed taskId, TaskStatus newStatus);
    event ManualTransition(uint256 indexed taskId, TaskStatus newStatus);

    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    ITaskManager public immutable taskManager;

    // 阶段推进映射: 当前 → 下一个
    mapping(TaskStatus => TaskStatus) public nextPhase;

    constructor(address _tm) {
        require(_tm != address(0), "DC: zero addr");
        taskManager = ITaskManager(_tm);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(KEEPER_ROLE, msg.sender);

        // 初始化阶段推进映射
        nextPhase[TaskStatus.Active] = TaskStatus.Committing;
        nextPhase[TaskStatus.Committing] = TaskStatus.Revealing;
        nextPhase[TaskStatus.Revealing] = TaskStatus.Clustering;
        nextPhase[TaskStatus.Clustering] = TaskStatus.Challenging;
        nextPhase[TaskStatus.Challenging] = TaskStatus.Settled;
    }

    // ============ 自动化阶段检查 (Keeper 调用) ============

    function checkUpkeep(uint256 _taskId) external view returns (bool) {
        try taskManager.getTaskDeadlineData(_taskId) returns (
            uint256, uint256 createdAt, uint256 cd, uint256 rd, uint256 chd, uint8 status
        ) {
            TaskStatus s = TaskStatus(status);
            if (s == TaskStatus.Active) return createdAt > 0;
            if (nextPhase[s] == TaskStatus(0)) return false; // 终态
            return _deadlinePassed(s, cd, rd, chd);
        } catch {
            return false;
        }
    }

    function performUpkeep(uint256 _taskId) external onlyRole(KEEPER_ROLE) {
        (uint256 _id, uint256 _ct, uint256 cd, uint256 rd, uint256 chd, uint8 status) = taskManager.getTaskDeadlineData(_taskId);
        _id; _ct;
        TaskStatus current = TaskStatus(status);
        TaskStatus target = nextPhase[current];
        require(target != TaskStatus(0), "DC: no next phase");

        if (current != TaskStatus.Active && current != TaskStatus.Clustering) {
            require(_deadlinePassed(current, cd, rd, chd), "DC: not yet");
        }

        taskManager.transitionPhase(_taskId, uint8(current), uint8(target));
        emit PhaseDeadlinePassed(_taskId, current, target);
        emit KeeperTriggered(_taskId, target);
    }

    // ============ 手动推进 ============

    function manualTransition(uint256 _taskId, TaskStatus _target) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(nextPhase[_target] != TaskStatus(0) || _target == TaskStatus.Settled, "DC: invalid target");
        (uint256 _id, uint256 _ct, uint256 _cd, uint256 _rd, uint256 _chd, uint8 current) = taskManager.getTaskDeadlineData(_taskId);
        _id; _ct; _cd; _rd; _chd;
        taskManager.transitionPhase(_taskId, current, uint8(_target));
        emit ManualTransition(_taskId, _target);
    }

    // ============ 查询 ============

    function getDeadlines(uint256 _taskId) external view returns (
        uint256 cd, uint256 rd, uint256 chd, TaskStatus status
    ) {
        (uint256 _i, uint256 _ct, uint256 _cd, uint256 _rd, uint256 _chd, uint8 _s) = taskManager.getTaskDeadlineData(_taskId);
        _i; _ct;
        cd = _cd; rd = _rd; chd = _chd; status = TaskStatus(_s);
    }

    // ============ 内部 ============

    function _deadlinePassed(TaskStatus _s, uint256 _cd, uint256 _rd, uint256 _chd)
        internal view returns (bool)
    {
        if (_s == TaskStatus.Committing)  return block.timestamp >= _cd;
        if (_s == TaskStatus.Revealing)   return block.timestamp >= _rd;
        if (_s == TaskStatus.Challenging) return _chd > 0 && block.timestamp >= _chd;
        return false;
    }
}
