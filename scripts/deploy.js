const { ethers } = require("hardhat");

/**
 * CeatDAO - 合约部署脚本 (Sepolia)
 * 显式 nonce 管理，避免 pending tx 冲突
 */
async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying CeatDAO contracts with account:", deployer.address);

    const DEFAULT_COMMIT_DURATION = 48 * 60 * 60;
    const DEFAULT_REVEAL_DURATION = 24 * 60 * 60;
    const DEFAULT_CHALLENGE_DURATION = 7 * 24 * 60 * 60;

    // 获取当前 nonce (含 pending)
    let nonce = await deployer.getNonce("pending");

    // ============ 1. MockERC20 ============
    console.log("\n[1/6] Deploying MockERC20 (USDC)...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdcToken = await MockERC20.deploy("USD Coin", "USDC", { nonce: nonce++ });
    await usdcToken.waitForDeployment();
    console.log("  USDC deployed to:", await usdcToken.getAddress());
    await usdcToken.mint(deployer.address, ethers.parseEther("1000000"), { nonce: nonce++ });

    // ============ 2. TaskManager ============
    console.log("\n[2/6] Deploying TaskManager...");
    const TaskManager = await ethers.getContractFactory("TaskManager");
    const taskManager = await TaskManager.deploy({ nonce: nonce++ });
    await taskManager.waitForDeployment();
    console.log("  TaskManager deployed to:", await taskManager.getAddress());

    // ============ 3. BountyEscrow ============
    console.log("\n[3/6] Deploying BountyEscrow...");
    const BountyEscrow = await ethers.getContractFactory("BountyEscrow");
    const bountyEscrow = await BountyEscrow.deploy(await taskManager.getAddress(), { nonce: nonce++ });
    await bountyEscrow.waitForDeployment();
    console.log("  BountyEscrow deployed to:", await bountyEscrow.getAddress());

    // ============ 4. AgentRegistry ============
    console.log("\n[4/6] Deploying AgentRegistry...");
    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    const agentRegistry = await AgentRegistry.deploy(await taskManager.getAddress(), { nonce: nonce++ });
    await agentRegistry.waitForDeployment();
    console.log("  AgentRegistry deployed to:", await agentRegistry.getAddress());

    // ============ 5. DeadlineController ============
    console.log("\n[5/6] Deploying DeadlineController...");
    const DeadlineController = await ethers.getContractFactory("DeadlineController");
    const deadlineController = await DeadlineController.deploy(await taskManager.getAddress(), { nonce: nonce++ });
    await deadlineController.waitForDeployment();
    console.log("  DeadlineController deployed to:", await deadlineController.getAddress());

    // ============ 6. Settlement ============
    console.log("\n[6/8] Deploying Settlement...");
    const Settlement = await ethers.getContractFactory("Settlement");
    const settlement = await Settlement.deploy(await usdcToken.getAddress(), { nonce: nonce++ });
    await settlement.waitForDeployment();
    console.log("  Settlement deployed to:", await settlement.getAddress());

    // ============ 7. ReputationSystem ============
    console.log("\n[7/8] Deploying ReputationSystem...");
    const ReputationSystem = await ethers.getContractFactory("ReputationSystem");
    const reputationSystem = await ReputationSystem.deploy({ nonce: nonce++ });
    await reputationSystem.waitForDeployment();
    console.log("  ReputationSystem deployed to:", await reputationSystem.getAddress());

    // ============ 8. 配置关联 ============
    console.log("\n[8/8] Configuring contract references...");
    await taskManager.setExternalContracts(
        await bountyEscrow.getAddress(),
        await agentRegistry.getAddress(),
        await deadlineController.getAddress(),
        { nonce: nonce++ }
    );
    await taskManager.setDurations(
        DEFAULT_COMMIT_DURATION,
        DEFAULT_REVEAL_DURATION,
        DEFAULT_CHALLENGE_DURATION,
        { nonce: nonce++ }
    );
    console.log("  TaskManager external contracts set");

    // 注册默认 Agent
    await agentRegistry.registerAgent("Default Agent", 0, "http://localhost:8080/audit", { nonce: nonce++ });
    console.log("  Default agent registered:", deployer.address);

    await agentRegistry.setDefaultAgent(0, deployer.address, { nonce: nonce++ });
    await agentRegistry.setDefaultAgent(1, deployer.address, { nonce: nonce++ });
    await agentRegistry.setDefaultAgent(2, deployer.address, { nonce: nonce++ });
    console.log("  System default agents configured");

    // ============ 部署总结 ============
    console.log("\n========== CeatDAO Deployment Summary ==========");
    console.log("USDC (Mock):         ", await usdcToken.getAddress());
    console.log("TaskManager:         ", await taskManager.getAddress());
    console.log("BountyEscrow:        ", await bountyEscrow.getAddress());
    console.log("AgentRegistry:       ", await agentRegistry.getAddress());
    console.log("DeadlineController:  ", await deadlineController.getAddress());
    console.log("Settlement:          ", await settlement.getAddress());
    console.log("ReputationSystem:    ", await reputationSystem.getAddress());
    console.log("==================================================");

    return { usdcToken, taskManager, bountyEscrow, agentRegistry, deadlineController, settlement, reputationSystem };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
