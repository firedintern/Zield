/**
 * Zield Keeper - Execution Module (HIGHLY GUARDED)
 *
 * Usage:
 *   npm run execute              # Will run simulation + preflight, then ask for confirmation
 *   npm run execute -- --yes     # Skip confirmation (for automation / cron)
 *
 * This is the ONLY place that should ever send a rebalance transaction.
 */

import { createWalletClient, http, parseAbi, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import { KEEPER_CONFIG } from './config.js';
import { readVaultState, vaultStateToSnapshots } from './vault-reader.js';
import { runOptimizer } from './optimize.js';
import { shouldExecuteRebalance } from './simulation.js';
import { alert } from './alert.js';
import 'dotenv/config';

const VAULT_ABI = parseAbi([
  'function rebalance() external',
]);

async function main() {
  const args = process.argv.slice(2);
  const forceYes = args.includes('--yes') || args.includes('-y');

  console.log('\n=== ZIELD KEEPER — EXECUTION MODE ===\n');
  console.log('⚠️  WARNING: This can move real capital between strategies.');
  console.log('⚠️  All safety checks will run first. Execution is disabled by default in early versions.\n');

  const privateKey = process.env.KEEPER_PRIVATE_KEY as `0x${string}` | undefined;
  const vaultAddress = process.env.VAULT_ADDRESS as Address | undefined;

  if (!privateKey) {
    console.error('❌ KEEPER_PRIVATE_KEY is required in .env to execute rebalances.');
    process.exit(1);
  }
  if (!vaultAddress) {
    console.error('❌ VAULT_ADDRESS is required in .env.');
    process.exit(1);
  }

  // === 1. Read live state ===
  console.log(`Reading live state from ${vaultAddress}...`);
  const onChainState = await readVaultState(vaultAddress, KEEPER_CONFIG.SIMULATION_RPC);
  const { strategies, portfolio } = vaultStateToSnapshots(onChainState);

  // === 2. Run optimizer ===
  const decision = runOptimizer(strategies as any, portfolio as any, 22);

  console.log('\nOptimizer decision:');
  console.log(`  Expected blended APY: ${decision.expectedPortfolioAPYBps} bps`);
  console.log(`  Portfolio risk: ${decision.portfolioRiskScore}`);

  // === 3. Full safety preflight (this is the most important part) ===
  console.log('\n--- Running Full Safety Preflight ---');
  const { proceed, report } = await shouldExecuteRebalance(
    vaultAddress,
    decision,
    strategies as any
  );

  if (!proceed) {
    console.log('\n❌ EXECUTION BLOCKED by safety gates.');
    report.reasons.forEach(r => console.log('   -', r));

    await alert.warning('Rebalance Blocked', 'Preflight failed. Execution prevented.', {
      vault: vaultAddress,
      reasons: report.reasons.join('; '),
    });

    process.exit(1);
  }

  console.log('\n✅ All safety gates PASSED.');
  console.log(`   Expected 7-day profit: $${report.expected7DayProfitUsd}`);
  console.log(`   Gas cost: $${report.estimatedGasUsd} (${report.netBenefitRatio}x benefit)`);

  await alert.success('Rebalance Preflight Passed', 'All safety gates cleared. Preparing to execute.', {
    vault: vaultAddress,
    expectedProfit: report.expected7DayProfitUsd,
    gasCost: report.estimatedGasUsd,
    netBenefit: report.netBenefitRatio,
  });

  // === 4. Confirmation gate ===
  if (!forceYes) {
    console.log('\nType "YES" (all caps) to proceed with the actual rebalance transaction:');
    const confirmation = await new Promise<string>(resolve => {
      process.stdin.resume();
      process.stdin.once('data', data => {
        resolve(data.toString().trim());
      });
    });

    if (confirmation !== 'YES') {
      console.log('❌ Execution cancelled by user.');
      process.exit(0);
    }
  } else {
    console.log('\n⚠️  --yes flag used — skipping interactive confirmation.');
  }

  // === 5. Actual execution (the dangerous part) ===
  console.log('\n🚀 Preparing to send rebalance transaction...');

  const account = privateKeyToAccount(privateKey);
  const chain = vaultAddress.toLowerCase().startsWith('0x') && process.env.BASE_SEPOLIA_RPC 
    ? baseSepolia 
    : base;

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(KEEPER_CONFIG.EXECUTION_RPC),
  });

  try {
    const hash = await walletClient.writeContract({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: 'rebalance',
    });

    console.log(`\n✅ Rebalance transaction sent!`);
    console.log(`   Tx hash: ${hash}`);
    console.log(`   Explorer: https://${chain.id === 84532 ? 'sepolia.' : ''}basescan.org/tx/${hash}`);
    console.log('\nMonitor the transaction. The keeper will not send another rebalance until cooldown passes.');

    await alert.success('Rebalance Executed', 'Transaction sent successfully.', {
      vault: vaultAddress,
      txHash: hash,
      expectedProfit: report.expected7DayProfitUsd,
    });

  } catch (err: any) {
    console.error('\n❌ Transaction failed:');
    console.error(err?.shortMessage || err?.message || err);

    await alert.error('Rebalance Execution Failed', err?.message || 'Unknown error', {
      vault: vaultAddress,
      error: String(err),
    });

    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error during execution:', err);
  process.exit(1);
});
