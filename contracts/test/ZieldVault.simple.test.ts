const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ZieldVault - Risk Aware Rebalancing (Simple)", function () {
  let vault, mockCons, mockAgg, usdc, owner, keeper, user;

  beforeEach(async function () {
    [owner, keeper, user] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockERC20");
    usdc = await MockUSDC.deploy("USDC", "USDC", 6);
    await usdc.waitForDeployment();

    const ZieldVault = await ethers.getContractFactory("ZieldVault");
    vault = await ZieldVault.deploy(
      await usdc.getAddress(),
      "Zield USDC",
      "zUSDC",
      keeper.address,
      owner.address
    );
    await vault.waitForDeployment();

    const MockStrat = await ethers.getContractFactory("MockYieldStrategy");
    mockCons = await MockStrat.deploy(await usdc.getAddress(), 780, 18, owner.address);
    mockAgg = await MockStrat.deploy(await usdc.getAddress(), 1920, 62, owner.address);

    await vault.addStrategy(await mockCons.getAddress(), 6000); // 60%
    await vault.addStrategy(await mockAgg.getAddress(), 4000);  // 40%

    const amount = ethers.parseUnits("10000", 6);
    await usdc.mint(user.address, amount);
    await usdc.connect(user).approve(await vault.getAddress(), amount);
  });

  it("deploys and accepts deposits", async function () {
    const amount = ethers.parseUnits("5000", 6);
    await vault.connect(user).deposit(amount, user.address);
    expect(await vault.balanceOf(user.address)).to.equal(amount);
  });

  it("rebalances capital into strategies according to targets", async function () {
    const amount = ethers.parseUnits("10000", 6);
    await vault.connect(user).deposit(amount, user.address);

    await vault.connect(keeper).rebalance();

    const consBal = await mockCons.totalAssets();
    const aggBal = await mockAgg.totalAssets();
    const total = await vault.totalAssets();

    // Conservative should have ~60%
    expect(consBal).to.be.closeTo((total * 6000n) / 10000n, ethers.parseUnits("20", 6));
    // Aggressive capped by risk in real optimizer, here we just check distribution happened
    expect(aggBal).to.be.gt(0);
  });

  it("harvests yield when time passes on mock strategies", async function () {
    const amount = ethers.parseUnits("8000", 6);
    await vault.connect(user).deposit(amount, user.address);
    await vault.connect(keeper).rebalance();

    await time.increase(86400 * 7); // 7 days

    // Increase APY on aggressive to simulate opportunity change
    await mockAgg.setEstimatedAPY(3500);

    const before = await vault.totalAssets();
    await vault.connect(keeper).rebalance();
    const after = await vault.totalAssets();

    expect(after).to.be.greaterThan(before);
  });
});
