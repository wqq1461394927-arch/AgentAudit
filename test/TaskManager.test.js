const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TaskManager", function () {
  let TaskManager, taskManager;
  let owner, user1, user2;

  const TASK_DURATION = 30 * 24 * 3600; // 30 days
  const COMMIT_DURATION = 48 * 3600;
  const REVEAL_DURATION = 24 * 3600;
  const CHALLENGE_DURATION = 7 * 24 * 3600;
  const TOKEN = "0x" + "1".repeat(40);
  const METADATA_URI = "ipfs://QmTest";
  const MAX_AGENTS = 5;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    TaskManager = await ethers.getContractFactory("TaskManager");
    taskManager = await TaskManager.deploy();
    await taskManager.waitForDeployment();
  });

  // ============ 基础配置 ============
  describe("Configuration", function () {
    it("should start with nextTaskId = 1", async function () {
      expect(await taskManager.nextTaskId()).to.equal(1);
    });

    it("should have default durations set", async function () {
      expect(await taskManager.maxTaskDuration()).to.equal(TASK_DURATION);
      expect(await taskManager.defaultCommitDuration()).to.equal(COMMIT_DURATION);
      expect(await taskManager.defaultRevealDuration()).to.equal(REVEAL_DURATION);
      expect(await taskManager.defaultChallengeDuration()).to.equal(CHALLENGE_DURATION);
    });

    it("should allow admin to change durations", async function () {
      await taskManager.setDurations(1, 2, 3);
      expect(await taskManager.defaultCommitDuration()).to.equal(1);
      expect(await taskManager.defaultRevealDuration()).to.equal(2);
      expect(await taskManager.defaultChallengeDuration()).to.equal(3);
    });
  });

  // ============ 项目方注册 ============
  describe("ProjectOwner Registration", function () {
    it("should register a new project owner", async function () {
      await taskManager.connect(user1).registerProjectOwner(
        "MyProject", "myproject.io", "github.com/my/repo", "me@test.com"
      );

      const po = await taskManager.getProjectOwner(user1.address);
      expect(po.name).to.equal("MyProject");
      expect(po.website).to.equal("myproject.io");
      expect(po.githubRepo).to.equal("github.com/my/repo");
      expect(po.contactEmail).to.equal("me@test.com");
      expect(po.reputation).to.equal(100);
      expect(po.totalTasks).to.equal(0);
    });

    it("should not allow double registration", async function () {
      await taskManager.connect(user1).registerProjectOwner(
        "MyProject", "myproject.io", "github.com/my/repo", "me@test.com"
      );
      await expect(
        taskManager.connect(user1).registerProjectOwner(
          "MyProject2", "myproject.io", "github.com/my/repo", "me@test.com"
        )
      ).to.be.revertedWith("TaskManager: already registered");
    });
  });

  // ============ 任务创建 ============
  describe("Task Creation", function () {
    it("should create a task in Created status", async function () {
      await taskManager.connect(user1).createTask(
        TOKEN, ethers.parseEther("1000"), METADATA_URI, MAX_AGENTS
      );

      const task = await taskManager.getTask(1);
      expect(task.id).to.equal(1);
      expect(task.owner).to.equal(user1.address);
      expect(task.bountyToken).to.equal(TOKEN);
      expect(task.bounty).to.equal(ethers.parseEther("1000"));
      expect(task.metadataURI).to.equal(METADATA_URI);
      expect(task.maxAgents).to.equal(MAX_AGENTS);
      expect(task.status).to.equal(0); // TaskStatus.Created
      expect(task.commitDeadline).to.equal(0);
    });

    it("should revert on zero bounty", async function () {
      await expect(
        taskManager.connect(user1).createTask(TOKEN, 0, METADATA_URI, MAX_AGENTS)
      ).to.be.revertedWith("TaskManager: zero bounty");
    });

    it("should revert on zero token address", async function () {
      await expect(
        taskManager.connect(user1).createTask(
          ethers.ZeroAddress, ethers.parseEther("1000"), METADATA_URI, MAX_AGENTS
        )
      ).to.be.revertedWith("TaskManager: zero token");
    });

    it("should revert on empty metadata", async function () {
      await expect(
        taskManager.connect(user1).createTask(TOKEN, ethers.parseEther("1000"), "", MAX_AGENTS)
      ).to.be.revertedWith("TaskManager: empty metadata");
    });

    it("should revert on zero max agents", async function () {
      await expect(
        taskManager.connect(user1).createTask(TOKEN, ethers.parseEther("1000"), METADATA_URI, 0)
      ).to.be.revertedWith("TaskManager: zero max agents");
    });

    it("should increment taskId correctly", async function () {
      await taskManager.connect(user1).createTask(TOKEN, ethers.parseEther("1000"), METADATA_URI, MAX_AGENTS);
      await taskManager.connect(user2).createTask(TOKEN, ethers.parseEther("500"), METADATA_URI, MAX_AGENTS);

      expect(await taskManager.nextTaskId()).to.equal(3);
      expect(await taskManager.getTaskCount()).to.equal(2);
    });

    it("should track task for registered project owner", async function () {
      await taskManager.connect(user1).registerProjectOwner(
        "MyProject", "myproject.io", "github.com/my/repo", "me@test.com"
      );
      await taskManager.connect(user1).createTask(TOKEN, ethers.parseEther("1000"), METADATA_URI, MAX_AGENTS);

      const po = await taskManager.getProjectOwner(user1.address);
      expect(po.totalTasks).to.equal(1);
    });
  });

  // ============ 任务激活 ============
  describe("Task Activation", function () {
    it("should only be callable by BountyEscrow", async function () {
      await taskManager.connect(user1).createTask(TOKEN, ethers.parseEther("1000"), METADATA_URI, MAX_AGENTS);
      await taskManager.setExternalContracts(user2.address, ethers.ZeroAddress, ethers.ZeroAddress);

      await expect(
        taskManager.activateTask(1)
      ).to.be.revertedWith("TaskManager: only BountyEscrow");

      await expect(
        taskManager.connect(user2).activateTask(1)
      ).to.not.be.reverted;
    });

    it("should activate task and set deadlines", async function () {
      await taskManager.connect(user1).createTask(TOKEN, ethers.parseEther("1000"), METADATA_URI, MAX_AGENTS);
      await taskManager.setExternalContracts(owner.address, ethers.ZeroAddress, ethers.ZeroAddress);

      const tx = await taskManager.activateTask(1);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      const task = await taskManager.getTask(1);
      expect(task.status).to.equal(1); // Active

      // 验证截止时间计算
      expect(task.commitDeadline).to.equal(Number(block.timestamp) + COMMIT_DURATION);
      expect(task.revealDeadline).to.equal(Number(block.timestamp) + COMMIT_DURATION + REVEAL_DURATION);
      expect(task.challengeDeadline).to.equal(Number(block.timestamp) + COMMIT_DURATION + REVEAL_DURATION + CHALLENGE_DURATION);
    });
  });

  // ============ 阶段转换 ============
  describe("Phase Transitions", function () {
    async function setupActivatedTask() {
      await taskManager.connect(user1).createTask(TOKEN, ethers.parseEther("1000"), METADATA_URI, MAX_AGENTS);
      await taskManager.setExternalContracts(
        owner.address,     // escrow → owner 模拟
        ethers.ZeroAddress,
        owner.address      // deadlineController
      );
      // 先用 owner 模拟手动推进到 Active（simulating escrow callback）
      await taskManager.activateTask(1);
      return 1;
    }

    it("should transition Active -> Committing (by deadline controller)", async function () {
      const tid = await setupActivatedTask();
      await taskManager.transitionToCommitting(tid);

      const task = await taskManager.getTask(tid);
      expect(task.status).to.equal(2); // Committing
    });

    it("should transition Committing -> Revealing", async function () {
      const tid = await setupActivatedTask();
      await taskManager.transitionToCommitting(tid);
      await taskManager.transitionToRevealing(tid);

      const task = await taskManager.getTask(tid);
      expect(task.status).to.equal(3); // Revealing
    });

    it("should revert transition from wrong status", async function () {
      const tid = await setupActivatedTask();
      await expect(
        taskManager.transitionToRevealing(tid)
      ).to.be.revertedWith("TaskManager: invalid status");
    });

    it("should transition Revealing -> Clustering", async function () {
      const tid = await setupActivatedTask();
      await taskManager.transitionToCommitting(tid);
      await taskManager.transitionToRevealing(tid);
      await taskManager.transitionToClustering(tid);

      const task = await taskManager.getTask(tid);
      expect(task.status).to.equal(4); // Clustering
    });

    it("should transition Clustering -> Challenging", async function () {
      const tid = await setupActivatedTask();
      await taskManager.transitionToCommitting(tid);
      await taskManager.transitionToRevealing(tid);
      await taskManager.transitionToClustering(tid);
      await taskManager.transitionToChallenging(tid);

      const task = await taskManager.getTask(tid);
      expect(task.status).to.equal(5); // Challenging
    });

    it("should transition Challenging -> Settled", async function () {
      const tid = await setupActivatedTask();
      await taskManager.transitionToCommitting(tid);
      await taskManager.transitionToRevealing(tid);
      await taskManager.transitionToClustering(tid);
      await taskManager.transitionToChallenging(tid);
      await taskManager.transitionToSettled(tid);

      const task = await taskManager.getTask(tid);
      expect(task.status).to.equal(6); // Settled
    });

    it("should close task from Settled", async function () {
      const tid = await setupActivatedTask();
      await taskManager.transitionToCommitting(tid);
      await taskManager.transitionToRevealing(tid);
      await taskManager.transitionToClustering(tid);
      await taskManager.transitionToChallenging(tid);
      await taskManager.transitionToSettled(tid);
      await taskManager.connect(user1).closeTask(tid);

      const task = await taskManager.getTask(tid);
      expect(task.status).to.equal(7); // Closed
    });
  });

  // ============ 查询功能 ============
  describe("Query Functions", function () {
    it("should return tasks array", async function () {
      await taskManager.connect(user1).createTask(TOKEN, ethers.parseEther("1000"), METADATA_URI, MAX_AGENTS);
      await taskManager.connect(user2).createTask(TOKEN, ethers.parseEther("500"), METADATA_URI, MAX_AGENTS);

      const ids = await taskManager.getAllTaskIds();
      expect(ids.length).to.equal(2);
    });

    it("should check task ownership", async function () {
      await taskManager.connect(user1).createTask(TOKEN, ethers.parseEther("1000"), METADATA_URI, MAX_AGENTS);

      expect(await taskManager.isTaskOwner(1, user1.address)).to.be.true;
      expect(await taskManager.isTaskOwner(1, user2.address)).to.be.false;
    });

    it("should return escrow data", async function () {
      await taskManager.connect(user1).createTask(TOKEN, ethers.parseEther("1000"), METADATA_URI, MAX_AGENTS);
      const data = await taskManager.getTaskEscrowData(1);
      expect(data.id).to.equal(1);
      expect(data.owner).to.equal(user1.address);
      expect(data.bountyToken).to.equal(TOKEN);
      expect(data.bounty).to.equal(ethers.parseEther("1000"));
      expect(data.status).to.equal(0);
      expect(data.maxAgents).to.equal(MAX_AGENTS);
    });

    it("should return deadline data", async function () {
      await taskManager.connect(user1).createTask(TOKEN, ethers.parseEther("1000"), METADATA_URI, MAX_AGENTS);
      const data = await taskManager.getTaskDeadlineData(1);
      expect(data.id).to.equal(1);
      expect(data.commitDeadline).to.equal(0);
      expect(data.revealDeadline).to.equal(0);
      expect(data.challengeDeadline).to.equal(0);
      expect(data.status).to.equal(0);
    });
  });
});
