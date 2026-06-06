// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITaskManager
 * @notice TaskManager 对外接口 —— 消除跨合约 staticcall 低层调用
 */
interface ITaskManager {
    function activateTask(uint256 _taskId) external;
    function transitionPhase(uint256 _taskId, uint8 _from, uint8 _to) external;
    function isTaskOwner(uint256 _taskId, address _account) external view returns (bool);

    function getTaskEscrowData(uint256 _taskId) external view returns (
        uint256 id, address owner, address bountyToken, uint256 bounty, uint256 maxAgents, uint8 status
    );

    function getTaskDeadlineData(uint256 _taskId) external view returns (
        uint256 id, uint256 createdAt, uint256 commitDeadline,
        uint256 revealDeadline, uint256 challengeDeadline, uint8 status
    );
}
