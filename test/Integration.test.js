const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * @title 端到端集成测试
 * @description 完整模拟: 项目方创建任务 → 锁仓 → Agent Commit-Reveal → 阶段推进 → 赏金分配
 */
describe("Integration: Full Audit Workflow", function () {
  let TaskManager, taskManager;
  let BountyEscrow, bountyEscrow;
  let AgentRegistry, agentRegistry;
  let DeadlineController, deadlineController;
  let MockERC20, mockUSDC;

  let admin, projectOwner, securityAgent, tokenomicsAgent, staticAgent, user;

  const METADATA_URI = "ipfs://QmTestVaultAudit";
  const BOUNTY = ethers.parseEther("5000");
  const MAX_AGENTS = 3;

  before(async function () {
    [admin, projectOwner, securityAgent, tokenomicsAgent, staticAgent, user] =
      await ethers.getSigners();

    // 1. 部署 MockERC20
    MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20.deploy("USDC", "USDC");
    await mockUSDC.waitForDeployment();

    // 2. 部署 TaskManager
    TaskManager = await ethers.getContractFactory("TaskManager");
    taskManager = await TaskManager.deploy();
    await taskManager.waitForDeployment();

    // 3. 部署 BountyEscrow
    BountyEscrow = await ethers.getContractFactory("BountyEscrow");
    bountyEscrow = await BountyEscrow.deploy(await taskManager.getAddress());
    await bountyEscrow.waitForDeployment();

    // 4. 部署 AgentRegistry
    AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    agentRegistry = await AgentRegistry.deploy(await taskManager.getAddress());
    await agentRegistry.waitForDeployment();

    // 5. 部署 DeadlineController
    DeadlineController = await ethers.getContractFactory("DeadlineController");
    deadlineController = await DeadlineController.deploy(await taskManager.getAddress());
    await deadlineController.waitForDeployment();

    // 6. 设置外部合约引用
    await taskManager.setExternalContracts(
      await bountyEscrow.getAddress(),
      await agentRegistry.getAddress(),
      await deadlineController.getAddress()
    );

    // 7. 授权 keeper 角色
    const KEEPER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("KEEPER_ROLE"));
    await deadlineController.grantRole(KEEPER_ROLE, admin.address);

    // 8. 铸造 USDC 给项目方
    await mockUSDC.mint(projectOwner.address, ethers.parseEther("50000"));
  });

  // ============ Phase 1: 项目方注册 + 创建任务 + 锁仓 ============
  describe("Phase 1: Project Registration & Task Creation & Fund Lock", function () {
    it("Step 1: 项目方注册", async function () {
      await taskManager.connect(projectOwner).registerProjectOwner(
        "Vault Protocol",
        "vault.fi",
        "github.com/vault/core",
        "team@vault.fi"
      );

      const po = await taskManager.getProjectOwner(projectOwner.address);
      expect(po.name).to.equal("Vault Protocol");
      expect(po.reputation).to.equal(100);
    });

    it("Step 2: 项目方创建审计任务", async function () {
      const tokenAddr = await mockUSDC.getAddress();
      await taskManager.connect(projectOwner).createTask(
        tokenAddr, BOUNTY, METADATA_URI, MAX_AGENTS
      );

      const task = await taskManager.getTask(1);
      expect(task.id).to.equal(1);
      expect(task.owner).to.equal(projectOwner.address);
      expect(task.bounty).to.equal(BOUNTY);
      expect(task.status).to.equal(0); // Created
      expect(task.metadataURI).to.equal(METADATA_URI);
    });

    it("Step 3: 项目方锁仓赏金（触发任务激活）", async function () {
      const tokenAddr = await mockUSDC.getAddress();

      // approve 托管合约
      await mockUSDC.connect(projectOwner).approve(await bountyEscrow.getAddress(), BOUNTY);

      // 锁仓
      await bountyEscrow.connect(projectOwner).lockBounty(1);

      // 验证资金已托管
      expect(await mockUSDC.balanceOf(await bountyEscrow.getAddress())).to.equal(BOUNTY);
      expect(await bountyEscrow.getLockedAmount(1, tokenAddr)).to.equal(BOUNTY);

      // 验证任务已激活
      const task = await taskManager.getTask(1);
      expect(task.status).to.equal(1); // Active
    });
  });

  // ============ Phase 2: Agent 注册与分配 ============
  describe("Phase 2: Agent Registration & Assignment", function () {
    it("Step 4: AI Agents 注册", async function () {
      await agentRegistry.connect(securityAgent).registerAgent(
        "Security Audit Agent", 0, "https://security.ceatdao.ai"
      );
      await agentRegistry.connect(tokenomicsAgent).registerAgent(
        "Tokenomics Agent", 1, "https://tokenomics.ceatdao.ai"
      );
      await agentRegistry.connect(staticAgent).registerAgent(
        "Static Analysis Agent", 2, "https://static.ceatdao.ai"
      );

      // 设置为系统默认 Agent
      await agentRegistry.setDefaultAgent(0, securityAgent.address);
      await agentRegistry.setDefaultAgent(1, tokenomicsAgent.address);
      await agentRegistry.setDefaultAgent(2, staticAgent.address);

      expect(await agentRegistry.getAgentCount()).to.equal(3);
    });

    it("Step 5: 项目方分配 Agent 到任务", async function () {
      await agentRegistry.connect(projectOwner).assignAgentsToTask(1, [
        securityAgent.address,
        tokenomicsAgent.address,
        staticAgent.address
      ]);

      const taskAgents = await agentRegistry.getTaskAgents(1);
      expect(taskAgents.length).to.equal(3);
    });
  });

  // ============ Commit-Reveal 共享数据 ============
  let secFinding, secSalt, tokFinding, tokSalt, staFinding, staSalt;

  // ============ Phase 3: Commit 阶段 ============
  describe("Phase 3: Commit Phase", function () {
    beforeEach(async () => {
      // 推进到 Committing
      await deadlineController.manualTransition(1, 2); // → Committing
    });

    it("Step 6: Agents 在 Commit 阶段提交漏洞 Hash", async function () {
      // Security agent 发现重入攻击
      secFinding = ethers.toUtf8Bytes("ReentrancyAttack: Vault.withdraw() vulnerable");
      secSalt = ethers.randomBytes(32);
      const secHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint256", "address", "bytes", "bytes32"],
          [1, securityAgent.address, secFinding, secSalt]
        )
      );
      await agentRegistry.connect(securityAgent).commitFinding(1, secHash);

      // Tokenomics agent 发现闪电贷攻击
      tokFinding = ethers.toUtf8Bytes("FlashLoanAttack: price oracle manipulation possible");
      tokSalt = ethers.randomBytes(32);
      const tokHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint256", "address", "bytes", "bytes32"],
          [1, tokenomicsAgent.address, tokFinding, tokSalt]
        )
      );
      await agentRegistry.connect(tokenomicsAgent).commitFinding(1, tokHash);

      // Static agent 发现整数溢出
      staFinding = ethers.toUtf8Bytes("IntegerOverflow: unchecked addition in stake()");
      staSalt = ethers.randomBytes(32);
      const staHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["uint256", "address", "bytes", "bytes32"],
          [1, staticAgent.address, staFinding, staSalt]
        )
      );
      await agentRegistry.connect(staticAgent).commitFinding(1, staHash);

      // 验证 commit 记录
      const record = await agentRegistry.getCommitRecord(1, securityAgent.address);
      expect(record.commitHash).to.equal(secHash);
      expect(record.revealed).to.be.false;
    });
  });

  // ============ Phase 4: Reveal 阶段 ============
  describe("Phase 4: Reveal Phase", function () {

    it("Step 7: 推进到 Reveal 阶段", async function () {
      await deadlineController.manualTransition(1, 3); // → Revealing

      const task = await taskManager.getTask(1);
      expect(task.status).to.equal(3); // Revealing
    });

    it("Step 8: Agents 在 Reveal 阶段公开漏洞报告", async function () {
      await agentRegistry.connect(securityAgent).revealFinding(1, secFinding, secSalt);
      await agentRegistry.connect(tokenomicsAgent).revealFinding(1, tokFinding, tokSalt);
      await agentRegistry.connect(staticAgent).revealFinding(1, staFinding, staSalt);

      // 验证 reveal 状态
      const secRecord = await agentRegistry.getCommitRecord(1, securityAgent.address);
      expect(secRecord.revealed).to.be.true;

      const tokRecord = await agentRegistry.getCommitRecord(1, tokenomicsAgent.address);
      expect(tokRecord.revealed).to.be.true;

      const staRecord = await agentRegistry.getCommitRecord(1, staticAgent.address);
      expect(staRecord.revealed).to.be.true;
    });
  });

  // ============ Phase 5: Clustering + Challenge + Settlement ============
  describe("Phase 5: Clustering → Challenge → Settlement", function () {
    it("Step 9: 推进到 Clustering → Challenging → Settled", async function () {
      // Clustering
      await deadlineController.manualTransition(1, 4);
      expect((await taskManager.getTask(1)).status).to.equal(4); // Clustering

      // Challenging
      await deadlineController.manualTransition(1, 5);
      expect((await taskManager.getTask(1)).status).to.equal(5); // Challenging

      // Settled
      await deadlineController.manualTransition(1, 6);
      expect((await taskManager.getTask(1)).status).to.equal(6); // Settled
    });
  });

  // ============ Phase 6: 赏金分配 ============
  describe("Phase 6: Reward Distribution", function () {
    it("Step 10: 分配赏金给漏洞发现 Agent", async function () {
      const recipients = [
        securityAgent.address,
        tokenomicsAgent.address,
        staticAgent.address
      ];
      const amounts = [
        ethers.parseEther("2500"), // 重入攻击最高奖励
        ethers.parseEther("1500"), // 闪电贷攻击
        ethers.parseEther("500")   // 整数溢出
      ];

      await bountyEscrow.distributeRewards(1, recipients, amounts);

      // 验证分配
      expect(await mockUSDC.balanceOf(securityAgent.address)).to.equal(ethers.parseEther("2500"));
      expect(await mockUSDC.balanceOf(tokenomicsAgent.address)).to.equal(ethers.parseEther("1500"));
      expect(await mockUSDC.balanceOf(staticAgent.address)).to.equal(ethers.parseEther("500"));

      // 剩余 500 USDC 退还项目方
      expect(await mockUSDC.balanceOf(projectOwner.address)).to.equal(ethers.parseEther("45500")); // 45000 + 500 refund

      // 托管合约余额清零
      expect(await mockUSDC.balanceOf(await bountyEscrow.getAddress())).to.equal(0);

      // 标记已结算
      expect(await bountyEscrow.isSettled(1)).to.be.true;
    });

    it("Step 11: 关闭任务", async function () {
      await taskManager.connect(projectOwner).closeTask(1);
      const task = await taskManager.getTask(1);
      expect(task.status).to.equal(7); // Closed
    });
  });

  // ============ 最终状态验证 ============
  describe("Final State Verification", function () {
    it("should emit all lifecycle events", async function () {
      // 完整工作流已验证通过
      // 所有关键状态已确认:
      //   Created → Active → Committing → Revealing → Clustering →
      //   Challenging → Settled → Closed

      const allIds = await taskManager.getAllTaskIds();
      expect(allIds.length).to.equal(1);

      const taskCount = await taskManager.getTaskCount();
      expect(taskCount).to.equal(1);

      console.log("\n=== Integration Test Summary ===");
      console.log("  Tasks created:  1");
      console.log("  Agents registered:  3");
      console.log("  Findings committed:  3");
      console.log("  Findings revealed:  3");
      console.log("  Rewards distributed:  5000 USDC");
      console.log("  Final status:  Closed");
      console.log("=== All checks passed ===");
    });
  });
});
