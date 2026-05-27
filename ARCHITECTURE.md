# Zield MVP Architecture

This document describes the **actual system** being built for the first release. It is intentionally narrower than the vision document.

## High-Level Data Flow (MVP)

```
User
  │ deposit USDC
  ▼
ZieldVault (ERC-4626 on Base)
  │ mints zUSDC shares
  │
  ├──> idle USDC in vault
  │
  └──> allocated to Strategies (via keeper rebalance)
         ├── AaveV3Strategy (real)
         ├── MockConservative (testable high-quality yield)
         └── MockAggressive (testable high-APY, high-risk)

Off-chain (keeper service, runs periodically or on triggers)
  1. Risk Engine
       - Pulls current APYs (DefiLlama + protocol APIs + on-chain reads via viem)
       - Assigns/refresh risk scores (4 axes)
       - Produces per-strategy (expected_net_apy, risk_vector)
  2. Optimizer
       - Takes current portfolio + new opportunities
       - Applies constraints (max per strategy, max per risk tier, min TVL, gas threshold)
       - Outputs new target allocation (basis points)
  3. Keeper Executor
       - Simulates the rebalance (Tenderly / local fork / viem simulate)
       - If profitable net of costs → calls vault.rebalance() with the new targets
       - Logs everything + alerts on anomalies
```

## Contract Architecture

### ZieldVault (Core)

- Inherits ERC4626 (standard share accounting, preview functions, etc.)
- Maintains a dynamic list of `IStrategy` implementations
- Stores **target** allocation per strategy (basis points, must sum to 10000)
- `rebalance()` is the only privileged mutative function besides admin controls:
  1. `harvestAll()` (pulls yield into each strategy's accounting)
  2. Withdraw excess from overweight strategies → increases vault idle
  3. Deposit into underweight strategies using idle + newly freed capital
- Owner can add/remove strategies and set targets (in production this moves to a timelocked governance or risk council)
- Keeper role can call `rebalance()` and a few other operational functions
- Pausable + basic withdrawal fee hook for MVP revenue experiment

**Key design choice**: The vault does **not** decide *when* or *to what* to rebalance. That intelligence lives off-chain. This keeps the on-chain surface small and auditable while allowing rapid improvement of the allocation logic.

### IStrategy Interface

Minimal but sufficient for the MVP:

- `asset()`
- `totalAssets()` — must be accurate and up-to-date after `harvest()`
- `estimatedAPY()` — view, can be static or oracle-fed for MVP
- `riskScore()` — 0-100, relatively stable, updatable by governance
- `deposit(amount)` / `withdraw(amount)` / `harvest()` / `emergencyWithdraw()`
- `isActive()`

### Strategy Adapters (Current)

1. **AaveV3Strategy**
   - Real integration with Aave v3 Pool on Base
   - Uses aUSDC balance as `totalAssets()`
   - Yield accrues automatically via aToken mechanics
   - Later: claim AAVE rewards and compound or sell for USDC

2. **MockYieldStrategy** (temporary but very useful)
   - Holds USDC, accrues fake yield linearly based on a controllable APY
   - Owner (during testing) can change APY and risk score on the fly
   - Allows us to validate the entire rebalance + optimizer loop deterministically before the real second strategy is production-ready

Future real strategies (post-MVP order):
- Morpho USDC vault or blue-chip market on Base
- Aerodrome stable LP or major volatile pair (with IL modeling in risk score)
- Pendle PT (principal token) positions
- Ethena sUSDe or similar yield-bearing stables if risk model supports

## Risk Engine + Optimizer (Off-Chain)

This is where Zield's actual edge lives in the MVP.

**Risk axes (MVP v0.1)**:
- Smart Contract (0-100)
- Market / Structural (0-100)
- Liquidity & Exit (0-100)
- Operational / Keeper (0-100)

**Scoring approach**:
- Each axis has a small number of sub-factors with weights.
- Final risk score = weighted average (can be non-linear).
- All parameters and methodology are versioned in the keeper repo and published.

**Optimizer (MVP)**:
- Simple but correct: sort opportunities by risk-adjusted score (`net_apy / risk_penalty` or similar).
- Greedy allocation respecting hard constraints:
  - No strategy > 40% of TVL (MVP cap)
  - "Aggressive" bucket (risk > 55) capped at 20% of TVL
  - Minimum position size to avoid dust
  - Estimated gas cost of the rebalance must be < X% of expected incremental yield over N days

Later versions can move to proper convex optimization (cvxpy or a TS solver) and correlation-aware portfolio construction.

## Keeper & Execution

The keeper is a Node/Bun service with these responsibilities:

1. **Data ingestion** (cron or event-driven)
2. **Risk scoring refresh**
3. **Optimization run** → produces a proposed allocation JSON + expected benefit
4. **Simulation** (critical safety layer):
   - Run the exact `rebalance()` call on a fresh fork or via Tenderly
   - Verify no reverts, slippage within bounds, and net value created
5. **Execution** only if simulation passes + benefit > threshold
6. **Monitoring & alerting** (Telegram / Discord / PagerDuty for serious deployments)

The keeper **never** has unlimited power — it can only call the narrow `rebalance()` entrypoint (and perhaps `harvestAll`).

## Frontend

Thin but high-signal:

- Connect wallet (Base only for MVP)
- Deposit / Withdraw with clear previews (using ERC4626 `preview*` functions)
- Dashboard showing:
  - Blended vault APY (weighted)
  - Portfolio risk score
  - Current vs target allocation (visual)
  - Per-strategy APY + risk + TVL
  - Recent rebalance history + rationale (pulled from keeper logs or on-chain events)
- Keeper ops page (authenticated) for manual trigger + simulation results

Tech: Next.js 15, Tailwind, shadcn/ui, wagmi + viem, TanStack Query.

## Testing Strategy

- **Unit**: Strategy math, vault share accounting, allocation validation
- **Integration / Fork**: Full deposit → multiple rebalances with changing APY/risk → withdrawal, using real Base mainnet state at a pinned block
- **Keeper simulation tests**: The optimizer + executor must be heavily tested against historical data and adversarial scenarios (sudden APY drops, strategy "breaking", gas spikes)
- **Invariant fuzzing** (later): Using Foundry or Hardhat + echidna

## Security Considerations (MVP)

- Contracts will receive a professional audit before any mainnet capital
- Keeper is the highest operational risk — design for easy rotation and emergency pause
- No complex on-chain math or price oracles in v1 (reduces attack surface)
- Withdrawal fee is optional and capped low
- All privileged functions have clear ownership/keeper separation

## Deployment & Operations

- Contracts deployed via Hardhat Ignition or custom scripts (to be added)
- Initial deployments on Base Sepolia with small test USDC
- Keeper runs 24/7 (multiple instances for redundancy)
- On-chain monitoring via Tenderly alerts or custom subgraph + Discord bot

## What Is Explicitly Out of Scope for MVP

- Any other chain besides Base
- Multiple assets in one vault
- On-chain risk parameters or voting
- Insurance wrapper
- Cross-chain bridging / intents
- Performance fees (we may add a simple flat fee later)
- Formal verification of the optimizer

These are all valuable and are captured in the vision document for after the core loop works reliably with real users and real money.

---

**This architecture is designed to be built, tested, reviewed, and shipped by a small team in weeks, not months.** Once it is live and we have data on how the risk model actually performs in the wild, we can responsibly expand scope.
