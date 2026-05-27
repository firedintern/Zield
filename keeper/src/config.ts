/**
 * Zield Keeper Configuration (MVP)
 * All tunable safety and behavior parameters live here.
 */

export const KEEPER_CONFIG = {
  // === Risk & Allocation Hard Gates ===
  MAX_ALLOCATION_PER_STRATEGY_BPS: 4000,   // 40%
  MAX_HIGH_RISK_BUCKET_BPS: 2000,          // 20% total in strategies with composite risk > 55

  // === Safety Thresholds for Execution ===
  MIN_NET_BENEFIT_MULTIPLIER: 4,           // Expected 7-day yield benefit must be at least 4x estimated gas cost
  MIN_PROFIT_USD: 25,                      // Absolute minimum expected profit to bother rebalancing
  MAX_GAS_COST_USD: 80,                    // Never rebalance if gas alone would cost more than this

  // === Simulation & Execution ===
  SIMULATION_RPC: process.env.BASE_MAINNET_RPC || 'https://mainnet.base.org',
  EXECUTION_RPC: process.env.BASE_MAINNET_RPC || 'https://mainnet.base.org',

  // === Keeper Behavior ===
  REBALANCE_COOLDOWN_HOURS: 6,             // Minimum time between rebalances
  DRIFT_THRESHOLD_BPS: 300,                // Only rebalance if any strategy is >3% away from target

  // === Logging / Alerting (future) ===
  ALERT_WEBHOOK_URL: process.env.KEEPER_ALERT_WEBHOOK || '',
} as const;

export type KeeperConfig = typeof KEEPER_CONFIG;
