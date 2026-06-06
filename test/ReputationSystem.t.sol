// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/ReputationSystem.sol";

contract ReputationSystemTest is Test {
    ReputationSystem public reputationSystem;
    address public auditor;
    bytes32 public agentId;
    
    function setUp() public {
        reputationSystem = new ReputationSystem();
        auditor = address(0x1);
        agentId = bytes32("agent-001");
    }
    
    // ==================== Auditor Tests ====================
    
    function testRegisterAuditor() public {
        reputationSystem.registerAuditor(auditor, "Test Auditor");
        
        (uint256 rep, string memory level, , , uint256 maxSubs) = 
            reputationSystem.getAuditorInfo(auditor);
        
        assertEq(rep, 0);
        assertEq(level, "Rookie");
        assertEq(maxSubs, 5);
    }
    
    function testUpdateAuditorReputationValid() public {
        reputationSystem.registerAuditor(auditor, "Test Auditor");
        
        reputationSystem.updateAuditorReputation(auditor, true, 1000 ether);
        
        (uint256 rep, , uint256 totalVulns, uint256 validVulns, ) = 
            reputationSystem.getAuditorInfo(auditor);
        
        assertEq(totalVulns, 1);
        assertEq(validVulns, 1);
        assertGt(rep, 0);
    }
    
    function testAuditorLevelUp() public {
        reputationSystem.registerAuditor(auditor, "Test Auditor");
        
        // Simulate multiple valid submissions
        for (uint256 i = 0; i < 100; i++) {
            reputationSystem.updateAuditorReputation(auditor, true, 1000 ether);
        }
        
        (, string memory level, , , ) = reputationSystem.getAuditorInfo(auditor);
        assertEq(level, "Bronze");
    }
    
    // ==================== AI Agent Tests ====================
    
    function testRegisterAIAgent() public {
        reputationSystem.registerAIAgent(agentId, "Test Agent");
        
        (uint256 calib, , , , uint256 mult) = reputationSystem.getAIAgentInfo(agentId);
        assertEq(calib, 100);
        assertEq(mult, 100);
    }
    
    function testUpdateAIAgentCalibration() public {
        reputationSystem.registerAIAgent(agentId, "Test Agent");
        
        // 3 correct predictions out of 5
        reputationSystem.updateAIAgentCalibration(agentId, 95, true);
        reputationSystem.updateAIAgentCalibration(agentId, 90, true);
        reputationSystem.updateAIAgentCalibration(agentId, 85, true);
        reputationSystem.updateAIAgentCalibration(agentId, 80, false);
        reputationSystem.updateAIAgentCalibration(agentId, 70, false);
        
        (uint256 calib, , uint256 totalReports, uint256 correctPreds, ) = 
            reputationSystem.getAIAgentInfo(agentId);
        
        assertEq(totalReports, 5);
        assertEq(correctPreds, 3);
        assertEq(calib, 60); // 3/5 = 60%
    }
    
    function testGetCalibrationMultiplier() public {
        reputationSystem.registerAIAgent(agentId, "Test Agent");
        
        // High calibration
        for (uint256 i = 0; i < 9; i++) {
            reputationSystem.updateAIAgentCalibration(agentId, 90, true);
        }
        for (uint256 i = 0; i < 1; i++) {
            reputationSystem.updateAIAgentCalibration(agentId, 90, false);
        }
        
        assertEq(reputationSystem.getCalibrationMultiplier(agentId), 120); // 90% calibration -> 1.2x
    }
    
    // ==================== Juror Tests ====================
    
    function testRegisterJuror() public {
        address juror = address(0x2);
        
        vm.deal(juror, 1000 ether);
        vm.prank(juror);
        reputationSystem.registerJuror{value: 1000 ether}();
        
        (, uint256 stake, uint256 rep, , , bool active) = 
            reputationSystem.getJurorInfo(juror);
        
        assertEq(stake, 1000 ether);
        assertEq(rep, 100);
        assertTrue(active);
    }
    
    function testSlashJuror() public {
        address juror = address(0x2);
        
        vm.deal(juror, 1000 ether);
        vm.prank(juror);
        reputationSystem.registerJuror{value: 1000 ether}();
        
        reputationSystem.slashJuror(juror, 20);
        
        (, uint256 stake, uint256 rep, , , ) = reputationSystem.getJurorInfo(juror);
        assertEq(stake, 800 ether);
        assertEq(rep, 80);
    }
    
    // ==================== Helper Tests ====================
    
    function testCalculateLevel() public {
        assertEq(uint8(reputationSystem.calculateLevel(0)), uint8(ReputationSystem.AuditorLevel.Rookie));
        assertEq(uint8(reputationSystem.calculateLevel(100)), uint8(ReputationSystem.AuditorLevel.Bronze));
        assertEq(uint8(reputationSystem.calculateLevel(500)), uint8(ReputationSystem.AuditorLevel.Silver));
        assertEq(uint8(reputationSystem.calculateLevel(2000)), uint8(ReputationSystem.AuditorLevel.Gold));
        assertEq(uint8(reputationSystem.calculateLevel(5000)), uint8(ReputationSystem.AuditorLevel.Elite));
    }
    
    function testGetCounts() public {
        reputationSystem.registerAuditor(auditor, "Test");
        assertEq(reputationSystem.getAuditorCount(), 1);
        
        reputationSystem.registerAIAgent(agentId, "Agent");
        assertEq(reputationSystem.getAIAgentCount(), 1);
    }
}
