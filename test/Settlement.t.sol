// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/Settlement.sol";

contract SettlementTest is Test {
    Settlement public settlement;
    address public usdc;
    address public project;
    address public submitter;
    
    bytes32 public constant TASK_ID = bytes32("task-001");
    bytes32 public constant VUL_ID = bytes32("vul-001");
    bytes32 public constant SUB_VUL_ID = bytes32("sub-vul-001");
    bytes32 public constant AGENT_ID = bytes32("agent-001");
    uint256 public constant BOUNTY = 1000 * 10**6;
    
    function setUp() public {
        usdc = address(0x1);
        project = address(0x2);
        submitter = address(0x3);
        
        vm.mockCall(usdc, abi.encodeWithSelector(IERC20.transfer.selector), abi.encode(true));
        
        settlement = new Settlement(usdc);
    }
    
    function testReceiveVulnerability() public {
        vm.prank(project);
        settlement.receiveVulnerability(
            VUL_ID,
            TASK_ID,
            "Test Vulnerability",
            "Description",
            BOUNTY,
            submitter
        );
        
        (bytes32 vulId, bytes32 taskId, uint256 bounty, Settlement.Status status, ,) = 
            settlement.getVulnerability(VUL_ID);
        
        assertEq(vulId, VUL_ID);
        assertEq(taskId, TASK_ID);
        assertEq(bounty, BOUNTY);
        assertEq(uint8(status), uint8(Settlement.Status.PENDING));
    }
    
    function testReceiveAISubmission() public {
        vm.prank(project);
        settlement.receiveVulnerability(
            VUL_ID,
            TASK_ID,
            "Test Vulnerability",
            "Description",
            BOUNTY,
            submitter
        );
        
        settlement.receiveAISubmission(
            VUL_ID,
            SUB_VUL_ID,
            submitter,
            AGENT_ID,
            95,
            85,
            1
        );
        
        assertEq(settlement.getSubmissionCount(VUL_ID), 1);
    }
    
    function testAcceptVulnerability() public {
        vm.prank(project);
        settlement.receiveVulnerability(
            VUL_ID,
            TASK_ID,
            "Test Vulnerability",
            "Description",
            BOUNTY,
            submitter
        );
        
        vm.prank(project);
        settlement.acceptVulnerability(VUL_ID);
        
        assertEq(uint8(settlement.getStatus(VUL_ID)), uint8(Settlement.Status.ACCEPTED));
    }
    
    function testChallengeVulnerability() public {
        vm.prank(project);
        settlement.receiveVulnerability(
            VUL_ID,
            TASK_ID,
            "Test Vulnerability",
            "Description",
            BOUNTY,
            submitter
        );
        
        uint256 bond = settlement.calculateBond(BOUNTY);
        
        vm.prank(project);
        vm.deal(project, bond);
        settlement.challengeVulnerability{value: bond}(VUL_ID, "Invalid vulnerability");
        
        assertEq(uint8(settlement.getStatus(VUL_ID)), uint8(Settlement.Status.CHALLENGED));
    }
    
    function testAutoAcceptAfterTimeout() public {
        vm.prank(project);
        settlement.receiveVulnerability(
            VUL_ID,
            TASK_ID,
            "Test Vulnerability",
            "Description",
            BOUNTY,
            submitter
        );
        
        vm.warp(block.timestamp + 8 days);
        
        settlement.autoAcceptAfterTimeout(VUL_ID);
        
        assertEq(uint8(settlement.getStatus(VUL_ID)), uint8(Settlement.Status.ACCEPTED));
    }
    
    function testCalculateBond() public {
        uint256 smallBounty = 100 * 10**6;
        assertEq(settlement.calculateBond(smallBounty), 50 * 10**6);
        
        uint256 largeBounty = 1000 * 10**6;
        assertEq(settlement.calculateBond(largeBounty), 200 * 10**6);
    }
}
