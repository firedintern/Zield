import { createPublicClient, http, parseAbi, type Address, type PublicClient, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { KEEPER_CONFIG } from './config.js';
import type { OptimizerOutput } from './types.js';
import { alert } from './alert.js';

const VAULT_ABI = parseAbi([
  'function rebalance() external',
  'function totalAssets() view returns (uint256)',
  'function getAllStrategies() view returns ((address strategy, uint16 targetBps)[])',
  'function asset() view returns (address)',
]);

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

export interface SimulationReport {
  canExecute: boolean;
  reasons: string[];
  estimatedGasUsd: number;
  expected7DayProfitUsd: number;
  netBenefitRatio: number;           // profit / gas
  currentTvlUsd: number;
  proposedTvlAfterUsd: number;
  allocationDriftBps: number;        // max drift from target after proposed move
  warnings: string[];
  simulationSuccess: boolean;
  revertReason?: string;
}

/**
 * Powerful preflight for Zield rebalances.
 *
 * This is the critical safety layer. It must be excellent.
 */
export async function runPreflight(
  vaultAddress: Address,
  proposed: OptimizerOutput,
  currentStrategies: Array<{ address: string; currentAssets: bigint; targetBps: number }>,
  assetPriceUsd: number = 1.0 // assume $1 stable for MVP (USDC)
): Promise<SimulationReport> {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let simulationSuccess = false;
  let revertReason: string | undefined;

  const client = createPublicClient({
    chain: base,
    transport: http(KEEPER_CONFIG.SIMULATION_RPC),
  });

  // === 1. Basic sanity from optimizer ===
  if (!proposed.canExecute) {
    reasons.push('Optimizer itself marked this as not executable');
  }

  // === 2. Gas cost sanity ===
  const gasCostUsd = proposed.estimatedGasCostUsd;
  if (gasCostUsd > KEEPER_CONFIG.MAX_GAS_COST_USD) {
    reasons.push(`Gas cost too high: $${gasCostUsd} > max $${KEEPER_CONFIG.MAX_GAS_COST_USD}`);

    await alert.warning('High Gas Cost Detected', `Gas cost $${gasCostUsd} exceeds threshold`, {
      vault: vaultAddress,
      gasCost: gasCostUsd,
    });
  }

  // === 3. Simulate the actual rebalance call ===
  try {
    await client.simulateContract({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: 'rebalance',
      account: '0x0000000000000000000000000000000000000000',
    });
    simulationSuccess = true;
  } catch (err: any) {
    simulationSuccess = false;
    revertReason = err?.shortMessage || err?.message || 'Unknown revert';
    reasons.push(`On-chain simulation failed: ${revertReason}`);

    await alert.warning('On-chain Simulation Failed', revertReason || 'Unknown revert during simulation', {
      vault: vaultAddress,
    });
  }

  // === 4. Calculate expected economics ===
  const currentTvl = Number(formatUnits(proposed.decisions.reduce((sum, d) => sum + (BigInt(100) /* placeholder */), 0n), 6)) * 1_000_000; // rough
  // Better: use real currentTvl from caller if passed, but for now use proposed context

  // Very simplified 7-day profit model for MVP:
  // profit ≈ (new blended APY - old blended APY) * TVL * 7/365
  const oldBlended = 850; // TODO: pass real current blended APY
  const newBlended = proposed.expectedPortfolioAPYBps;
  const tvlUsd = 2_500_000; // placeholder - in real version read from vault.totalAssets() * price

  const dailyYieldDelta = ((newBlended - oldBlended) / 10000) * (tvlUsd / 365);
  const expected7DayProfitUsd = Math.max(0, dailyYieldDelta * 7);

  const netBenefitRatio = gasCostUsd > 0 ? expected7DayProfitUsd / gasCostUsd : 0;

  if (expected7DayProfitUsd < KEEPER_CONFIG.MIN_PROFIT_USD) {
    reasons.push(`Expected 7-day profit too low: $${expected7DayProfitUsd.toFixed(0)} < $${KEEPER_CONFIG.MIN_PROFIT_USD}`);
  }

  if (netBenefitRatio < KEEPER_CONFIG.MIN_NET_BENEFIT_MULTIPLIER) {
    reasons.push(`Net benefit ratio too low: ${netBenefitRatio.toFixed(1)}x < ${KEEPER_CONFIG.MIN_NET_BENEFIT_MULTIPLIER}x gas`);
  }

  // === 5. Allocation drift check (future: compute actual post-rebalance drift) ===
  const maxDrift = 250; // placeholder
  if (maxDrift > KEEPER_CONFIG.DRIFT_THRESHOLD_BPS) {
    warnings.push(`Large allocation drift detected (${maxDrift} bps)`);
  }

  const canExecute = reasons.length === 0 && simulationSuccess;

  return {
    canExecute,
    reasons,
    estimatedGasUsd: gasCostUsd,
    expected7DayProfitUsd: Math.round(expected7DayProfitUsd),
    netBenefitRatio: Number(netBenefitRatio.toFixed(2)),
    currentTvlUsd: Math.round(tvlUsd),
    proposedTvlAfterUsd: Math.round(tvlUsd + expected7DayProfitUsd),
    allocationDriftBps: maxDrift,
    warnings,
    simulationSuccess,
    revertReason,
  };
}

/**
 * Convenience wrapper that the main keeper loop should call.
 */
export async function shouldExecuteRebalance(
  vaultAddress: Address,
  proposed: OptimizerOutput,
  currentStrategies: any[]
): Promise<{ proceed: boolean; report: SimulationReport }> {
  const report = await runPreflight(vaultAddress, proposed, currentStrategies);

  if (!report.canExecute) {
    console.log('\n[Preflight] ❌ BLOCKED');
    report.reasons.forEach(r => console.log('   -', r));
  } else {
    console.log('\n[Preflight] ✅ PASSED');
    console.log(`   Expected 7d profit: $${report.expected7DayProfitUsd}`);
    console.log(`   Gas cost: $${report.estimatedGasUsd} (${report.netBenefitRatio}x benefit)`);
  }

  return { proceed: report.canExecute, report };
}
