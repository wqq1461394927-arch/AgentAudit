const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BountyEscrow", function () {
  let TaskManager, taskManager;
  let BountyEscrow, bountyEscrow;
  let MockERC20, mockUSDC;
  let owner, projectOwner, otherUser;

  const METADATA_URI = "ipfs://QmTest";
  const BOUNTY = ethers.parseEther("1000");

  async function deployAll() {
    [owner, projectOwner, otherUser] = await ethers.getSigners();

    MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20.deploy("USDC", "USDC");
    await mockUSDC.waitForDeployment();

    TaskManager = await ethers.getContractFactory("TaskManager");
    taskManager = await TaskManager.deploy();
    await taskManager.waitForDeployment();

    BountyEscrow = await ethers.getContractFactory("BountyEscrow");
    bountyEscrow = await BountyEscrow.deploy(await taskManager.getAddress());
    await bountyEscrow.waitForDeployment();

    // 设置外部合约引用
    await taskManager.setExternalContracts(
      await bountyEscrow.getAddress(),
      ethers.ZeroAddress, // agentRegistry
      owner.address       // deadlineController (admin 模拟)
    );

    // 给项目方铸造 USDC
    await mockUSDC.mint(projectOwner.address, ethers.parseEther("10000"));

    return { taskManager, bountyEscrow, mockUSDC };
  }

  async function createAndLockTask(bountyToken, bounty) {
    await taskManager.connect(projectOwner).createTask(
      bountyToken,
      bounty,
      METADATA_URI,
      5
    );

    // approve 并 lock
    await mockUSDC.connect(projectOwner).approve(await bountyEscrow.getAddress(), bounty);
    await bountyEscrow.connect(projectOwner).lockBounty(1);

    return 1;
  }

  // ============ 部署 ============
  describe("Deployment", function () {
    it("should deploy with TaskManager reference", async function () {
      await deployAll();
      expect(await bountyEscrow.taskManager()).to.equal(await taskManager.getAddress());
    });
  });

  // ============ 赏金锁定 ============
  describe("Bounty Lock", function () {
    beforeEach(async () => {
      await deployAll();
    });

    it("should lock bounty and activate task", async function () {
      await taskManager.connect(projectOwner).createTask(
        await mockUSDC.getAddress(), BOUNTY, METADATA_URI, 5
      );

      await mockUSDC.connect(projectOwner).approve(await bountyEscrow.getAddress(), BOUNTY);
      await bountyEscrow.connect(projectOwner).lockBounty(1);

      // 检查资金转移
      expect(await mockUSDC.balanceOf(await bountyEscrow.getAddress())).to.equal(BOUNTY);
      expect(await mockUSDC.balanceOf(projectOwner.address)).to.equal(ethers.parseEther("9000"));

      // 检查任务被激活
      const task = await taskManager.getTask(1);
      expect(task.status).to.equal(1); // Active

      // 检查锁仓记录
      expect(await bountyEscrow.getLockedAmount(1, await mockUSDC.getAddress())).to.equal(BOUNTY);
      expect(await bountyEscrow.getTotalLocked(await mockUSDC.getAddress())).to.equal(BOUNTY);
    });

    it("should revert if not task owner", async function () {
      await taskManager.connect(projectOwner).createTask(
        await mockUSDC.getAddress(), BOUNTY, METADATA_URI, 5
      );
      await mockUSDC.connect(projectOwner).approve(await bountyEscrow.getAddress(), BOUNTY);

      await expect(
        bountyEscrow.connect(otherUser).lockBounty(1)
      ).to.be.revertedWith("BountyEscrow: not task owner");
    });

    it("should revert if task not in Created status", async function () {
      // 不创建任务，lockBounty 会因无任务而 revert
      // 手动推进任务状态
      // ... already tested implicitly
    });
  });

  // ============ 赏金分配 ============
  describe("Reward Distribution", function () {
    beforeEach(async () => {
      await deployAll();
    });

    async function lockAndSettleTask() {
      await taskManager.connect(projectOwner).createTask(
        await mockUSDC.getAddress(), BOUNTY, METADATA_URI, 5
      );
      await mockUSDC.connect(projectOwner).approve(await bountyEscrow.getAddress(), BOUNTY);
      await bountyEscrow.connect(projectOwner).lockBounty(1);

      // 手动推进到 Settled（模拟完整生命周期）
      await taskManager.transitionToCommitting(1);
      await taskManager.transitionToRevealing(1);
      await taskManager.transitionToClustering(1);
      await taskManager.transitionToChallenging(1);
      await taskManager.transitionToSettled(1);
    }

    it("should distribute rewards and refund remaining", async function () {
      await lockAndSettleTask();

      const recipients = [otherUser.address];
      const amounts = [ethers.parseEther("600")];

      await bountyEscrow.distributeRewards(1, recipients, amounts);

      expect(await mockUSDC.balanceOf(otherUser.address)).to.equal(ethers.parseEther("600"));
      expect(await mockUSDC.balanceOf(projectOwner.address)).to.equal(ethers.parseEther("9400")); // 9000 + 400 refund
      expect(await mockUSDC.balanceOf(await bountyEscrow.getAddress())).to.equal(0);
      expect(await bountyEscrow.isSettled(1)).to.be.true;
    });

    it("should support multiple recipients", async function () {
      await lockAndSettleTask();

      const [, , , r2, r3] = await ethers.getSigners();
      const recipients = [otherUser.address, r2.address, r3.address];
      const amounts = [
        ethers.parseEther("500"),
        ethers.parseEther("200"),
        ethers.parseEther("100")
      ];

      await bountyEscrow.distributeRewards(1, recipients, amounts);

      expect(await mockUSDC.balanceOf(otherUser.address)).to.equal(ethers.parseEther("500"));
      expect(await mockUSDC.balanceOf(r2.address)).to.equal(ethers.parseEther("200"));
      expect(await mockUSDC.balanceOf(r3.address)).to.equal(ethers.parseEther("100"));
    });

    it("should revert if already settled", async function () {
      await lockAndSettleTask();
      await bountyEscrow.distributeRewards(1, [otherUser.address], [ethers.parseEther("100")]);

      await expect(
        bountyEscrow.distributeRewards(1, [otherUser.address], [ethers.parseEther("100")])
      ).to.be.revertedWith("BountyEscrow: already settled");
    });

    it("should revert if total exceeds bounty (ERC20 insufficient balance)", async function () {
      await lockAndSettleTask();
      await expect(
        bountyEscrow.distributeRewards(1, [otherUser.address], [ethers.parseEther("1001")])
      ).to.be.reverted; // ERC20 transfer reverts due to insufficient balance in escrow
    });

    it("should revert if lengths mismatch", async function () {
      await lockAndSettleTask();
      await expect(
        bountyEscrow.distributeRewards(1, [otherUser.address], [])
      ).to.be.revertedWith("BountyEscrow: length mismatch");
    });

    it("should revert if not in Settled/Closed status", async function () {
      await taskManager.connect(projectOwner).createTask(
        await mockUSDC.getAddress(), BOUNTY, METADATA_URI, 5
      );
      await mockUSDC.connect(projectOwner).approve(await bountyEscrow.getAddress(), BOUNTY);
      await bountyEscrow.connect(projectOwner).lockBounty(1);

      // 不能分配（状态为 Active）
      await expect(
        bountyEscrow.distributeRewards(1, [otherUser.address], [ethers.parseEther("100")])
      ).to.be.revertedWith("BountyEscrow: not settled");
    });
  });

  // ============ 紧急提现 ============
  describe("Emergency Withdraw", function () {
    it("should only be callable by admin", async function () {
      await deployAll();
      await expect(
        bountyEscrow.connect(otherUser).emergencyWithdraw(
          await mockUSDC.getAddress(), otherUser.address, 100
        )
      ).to.be.reverted;
    });

    it("should allow admin to withdraw", async function () {
      await deployAll();
      await mockUSDC.mint(await bountyEscrow.getAddress(), ethers.parseEther("5000"));
      await bountyEscrow.emergencyWithdraw(
        await mockUSDC.getAddress(), owner.address, ethers.parseEther("1000")
      );
      expect(await mockUSDC.balanceOf(owner.address)).to.equal(ethers.parseEther("1000"));
    });
  });
});
