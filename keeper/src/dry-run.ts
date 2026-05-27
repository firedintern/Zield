/**
 * Zield Keeper - Dry Run Mode
 * 
 * Run with: npm run dry-run
 * 
 * This executes the full optimizer + preflight simulation using real on-chain data
 * (if VAULT_ADDRESS is set) but does NOT send any transactions.
 * Perfect for seeing what the keeper would do right now.
 */
import { readVaultState, vaultStateToSnapshots } from './vault-reader.js';
import { generateSimulationReport } from './generate-report.js';
import 'dotenv/config';

async function main() {
  console.log('=== ZIELD KEEPER — DRY RUN (No transactions will be sent) ===\n');

  const vaultAddress = process.env.VAULT_ADDRESS || '0xDemoVault';

  const report = await generateSimulationReport(vaultAddress as any);

  console.log('Simulation Report:');
  console.log(`  Current Blended APY: ${report.currentState.blendedAPY}%`);
  console.log(`  Proposed Blended APY: ${report.proposedAction.newBlendedAPY}%`);
  console.log(`  Expected 7d Profit: $${report.proposedAction.expected7DayProfitUsd}`);
  console.log(`  Net Benefit: ${report.proposedAction.netBenefitRatio}x`);
  console.log(`  Verdict: ${report.finalRecommendation}`);

  if (report.finalRecommendation === 'EXECUTE') {
    console.log('\n✅ DRY RUN PASSED — This rebalance looks safe and profitable.');
  } else {
    console.log('\n❌ DRY RUN BLOCKED.');
  }

  console.log('\n' + report.rationale);
  console.log('\nDry run complete. No transactions were sent.');
}

main().catch(console.error);
