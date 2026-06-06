// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TaskEscrowData
 * @notice TaskManager 暴露给 BountyEscrow 的任务精简数据接口
 */
struct TaskEscrowData {
    uint256 id;
    address owner;
    address bountyToken;
    uint256 bounty;
    uint8 status; // TaskStatus 枚举值
}
