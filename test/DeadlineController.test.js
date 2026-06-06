const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DeadlineController", function () {
  let DeadlineController, deadlineController;
  let TaskManager, taskManager;
  let owner, keeper, user;

  const METADATA_URI = "ipfs://QmTest";
  const TOKEN = "0x" + "1".repeat(40);
  const BOUNTY = ethers.parseEther("1000");

  async function deployAll() {
    [owner, keeper, user] = await ethers.getSigners();

    TaskManager = await ethers.getContractFactory("TaskManager");
    taskManager = await TaskManager.deploy();
    await taskManager.waitForDeployment();

    DeadlineController = await ethers.getContractFactory("DeadlineController");
    deadlineController = await DeadlineController.deploy(await taskManager.getAddress());
    await deadlineController.waitForDeployment();

    // 设置外部合约引用
    await taskManager.setExternalContracts(
      owner.address,                          // escrow (admin 模拟)
      ethers.ZeroAddress,                     // agentRegistry
      await deadlineController.getAddress()
    );

    return { taskManager, deadlineController };
  }

  async function createAndActivateTask() {
    await taskManager.connect(user).createTask(TOKEN, BOUNTY, METADATA_URI, 5);
    // 模拟 BountyEscrow 回调激活 (通过 admin 直接调用)
    await taskManager.activateTask(1);
    return 1;
  }

  // ============ checkUpkeep ============
  describe("checkUpkeep", function () {
    beforeEach(async () => {
      await deployAll();
    });

    it("should return true for Active status (needs transition to Committing)", async function () {
      await createAndActivateTask();
      expect(await deadlineController.checkUpkeep(1)).to.be.true;
    });

    it("should return false for invalid task", async function () {
      expect(await deadlineController.checkUpkeep(999)).to.be.false;
    });

    it("should return false for Created status", async function () {
      await taskManager.connect(user).createTask(TOKEN, BOUNTY, METADATA_URI, 5);
      expect(await deadlineController.checkUpkeep(1)).to.be.false;
    });

    it("should return true when commit deadline passed", async function () {
      await createAndActivateTask();
      await deadlineController.performUpkeep(1); // Active → Committing (owner has KEEPER_ROLE)

      // 快进时间超过 commit deadline
      await ethers.provider.send("evm_increaseTime", [49 * 3600]); // 49 hours > 48 hours
      await ethers.provider.send("evm_mine");

      expect(await deadlineController.checkUpkeep(1)).to.be.true;
    });
  });

  // ============ performUpkeep ============
  describe("performUpkeep", function () {
    beforeEach(async () => {
      await deployAll();
      // 授予 keeper 角色给 keeper 地址
      const KEEPER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("KEEPER_ROLE"));
      await deadlineController.grantRole(KEEPER_ROLE, keeper.address);
    });

    it("should transition Active → Committing", async function () {
      await createAndActivateTask();
      await deadlineController.connect(keeper).performUpkeep(1);

      const task = await taskManager.getTask(1);
      expect(task.status).to.equal(2); // Committing
    });

    it("should transition Committing → Revealing after deadline", async function () {
      await createAndActivateTask();
      // Active → Committing
      await deadlineController.connect(keeper).performUpkeep(1);

      // 快进时间
      await ethers.provider.send("evm_increaseTime", [49 * 3600]);
      await ethers.provider.send("evm_mine");

      // Committing → Revealing
      await deadlineController.connect(keeper).performUpkeep(1);

      const task = await taskManager.getTask(1);
      expect(task.status).to.equal(3); // Revealing
    });

    it("should transition Revealing → Clustering after deadline", async function () {
      await createAndActivateTask();
      // Active → Committing
      await deadlineController.connect(keeper).performUpkeep(1);
      await ethers.provider.send("evm_increaseTime", [49 * 3600]);
      await ethers.provider.send("evm_mine");
      // Committing → Revealing
      await deadlineController.connect(keeper).performUpkeep(1);

      // 快进时间超过 reveal deadline
      await ethers.provider.send("evm_increaseTime", [25 * 3600]);
      await ethers.provider.send("evm_mine");

      await deadlineController.connect(keeper).performUpkeep(1);

      const task = await taskManager.getTask(1);
      expect(task.status).to.equal(4); // Clustering
    });

    it("should transition Clustering → Challenging (immediately)", async function () {
      await createAndActivateTask();
      await deadlineController.connect(keeper).performUpkeep(1);
      await ethers.provider.send("evm_increaseTime", [49 * 3600]);
      await ethers.provider.send("evm_mine");
      await deadlineController.connect(keeper).performUpkeep(1);
      await ethers.provider.send("evm_increaseTime", [25 * 3600]);
      await ethers.provider.send("evm_mine");
      await deadlineController.connect(keeper).performUpkeep(1);

      // Clustering → Challenging (立即)
      await deadlineController.connect(keeper).performUpkeep(1);

      const task = await taskManager.getTask(1);
      expect(task.status).to.equal(5); // Challenging
    });

    it("should transition Challenging → Settled after deadline", async function () {
      await createAndActivateTask();
      // Active → Committing
      await deadlineController.connect(keeper).performUpkeep(1);
      await ethers.provider.send("evm_increaseTime", [49 * 3600]);
      await ethers.provider.send("evm_mine");
      // Committing → Revealing
      await deadlineController.connect(keeper).performUpkeep(1);
      await ethers.provider.send("evm_increaseTime", [25 * 3600]);
      await ethers.provider.send("evm_mine");
      // Revealing → Clustering
      await deadlineController.connect(keeper).performUpkeep(1);
      // Clustering → Challenging
      await deadlineController.connect(keeper).performUpkeep(1);

      // 快进时间超过 challenge deadline
      await ethers.provider.send("evm_increaseTime", [8 * 24 * 3600]); // 8 days > 7 days
      await ethers.provider.send("evm_mine");

      await deadlineController.connect(keeper).performUpkeep(1);

      const task = await taskManager.getTask(1);
      expect(task.status).to.equal(6); // Settled
    });

    it("should revert if not keeper", async function () {
      await createAndActivateTask();
      await expect(
        deadlineController.connect(user).performUpkeep(1)
      ).to.be.reverted;
    });
  });

  // ============ manualTransition ============
  describe("manualTransition", function () {
    it("should allow admin to manually transition", async function () {
      await deployAll();
      await createAndActivateTask();

      await deadlineController.manualTransition(1, 2); // → Committing
      const task = await taskManager.getTask(1);
      expect(task.status).to.equal(2); // Committing
    });

    it("should revert for non-admin", async function () {
      await deployAll();
      await createAndActivateTask();

      await expect(
        deadlineController.connect(user).manualTransition(1, 2)
      ).to.be.reverted;
    });

    it("should revert for invalid target status", async function () {
      await deployAll();
      await createAndActivateTask();

      await expect(
        deadlineController.manualTransition(1, 0) // Created
      ).to.be.revertedWith("DC: invalid target");
    });

    it("should support full lifecycle via manual transition", async function () {
      await deployAll();
      await createAndActivateTask();

      // Active → Committing
      await deadlineController.manualTransition(1, 2);
      // Committing → Revealing
      await deadlineController.manualTransition(1, 3);
      // Revealing → Clustering
      await deadlineController.manualTransition(1, 4);
      // Clustering → Challenging
      await deadlineController.manualTransition(1, 5);
      // Challenging → Settled
      await deadlineController.manualTransition(1, 6);

      const task = await taskManager.getTask(1);
      expect(task.status).to.equal(6); // Settled
    });
  });

  // ============ getDeadlines ============
  describe("getDeadlines", function () {
    it("should return deadlines after activation", async function () {
      await deployAll();
      await createAndActivateTask();

      const [cd, rd, chd, status] = await deadlineController.getDeadlines(1);
      expect(cd).to.be.gt(0);
      expect(rd).to.be.gt(cd);
      expect(chd).to.be.gt(rd);
      expect(status).to.equal(1); // Active
    });
  });
});
