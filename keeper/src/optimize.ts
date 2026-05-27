import { StrategySnapshot, PortfolioSnapshot, AllocationDecision, OptimizerOutput } from './types.js';
import { computeCompositeRisk, riskAdjustedScore } from './risk.js';

/**
 * Zield Optimizer (MVP)
 *
 * Takes current opportunities + portfolio state and outputs target allocations.
 * Constraints are hardcoded for v0.1 and will move to config + governance later.
 */
export function runOptimizer(
  strategies: StrategySnapshot[],
  portfolio: PortfolioSnapshot,
  currentGasCostUsd: number = 12
): OptimizerOutput {
  const now = Math.floor(Date.now() / 1000);

  // 1. Score every strategy
  const scored = strategies.map((s) => {
    const composite = computeCompositeRisk(s.risk);
    const score = riskAdjustedScore(s.currentAPYBps, composite);
    return { ...s, compositeRisk: composite, riskAdjustedScore: score };
  });

  // 2. Apply hard constraints (MVP)
  const MAX_PER_STRATEGY_BPS = 4000; // 40%
  const MAX_AGGRESSIVE_BUCKET_BPS = 2000; // 20% total in anything with risk > 55

  // Sort by risk-adjusted score descending
  scored.sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore);

  // 3. Greedy allocation respecting caps
  let remainingBps = 10000;
  let aggressiveBucketUsed = 0;

  const decisions: AllocationDecision[] = [];

  for (const s of scored) {
    const isAggressive = s.compositeRisk > 55;
    let target = Math.min(remainingBps, MAX_PER_STRATEGY_BPS);

    if (isAggressive) {
      const roomInAggressive = MAX_AGGRESSIVE_BUCKET_BPS - aggressiveBucketUsed;
      target = Math.min(target, roomInAggressive);
      aggressiveBucketUsed += target;
    }

    if (target < 100) target = 0; // avoid dust allocations in MVP

    remainingBps -= target;

    decisions.push({
      strategyAddress: s.address,
      targetBps: target,
      expectedNetAPYBps: s.currentAPYBps,
      riskScore: s.compositeRisk,
      rationale: `${s.name} — RA score ${s.riskAdjustedScore.toFixed(1)} (APY ${s.currentAPYBps}bps, risk ${s.compositeRisk})`,
    });
  }

  // 4. Fill any remaining bps to the highest scoring non-aggressive if possible
  if (remainingBps > 0) {
    const topNonAggressive = decisions.find(d => {
      const strat = scored.find(s => s.address === d.strategyAddress);
      return strat && strat.compositeRisk <= 55;
    });
    if (topNonAggressive) {
      topNonAggressive.targetBps += remainingBps;
      remainingBps = 0;
    }
  }

  // 5. Compute simple portfolio metrics
  const totalAPY = decisions.reduce((sum, d) => sum + (d.expectedNetAPYBps * d.targetBps) / 10000, 0);
  const weightedRisk = decisions.reduce((sum, d) => sum + (d.riskScore * d.targetBps) / 10000, 0);

  const netBenefitThreshold = currentGasCostUsd * 3; // must create at least 3x gas cost in expected yield over N days (very rough)

  const output: OptimizerOutput = {
    timestamp: now,
    vault: portfolio.vaultAddress,
    decisions,
    expectedPortfolioAPYBps: Math.round(totalAPY),
    portfolioRiskScore: Math.round(weightedRisk),
    estimatedGasCostUsd: currentGasCostUsd,
    netBenefitThresholdUsd: netBenefitThreshold,
    canExecute: true, // simulation layer will flip this to false if needed
  };

  return output;
}
