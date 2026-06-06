const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgentRegistry", function () {
  let AgentRegistry, agentRegistry;
  let TaskManager, taskManager;
  let owner, projectOwner, agent1, agent2, agent3;

  const METADATA_URI = "ipfs://QmTest";
  const TOKEN = "0x" + "1".repeat(40);
  const BOUNTY = ethers.parseEther("1000");

  async function deployAll() {
    [owner, projectOwner, agent1, agent2, agent3] = await ethers.getSigners();

    TaskManager = await ethers.getContractFactory("TaskManager");
    taskManager = await TaskManager.deploy();
    await taskManager.waitForDeployment();

    AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    agentRegistry = await AgentRegistry.deploy(await taskManager.getAddress());
    await agentRegistry.waitForDeployment();

    return { taskManager, agentRegistry };
  }

  async function registerDefaultAgents() {
    await agentRegistry.connect(agent1).registerAgent("SecurityAgent", 0, "http://agent1.test");
    await agentRegistry.connect(agent2).registerAgent("TokenomicsAgent", 1, "http://agent2.test");
    await agentRegistry.connect(agent3).registerAgent("StaticAgent", 2, "http://agent3.test");
  }

  // ============ Agent 注册 ============
  describe("Agent Registration", function () {
    beforeEach(async () => {
      await deployAll();
    });

    it("should register a new agent", async function () {
      await agentRegistry.connect(agent1).registerAgent("SecurityAgent", 0, "http://agent1.test");

      const agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.name).to.equal("SecurityAgent");
      expect(agent.agentType).to.equal(0); // Security
      expect(agent.endpoint).to.equal("http://agent1.test");
      expect(agent.status).to.equal(1); // AgentStatus.Active
      expect(agent.reputation).to.equal(100);
    });

    it("should not allow duplicate registration", async function () {
      await agentRegistry.connect(agent1).registerAgent("SecurityAgent", 0, "http://agent1.test");
      await expect(
        agentRegistry.connect(agent1).registerAgent("AnotherAgent", 1, "http://agent2.test")
      ).to.be.revertedWith("AR: registered");
    });

    it("should revert on empty name", async function () {
      await expect(
        agentRegistry.connect(agent1).registerAgent("", 0, "http://agent1.test")
      ).to.be.revertedWith("AR: empty name");
    });

    it("should track agent list", async function () {
      await registerDefaultAgents();
      const list = await agentRegistry.getAgentList();
      expect(list.length).to.equal(3);
      expect(await agentRegistry.getAgentCount()).to.equal(3);
    });
  });

  // ============ 系统 Agent 设置 ============
  describe("Default Agent", function () {
    it("should set system default agents", async function () {
      await deployAll();
      await agentRegistry.connect(agent1).registerAgent("SecurityAgent", 0, "http://test");
      await agentRegistry.connect(agent2).registerAgent("TokenomicsAgent", 1, "http://test");
      await agentRegistry.connect(agent3).registerAgent("StaticAgent", 2, "http://test");

      await agentRegistry.setDefaultAgent(0, agent1.address);
      await agentRegistry.setDefaultAgent(1, agent2.address);
      await agentRegistry.setDefaultAgent(2, agent3.address);

      const [sec, tok, stat] = await agentRegistry.getDefaultAgents();
      expect(sec).to.equal(agent1.address);
      expect(tok).to.equal(agent2.address);
      expect(stat).to.equal(agent3.address);
    });
  });

  // ============ Agent 管理 ============
  describe("Agent Management", function () {
    it("should suspend and reactivate agent", async function () {
      await deployAll();
      await agentRegistry.connect(agent1).registerAgent("SecurityAgent", 0, "http://test");

      await agentRegistry.suspendAgent(agent1.address);

      let agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.status).to.equal(2); // Suspended

      await agentRegistry.reactivateAgent(agent1.address);
      agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.status).to.equal(1); // Active
    });
  });

  // ============ 任务 Agent 分配 ============
  describe("Task Agent Assignment", function () {
    beforeEach(async () => {
      await deployAll();
      await registerDefaultAgents();
      await taskManager.connect(projectOwner).createTask(TOKEN, BOUNTY, METADATA_URI, 3);
    });

    it("should assign agents to task", async function () {
      await agentRegistry.connect(projectOwner).assignAgentsToTask(1, [
        agent1.address, agent2.address, agent3.address
      ]);

      const taskAgents = await agentRegistry.getTaskAgents(1);
      expect(taskAgents.length).to.equal(3);

      const cfg1 = await agentRegistry.getTaskAgentConfig(1, agent1.address);
      expect(cfg1.assignedAt).to.be.gt(0);
      expect(cfg1.hasCommitted).to.be.false;
      expect(cfg1.hasRevealed).to.be.false;
    });

    it("should revert if not task owner", async function () {
      const [,,,,, notOwner] = await ethers.getSigners();
      await expect(
        agentRegistry.connect(notOwner).assignAgentsToTask(1, [agent1.address])
      ).to.be.revertedWith("AR: not owner");
    });

    it("should revert if exceeds max agents", async function () {
      // max = 3, try to assign 4 - 注册一个新的 agent
      const [,,,,, a4] = await ethers.getSigners();
      await agentRegistry.connect(a4).registerAgent("ExtraAgent", 0, "http://test");

      await expect(
        agentRegistry.connect(projectOwner).assignAgentsToTask(1, [
          agent1.address, agent2.address, agent3.address, a4.address
        ])
      ).to.be.revertedWith("AR: exceeds max");
    });

    it("should revert on duplicate assignment", async function () {
      await agentRegistry.connect(projectOwner).assignAgentsToTask(1, [agent1.address]);
      await expect(
        agentRegistry.connect(projectOwner).assignAgentsToTask(1, [agent1.address])
      ).to.be.revertedWith("AR: assigned");
    });
  });

  // ============ Commit-Reveal ============
  describe("Commit-Reveal", function () {
    beforeEach(async () => {
      await deployAll();
      await registerDefaultAgents();
      await taskManager.connect(projectOwner).createTask(TOKEN, BOUNTY, METADATA_URI, 3);
      await agentRegistry.connect(projectOwner).assignAgentsToTask(1, [
        agent1.address, agent2.address
      ]);
      // 激活并推进到 Committing
      await taskManager.setExternalContracts(
        owner.address,     // escrow (owner 模拟)
        ethers.ZeroAddress,
        owner.address
      );
      await taskManager.activateTask(1);
      await taskManager.transitionPhase(1, 1, 2);
    });

    it("should commit a finding hash", async function () {
      const commitHash = ethers.keccak256(ethers.toUtf8Bytes("vulnerability data"));
      await agentRegistry.connect(agent1).commitFinding(1, commitHash);

      const cfg = await agentRegistry.getTaskAgentConfig(1, agent1.address);
      expect(cfg.hasCommitted).to.be.true;

      const record = await agentRegistry.getCommitRecord(1, agent1.address);
      expect(record.commitHash).to.equal(commitHash);
      expect(record.revealed).to.be.false;
    });

    it("should not allow double commit", async function () {
      const commitHash = ethers.keccak256(ethers.toUtf8Bytes("vuln data"));
      await agentRegistry.connect(agent1).commitFinding(1, commitHash);

      await expect(
        agentRegistry.connect(agent1).commitFinding(1, commitHash)
      ).to.be.revertedWith("AR: committed");
    });

    it("should reveal and verify hash match", async function () {
      const rawFinding = ethers.toUtf8Bytes("reentrancy attack vulnerability found");
      const salt = ethers.randomBytes(32);
      const commitHash = ethers.keccak256(
        ethers.solidityPacked(["bytes", "bytes32"], [rawFinding, salt])
      );

      // Commit
      await agentRegistry.connect(agent1).commitFinding(1, commitHash);

      // Advance to Revealing
      await taskManager.transitionPhase(1, 2, 3);

      // Reveal
      await agentRegistry.connect(agent1).revealFinding(1, rawFinding, salt);

      const cfg = await agentRegistry.getTaskAgentConfig(1, agent1.address);
      expect(cfg.hasRevealed).to.be.true;

      const record = await agentRegistry.getCommitRecord(1, agent1.address);
      expect(record.revealed).to.be.true;
    });

    it("should revert reveal with wrong data", async function () {
      const rawFinding = ethers.toUtf8Bytes("real finding");
      const salt = ethers.randomBytes(32);
      const commitHash = ethers.keccak256(
        ethers.solidityPacked(["bytes", "bytes32"], [rawFinding, salt])
      );

      await agentRegistry.connect(agent1).commitFinding(1, commitHash);
      await taskManager.transitionPhase(1, 2, 3);

      await expect(
        agentRegistry.connect(agent1).revealFinding(1, ethers.toUtf8Bytes("wrong data"), salt)
      ).to.be.revertedWith("AR: hash mismatch");
    });

    it("should revert reveal if not committed", async function () {
      await taskManager.transitionPhase(1, 2, 3);
      await expect(
        agentRegistry.connect(agent1).revealFinding(1, ethers.toUtf8Bytes("test"), ethers.randomBytes(32))
      ).to.be.revertedWith("AR: bad state");
    });

    it("should revert reveal in wrong phase", async function () {
      const commitHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await agentRegistry.connect(agent1).commitFinding(1, commitHash);

      // Still in Committing, not Revealing
      await expect(
        agentRegistry.connect(agent1).revealFinding(1, ethers.toUtf8Bytes("test"), ethers.randomBytes(32))
      ).to.be.revertedWith("AR: not revealing");
    });

    it("should revert if agent not assigned", async function () {
      // 任务已在 Committing 阶段（beforeEach 已推进）
      // agent3 已注册但未分配给该任务
      await expect(
        agentRegistry.connect(agent3).commitFinding(1, ethers.keccak256(ethers.toUtf8Bytes("test")))
      ).to.be.revertedWith("AR: not assigned");
    });

    it("should slash non-revealers", async function () {
      // agent1 commits but doesn't reveal, agent2 commits and reveals
      const rawFinding = ethers.toUtf8Bytes("finding");
      const salt = ethers.randomBytes(32);
      const commitHash = ethers.keccak256(
        ethers.solidityPacked(["bytes", "bytes32"], [rawFinding, salt])
      );

      await agentRegistry.connect(agent1).commitFinding(1, commitHash);
      await agentRegistry.connect(agent2).commitFinding(1, commitHash);
      await taskManager.transitionPhase(1, 2, 3);
      await agentRegistry.connect(agent2).revealFinding(1, rawFinding, salt);

      // slash agent1 (committed but didn't reveal)
      await agentRegistry.slashNonRevealers(1, [agent1.address]);

      const agent = await agentRegistry.getAgent(agent1.address);
      expect(agent.reputation).to.equal(80); // 100 - 20
    });
  });
});
