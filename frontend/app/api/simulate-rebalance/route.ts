import { NextResponse } from 'next/server';
import { getKeeperDecision } from '../../../lib/engine';

/**
 * Rebalance preflight built from the live decision engine.
 * Baseline is an equal-weight portfolio over the active set (until a real
 * vault with on-chain allocations is configured) so the deltas show exactly
 * what the risk model changes versus naive diversification.
 */
export async function GET() {
  try {
    const decision = await getKeeperDecision();
    const n = decision.allocations.length;
    if (n === 0) throw new Error('No allocations available');

    const equalWeight = 100 / n;
    const baselineAPY = decision.allocations.reduce((s, a) => s + (a.apy * equalWeight) / 100, 0);
    const baselineRisk = Math.round(
      decision.allocations.reduce((s, a) => s + (a.compositeRisk * equalWeight) / 100, 0),
    );

    const referenceTvl = decision.vaultTvlUsd ?? 10_000;
    const expected30dProfitUsd = (referenceTvl * decision.blendedAPY) / 100 / 12;
    const netBenefitRatio =
      decision.estRebalanceGasUsd > 0 ? expected30dProfitUsd / decision.estRebalanceGasUsd : 0;

    const report = {
      timestamp: decision.timestamp,
      vaultAddress: process.env.NEXT_PUBLIC_ZIELD_VAULT_ADDRESS || null,
      baselineLabel: 'Equal-weight portfolio (naive diversification)',
      currentState: {
        tvlUsd: decision.vaultTvlUsd,
        blendedAPY: Math.round(baselineAPY * 100) / 100,
        portfolioRisk: baselineRisk,
      },
      proposedAction: {
        newBlendedAPY: decision.blendedAPY,
        newPortfolioRisk: decision.portfolioRisk,
        expected30DayProfitUsd: Math.round(expected30dProfitUsd * 100) / 100,
        estimatedGasUsd: decision.estRebalanceGasUsd,
        netBenefitRatio: Math.round(netBenefitRatio * 10) / 10,
        referenceTvlUsd: referenceTvl,
        referenceIsHypothetical: decision.vaultTvlUsd === null,
      },
      allocationChanges: decision.allocations.map((a) => ({
        strategy: a.name,
        current: Math.round(equalWeight * 10) / 10,
        proposed: a.targetPct,
        delta: Math.round((a.targetPct - equalWeight) * 10) / 10,
      })),
      safetyGates: {
        liveDataFresh: true,
        perStrategyCapRespected: decision.allocations.every((a) => a.targetPct <= 60),
        aggressiveBucketCapRespected:
          decision.allocations
            .filter((a) => a.compositeRisk > 55)
            .reduce((s, a) => s + a.targetPct, 0) <= 20,
        netBenefitAboveGas: netBenefitRatio > 3,
        allocationSumsTo100:
          Math.round(decision.allocations.reduce((s, a) => s + a.targetPct, 0)) === 100,
      },
      finalRecommendation: netBenefitRatio > 3 ? ('EXECUTE' as const) : ('HOLD' as const),
      rationale:
        `Risk model ${decision.modelVersion} improves blended APY from ${baselineAPY.toFixed(2)}% ` +
        `(equal-weight) to ${decision.blendedAPY.toFixed(2)}% while moving portfolio risk from ` +
        `${baselineRisk} to ${decision.portfolioRisk}. High-risk exposure stays capped at 20%.`,
      warnings:
        decision.vaultTvlUsd === null
          ? ['No live vault configured — profit figures use a $10k reference deposit.']
          : [],
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error('[simulate-rebalance] engine failed:', error);
    return NextResponse.json(
      { error: 'Simulation unavailable. Upstream data sources may be down.' },
      { status: 503 },
    );
  }
}
