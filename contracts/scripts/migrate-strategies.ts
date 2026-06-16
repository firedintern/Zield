/**
 * migrate-strategies.ts
 *
 * Replaces the 3 original MockYieldStrategy instances on Base Sepolia with
 * fresh ones that carry realistic APY values mirroring live Base mainnet
 * Aave v3 + money-market rates (as of June 2026).
 *
 * Strategy map after migration:
 *   Slot 1  — Aave USDC Simulated   420 bps APY  risk 15  (30%)
 *   Slot 2  — Conservative USDC     620 bps APY  risk 18  (50%)
 *   Slot 3  — High Yield USDC       820 bps APY  risk 35  (20%)
 *
 * Run:
 *   npx hardhat run scripts/migrate-strategies.ts --network baseSepolia
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const VAULT_ADDRESS = process.env.VAULT_ADDRESS || "";
const VAULT_STATE_ROUTE = path.join(
  __dirname, "../../frontend/app/api/vault-state/route.ts"
);

async function main() {
  if (!VAULT_ADDRESS) {
    throw new Error(
      "Set VAULT_ADDRESS env var to the deployed ZieldVault address.\n" +
      "Example: VAULT_ADDRESS=0x... npx hardhat run scripts/migrate-strategies.ts --network baseSepolia"
    );
  }

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("Migrating strategies on", network.name, "chain", network.chainId);
  console.log("Deployer:", deployer.address);
  console.log("Vault:   ", VAULT_ADDRESS);

  const vault = await ethers.getContractAt("ZieldVault", VAULT_ADDRESS);
  const usdc = await vault.asset();
  console.log("Asset:   ", usdc);

  // ── 1. Read current strategies ──────────────────────────────────────
  const oldStrategies: string[] = [];
  for (let i = 0; i < 10; i++) {
    try {
      const addr: string = await vault.strategies(i);
      oldStrategies.push(addr);
    } catch { break; }
  }
  console.log("\nCurrent strategies:", oldStrategies);

  // ── 2. Deploy replacement MockYieldStrategy instances ───────────────
  const MockYieldStrategy = await ethers.getContractFactory("MockYieldStrategy");

  // Slot 1: Aave-like — conservative, battle-tested, low risk
  const stratAave = await MockYieldStrategy.deploy(usdc, 420, 15, deployer.address);
  await stratAave.waitForDeployment();
  const addrAave = await stratAave.getAddress();
  console.log("\n✓ Strategy 1 (Aave Simulated)  deployed to:", addrAave);

  // Slot 2: Conservative money-market — slightly higher yield, still low risk
  const stratConservative = await MockYieldStrategy.deploy(usdc, 620, 18, deployer.address);
  await stratConservative.waitForDeployment();
  const addrConservative = await stratConservative.getAddress();
  console.log("✓ Strategy 2 (Conservative)    deployed to:", addrConservative);

  // Slot 3: Higher yield with moderate risk — reflects moonwell-style rates
  const stratHighYield = await MockYieldStrategy.deploy(usdc, 820, 35, deployer.address);
  await stratHighYield.waitForDeployment();
  const addrHighYield = await stratHighYield.getAddress();
  console.log("✓ Strategy 3 (High Yield)      deployed to:", addrHighYield);

  // ── 3. Remove old strategies (triggers emergencyWithdraw inside vault) ──
  for (const old of oldStrategies) {
    console.log("\nRemoving old strategy:", old);
    const tx = await vault.removeStrategy(old);
    await tx.wait();
    console.log("  Removed.");
  }

  // ── 4. Add new strategies at the same 30/50/20 allocation ───────────
  console.log("\nAdding new strategies...");
  await (await vault.addStrategy(addrAave, 3000)).wait();
  await (await vault.addStrategy(addrConservative, 5000)).wait();
  await (await vault.addStrategy(addrHighYield, 2000)).wait();
  console.log("✓ All 3 strategies added.");

  // ── 5. Trigger rebalance to push funds in ───────────────────────────
  console.log("\nTriggering rebalance...");
  const rbTx = await vault.rebalance();
  const rbReceipt = await rbTx.wait();
  console.log("✓ Rebalanced. TX:", rbReceipt?.hash);

  // ── 6. Patch vault-state/route.ts STRATEGY_NAMES ────────────────────
  if (fs.existsSync(VAULT_STATE_ROUTE)) {
    let src = fs.readFileSync(VAULT_STATE_ROUTE, "utf8");

    const newRegistry = `const STRATEGY_NAMES: Record<string, { name: string; protocol: string }> = {
  '${addrAave.toLowerCase()}': { name: 'Aave USDC (Simulated)', protocol: 'aave-v3' },
  '${addrConservative.toLowerCase()}': { name: 'Conservative USDC', protocol: 'compound-v3' },
  '${addrHighYield.toLowerCase()}': { name: 'High Yield USDC', protocol: 'moonwell' },
};`;

    src = src.replace(
      /const STRATEGY_NAMES: Record<string, \{ name: string; protocol: string \}> = \{[\s\S]*?\};/,
      newRegistry
    );

    fs.writeFileSync(VAULT_STATE_ROUTE, src, "utf8");
    console.log("\n✓ Updated STRATEGY_NAMES in vault-state/route.ts");
  } else {
    console.log("\n⚠ vault-state route not found at:", VAULT_STATE_ROUTE);
    console.log("  Manually update STRATEGY_NAMES with:");
    console.log(`    '${addrAave.toLowerCase()}': { name: 'Aave USDC (Simulated)', protocol: 'aave-v3' },`);
    console.log(`    '${addrConservative.toLowerCase()}': { name: 'Conservative USDC', protocol: 'compound-v3' },`);
    console.log(`    '${addrHighYield.toLowerCase()}': { name: 'High Yield USDC', protocol: 'moonwell' },`);
  }

  console.log("\n=== MIGRATION COMPLETE ===");
  console.log("New strategy addresses:");
  console.log("  Aave Simulated (30%):  ", addrAave);
  console.log("  Conservative (50%):    ", addrConservative);
  console.log("  High Yield (20%):      ", addrHighYield);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
