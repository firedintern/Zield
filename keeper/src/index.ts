// Zield Keeper (MVP) - Main entry
// This will evolve into the production 24/7 risk engine + executor.

import { runOptimizer } from './optimize.js';
import { INITIAL_RISK_VECTORS } from './risk.js';
import { shouldExecuteRebalance } from './simulation.js';
import { fetchAaveUsdcSupplyApyBps } from './data/aave.js';
import { fetchTopBaseStableYields } from './data/defillama.js';
import { KEEPER_CONFIG } from './config.js';
import { readVaultState, vaultStateToSnapshots } from './vault-reader.js';
import type { StrategySnapshot, PortfolioSnapshot } from './types.js';
import 'dotenv/config';

async function main() {
  console.log('=== Zield Keeper MVP ===\n');

  const vaultAddress = process.env.VAULT_ADDRESS as `0x${string}` | undefined;

  let strategies: StrategySnapshot[];
  let portfolio: PortfolioSnapshot;

  if (vaultAddress) {
    // === REAL ON-CHAIN MODE ===
    console.log(`[Vault] Reading live state from ${vaultAddress}...`);
    const onChainState = await readVaultState(vaultAddress, process.env.BASE_MAINNET_RPC);
    const snapshots = vaultStateToSnapshots(onChainState);

    strategies = snapshots.strategies;
    portfolio = snapshots.portfolio;

    console.log(`[Vault] Live TVL: ${Number(onChainState.totalAssets) / 1e6} USDC`);
    console.log(`[Vault] Strategies found: ${strategies.length}`);
  } else {
    // === DEMO / DEVELOPMENT MODE (with real external data) ===
    console.log('[Mode] Running in demo mode (no VAULT_ADDRESS set)\n');

    // Real data ingestion
    let aaveApyBps = 485;
    try {
      aaveApyBps = await fetchAaveUsdcSupplyApyBps(process.env.BASE_MAINNET_RPC);
      console.log(`[Data] Live Aave USDC supply APY: ${aaveApyBps} bps`);
    } catch {
      console.warn('[Data] Using fallback Aave rate');
    }

    try {
      const extraYields = await fetchTopBaseStableYields(5);
      if (extraYields.length > 0) {
        console.log('[Data] Top additional Base stable yields from DefiLlama:');
        extraYields.slice(0, 3).forEach(y => 
          console.log(`   - ${y.name}: ${(y.apyBps / 100).toFixed(1)}% APY`)
        );
      }
    } catch {}

    strategies = [
      {
        address: '0xAaveV3USDCStrategyPlaceholder',
        name: 'Aave v3 USDC (Base)',
        asset: 'USDC',
        currentAPYBps: aaveApyBps,
        risk: INITIAL_RISK_VECTORS.aave,
        tvl: 2_400_000_000_000n,
        maxAllocationBps: 4000,
      },
      {
        address: '0xConservativeMockPlaceholder',
        name: 'Conservative Yield',
        asset: 'USDC',
        currentAPYBps: 920,
        risk: INITIAL_RISK_VECTORS.conservative,
        tvl: 1_100_000_000_000n,
        maxAllocationBps: 4000,
      },
      {
        address: '0xAggressiveMockPlaceholder',
        name: 'High Yield (Risk-capped)',
        asset: 'USDC',
        currentAPYBps: 2150,
        risk: INITIAL_RISK_VECTORS.aggressive,
        tvl: 380_000_000_000n,
        maxAllocationBps: 2000,
      },
    ];

    portfolio = {
      vaultAddress: '0xDemoVaultAddress0000000000000000000000',
      totalAssets: 4_200_000_000_000n,
      currentAllocations: {},
    };
  }

  // 1. Run optimizer
  const decision = runOptimizer(strategies, portfolio, 22);
  console.log('Optimizer decision:');
  console.log(`  Expected blended APY: ${decision.expectedPortfolioAPYBps} bps`);
  console.log(`  Portfolio risk score: ${decision.portfolioRiskScore}`);
  console.log(`  Decisions:`);
  decision.decisions.forEach(d => {
    console.log(`    - ${d.strategyAddress.slice(0,10)}... → ${d.targetBps / 100}% (risk ${d.riskScore})`);
  });

  // 2. Powerful safety preflight (the most important gate)
  console.log('\n=== Running Full Preflight ===');
  const { proceed, report } = await shouldExecuteRebalance(
    portfolio.vaultAddress as `0x${string}`,
    decision,
    strategies.map(s => ({ address: s.address, currentAssets: s.tvl, targetBps: 0 })) // will be improved
  );

  if (proceed) {
    console.log('\n🚀 All safety gates passed. Ready for execution.');
    console.log('   (In real keeper: would now sign and broadcast rebalance tx)');
  } else {
    console.log('\n🛑 Execution blocked by safety gates.');
  }

  console.log('\nKeeper loop complete (MVP).');
}

main().catch(console.error);
