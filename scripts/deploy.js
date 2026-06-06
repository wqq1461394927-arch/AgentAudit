const { ethers } = require("hardhat");

/**
 * CeatDAO - Bug Bounty Audit Platform 合约部署脚本
 *
 * 部署顺序:
 *   1. MockERC20 (USDC 模拟)
 *   2. TaskManager (任务管理器)
 *   3. BountyEscrow (赏金托管)
 *   4. AgentRegistry (Agent 注册)
 *   5. DeadlineController (时间控制)
 *
 * 使用: npx hardhat run scripts/deploy.js --network <network>
 */
async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying CeatDAO contracts with account:", deployer.address);

    // ============ 部署参数 ============
    const DEFAULT_COMMIT_DURATION = 48 * 60 * 60;    // 48 小时
    const DEFAULT_REVEAL_DURATION = 24 * 60 * 60;    // 24 小时
    const DEFAULT_CHALLENGE_DURATION = 7 * 24 * 60 * 60; // 7 天

    // ============ 1. MockERC20 (测试用 USDC) ============
    console.log("\n[1/6] Deploying MockERC20 (USDC)...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdcToken = await MockERC20.deploy("USD Coin", "USDC");
    await usdcToken.waitForDeployment();
    console.log("  USDC deployed to:", await usdcToken.getAddress());
    await usdcToken.mint(deployer.address, ethers.parseEther("1000000"));

    // ============ 2. TaskManager ============
    console.log("\n[2/6] Deploying TaskManager...");
    const TaskManager = await ethers.getContractFactory("TaskManager");
    const taskManager = await TaskManager.deploy();
    await taskManager.waitForDeployment();
    console.log("  TaskManager deployed to:", await taskManager.getAddress());

    // ============ 3. BountyEscrow ============
    console.log("\n[3/6] Deploying BountyEscrow...");
    const BountyEscrow = await ethers.getContractFactory("BountyEscrow");
    const bountyEscrow = await BountyEscrow.deploy(await taskManager.getAddress());
    await bountyEscrow.waitForDeployment();
    console.log("  BountyEscrow deployed to:", await bountyEscrow.getAddress());

    // ============ 4. AgentRegistry ============
    console.log("\n[4/6] Deploying AgentRegistry...");
    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    const agentRegistry = await AgentRegistry.deploy(await taskManager.getAddress());
    await agentRegistry.waitForDeployment();
    console.log("  AgentRegistry deployed to:", await agentRegistry.getAddress());

    // ============ 5. DeadlineController ============
    console.log("\n[5/6] Deploying DeadlineController...");
    const DeadlineController = await ethers.getContractFactory("DeadlineController");
    const deadlineController = await DeadlineController.deploy(await taskManager.getAddress());
    await deadlineController.waitForDeployment();
    console.log("  DeadlineController deployed to:", await deadlineController.getAddress());

    // ============ 6. 配置关联 ============
    console.log("\n[6/6] Configuring contract references...");

    await taskManager.setExternalContracts(
        await bountyEscrow.getAddress(),
        await agentRegistry.getAddress(),
        await deadlineController.getAddress()
    );
    await taskManager.setDurations(
        DEFAULT_COMMIT_DURATION,
        DEFAULT_REVEAL_DURATION,
        DEFAULT_CHALLENGE_DURATION
    );
    console.log("  TaskManager external contracts set");

    // 注册默认 Agent
    const defaultAgentTypes = {
        security: ethers.keccak256(ethers.toUtf8Bytes("security_agent")),
        tokenomics: ethers.keccak256(ethers.toUtf8Bytes("tokenomics_agent")),
        static: ethers.keccak256(ethers.toUtf8Bytes("static_agent")),
    };

    // 使用部署者地址作为默认 Agent (测试用)
    await agentRegistry.registerAgent("Security Agent", 0, "http://localhost:8080/security");   // Security
    await agentRegistry.registerAgent("Tokenomics Agent", 1, "http://localhost:8080/tokenomics"); // Tokenomics
    await agentRegistry.registerAgent("Static Analysis Agent", 2, "http://localhost:8080/static"); // StaticAnalysis
    console.log("  Default agents registered");

    // 设置默认系统 Agent
    await agentRegistry.setDefaultAgent(0, deployer.address); // Security
    await agentRegistry.setDefaultAgent(1, deployer.address); // Tokenomics (简化，使用同一地址)
    await agentRegistry.setDefaultAgent(2, deployer.address); // StaticAnalysis
    console.log("  System default agents configured");

    // ============ 部署总结 ============
    console.log("\n========== CeatDAO Deployment Summary ==========");
    console.log("USDC (Mock):         ", await usdcToken.getAddress());
    console.log("TaskManager:         ", await taskManager.getAddress());
    console.log("BountyEscrow:        ", await bountyEscrow.getAddress());
    console.log("AgentRegistry:       ", await agentRegistry.getAddress());
    console.log("DeadlineController:  ", await deadlineController.getAddress());
    console.log("==================================================");

    return { usdcToken, taskManager, bountyEscrow, agentRegistry, deadlineController };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
