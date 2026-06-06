// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ReputationSystem.sol";

contract DeployReputationSystem is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        ReputationSystem reputationSystem = new ReputationSystem();
        
        vm.stopBroadcast();
        
        console.log("ReputationSystem contract deployed at:", address(reputationSystem));
    }
}