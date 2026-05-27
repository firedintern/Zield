import { RiskVector, StrategySnapshot } from './types.js';

/**
 * Zield Risk Model (MVP v0.1)
 *
 * Transparent, versioned, deliberately simple.
 * Each axis 0-100. Composite risk is a weighted average with a slight convexity penalty
 * on very high scores (to avoid "one terrible dimension hidden by good others").
 */
export function computeCompositeRisk(risk: RiskVector): number {
  const weights = {
    smartContract: 0.35,
    market: 0.25,
    liquidity: 0.25,
    operational: 0.15,
  };

  const weighted =
    risk.smartContract * weights.smartContract +
    risk.market * weights.market +
    risk.liquidity * weights.liquidity +
    risk.operational * weights.operational;

  // Convexity penalty: if any single axis is > 80, add extra risk
  const maxAxis = Math.max(risk.smartContract, risk.market, risk.liquidity, risk.operational);
  const penalty = maxAxis > 80 ? (maxAxis - 80) * 0.4 : 0;

  return Math.min(100, Math.round(weighted + penalty));
}

/**
 * Risk-adjusted score used by the optimizer.
 * Higher is better.
 *
 * Formula (MVP): (net_apy_bps ^ 1.1) / (risk ^ 1.15)
 * The exponents create a mild preference for yield while still heavily punishing high risk.
 */
export function riskAdjustedScore(apyBps: number, compositeRisk: number): number {
  if (apyBps <= 0) return 0;
  const risk = Math.max(compositeRisk, 1);
  return Math.pow(apyBps, 1.1) / Math.pow(risk, 1.15);
}

/**
 * Example risk vectors for the initial three strategies.
 * In production these come from a combination of:
 *   - On-chain data (TVL, utilization, age)
 *   - Off-chain research (audits, team, incidents)
 *   - Keeper/operator judgment (with change log)
 */
export const INITIAL_RISK_VECTORS: Record<string, RiskVector> = {
  // Aave v3 USDC on Base — very battle tested
  aave: {
    smartContract: 12,
    market: 8,
    liquidity: 5,
    operational: 10,
  },
  // Conservative mock (think "high quality bluechip lending or stable LP")
  conservative: {
    smartContract: 22,
    market: 15,
    liquidity: 18,
    operational: 14,
  },
  // Aggressive mock (volatile LP, newer protocol, higher IL, etc.)
  aggressive: {
    smartContract: 55,
    market: 72,
    liquidity: 48,
    operational: 35,
  },
};
