import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log("Deploying Zield MVP contracts with account:", deployer.address);
  console.log("Network:", network.name, "Chain ID:", chainId);

  // === Network-specific addresses ===
  let USDC: string;
  let useRealAave = false;
  let AAVE_V3_POOL = "";
  let AAVE_V3_ATOKEN = "";

  if (chainId === 8453) {
    // Base Mainnet
    USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    useRealAave = true;
    AAVE_V3_POOL = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5";
    AAVE_V3_ATOKEN = "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB";
    console.log("Using Base Mainnet addresses (real Aave v3)");
  } else if (chainId === 84532) {
    // Base Sepolia
    USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Official Circle test USDC on Base Sepolia
    useRealAave = false; // Aave testnet pools are limited — we use mocks for full demo
    console.log("Using Base Sepolia addresses (mocks for reliable demo)");
  } else {
    // Local / other
    USDC = "0x0000000000000000000000000000000000000000"; // Will be replaced by mock in local tests
    console.log("Local network detected — you should deploy a MockERC20 first for testing");
  }

  const KEEPER = deployer.address; // For testnet, deployer acts as keeper

  // 1. Deploy ZieldVault
  const ZieldVault = await ethers.getContractFactory("ZieldVault");
  const vault = await ZieldVault.deploy(
    USDC,
    "Zield USDC Vault",
    "zUSDC",
    KEEPER,
    deployer.address
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("\n✓ ZieldVault deployed to:", vaultAddress);

  // 2. Deploy Aave strategy (only on mainnet) or a mock on testnet
  let aaveStratAddress = "0x0000000000000000000000000000000000000000";

  if (useRealAave) {
    const AaveV3Strategy = await ethers.getContractFactory("AaveV3Strategy");
    const aaveStrat = await AaveV3Strategy.deploy(
      USDC,
      AAVE_V3_POOL,
      AAVE_V3_ATOKEN,
      deployer.address
    );
    await aaveStrat.waitForDeployment();
    aaveStratAddress = await aaveStrat.getAddress();
    console.log("✓ AaveV3Strategy (real) deployed to:", aaveStratAddress);
  } else {
    // On Sepolia we deploy a third mock for clean demo
    const MockYieldStrategy = await ethers.getContractFactory("MockYieldStrategy");
    const mockAave = await MockYieldStrategy.deploy(USDC, 420, 15, deployer.address);
    await mockAave.waitForDeployment();
    aaveStratAddress = await mockAave.getAddress();
    console.log("✓ MockAaveStrategy (for Sepolia demo) deployed to:", aaveStratAddress);
  }

  // 3. Deploy two controllable Mock strategies (excellent for keeper testing)
  const MockYieldStrategy = await ethers.getContractFactory("MockYieldStrategy");

  const mockConservative = await MockYieldStrategy.deploy(USDC, 780, 18, deployer.address);
  await mockConservative.waitForDeployment();
  console.log("✓ MockConservative deployed to:", await mockConservative.getAddress());

  const mockAggressive = await MockYieldStrategy.deploy(USDC, 1850, 68, deployer.address);
  await mockAggressive.waitForDeployment();
  console.log("✓ MockAggressive deployed to:", await mockAggressive.getAddress());

  // 4. Wire everything into the vault with risk-aware initial allocation
  await vault.addStrategy(aaveStratAddress, 3000);     // 30%
  await vault.addStrategy(await mockConservative.getAddress(), 5000); // 50%
  await vault.addStrategy(await mockAggressive.getAddress(), 2000);   // 20%

  console.log("\n=== ZIELD MVP DEPLOYMENT COMPLETE ===");
  console.log("Network:", network.name);
  console.log("Vault:          ", vaultAddress);
  console.log("Strategy 1:     ", aaveStratAddress, useRealAave ? "(real Aave)" : "(mock Aave)");
  console.log("Strategy 2:     ", await mockConservative.getAddress(), "(Conservative)");
  console.log("Strategy 3:     ", await mockAggressive.getAddress(), "(Aggressive - high risk)");
  console.log("\nInitial allocation: 30% / 50% / 20% (risk-capped)");
  console.log("\nNEXT STEPS:");
  console.log("1. Fund the deployer with test USDC on this network");
  console.log("2. Set VAULT_ADDRESS in keeper/.env to the vault address above");
  console.log("3. Run the keeper and frontend to see live rebalancing");
  console.log("4. Use the frontend to deposit and watch the keeper rebalance");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
