# Zield Keeper (Risk Engine + Optimizer + Executor)

This is the **brain** of Zield.

The contracts are deliberately kept relatively simple. Almost all the intelligence — data ingestion, risk scoring, allocation optimization, simulation, and execution decisions — lives here.

## Current State (MVP)

- `src/types.ts` — Core data structures
- `src/risk.ts` — Transparent 4-axis risk model + composite scoring
- `src/optimize.ts` — Risk-adjusted allocator with hard constraints
- `src/vault-reader.ts` — Reads live on-chain state from a deployed ZieldVault
- `src/simulation.ts` — Powerful preflight with economic safety gates
- `src/execute.ts` — **The only place that can send rebalance transactions** (simulation-first + explicit confirmation)
- `src/index.ts` + `src/dry-run.ts` — Development and safe simulation modes

## Running the Keeper

```bash
cd keeper
npm install

# Normal development mode (demo data + live external rates)
npm run dev

# Safe dry-run against a real deployed vault (recommended)
VAULT_ADDRESS=0xYourVault npm run dry-run

# Execute rebalance (heavily guarded — only does so after full simulation + confirmation)
VAULT_ADDRESS=0xYourVault KEEPER_PRIVATE_KEY=0x... npm run execute
```

**`execute` is extremely guarded**:
- Always runs full optimizer + economic preflight first
- Hard stops if any safety gate fails
- Requires typing `YES` (or `--yes` flag)
- Only the `execute.ts` file is allowed to call `rebalance()` on the vault

## Next Work (in order)

1. More real data sources (Morpho, Aerodrome bribes, etc.)
2. Strategy registry / on-chain configuration
3. Better simulation using local anvil forks for higher fidelity
4. Monitoring, alerting, and 24/7 runner (PM2 / Docker / systemd)
5. Backtesting framework
6. Governance / risk parameter management UI

This service will eventually run 24/7 with multiple redundant instances and on-call rotation.

## Philosophy

- The optimizer must be **reviewable by humans**. No black boxes.
- Every allocation change should have a clear, logged rationale.
- Simulation is non-negotiable. We never send a rebalance we haven't simulated first.
- When in doubt, stay conservative and harvest rather than rebalance.
