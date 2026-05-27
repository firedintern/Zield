// Core types for the Zield Risk Engine + Optimizer (MVP)

export type RiskAxis = 'smartContract' | 'market' | 'liquidity' | 'operational';

export interface RiskVector {
  smartContract: number;   // 0-100
  market: number;
  liquidity: number;
  operational: number;
}

export interface StrategySnapshot {
  address: string;
  name: string;
  asset: string;
  currentAPYBps: number;      // net of fees
  risk: RiskVector;
  tvl: bigint;                // in asset units (e.g. USDC * 1e6)
  maxAllocationBps: number;   // hard cap for this strategy
}

export interface PortfolioSnapshot {
  vaultAddress: string;
  totalAssets: bigint;
  currentAllocations: Record<string, bigint>; // strategy address -> assets
}

export interface AllocationDecision {
  strategyAddress: string;
  targetBps: number;          // 0-10000
  expectedNetAPYBps: number;
  riskScore: number;          // composite 0-100
  rationale: string;
}

export interface OptimizerOutput {
  timestamp: number;
  vault: string;
  decisions: AllocationDecision[];
  expectedPortfolioAPYBps: number;
  portfolioRiskScore: number;
  estimatedGasCostUsd: number;
  netBenefitThresholdUsd: number;
  canExecute: boolean;
}
