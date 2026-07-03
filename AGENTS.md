# AGENTS.md

Canonical guidance for agents working in this repo. See also [README.md](./README.md) (product overview), [ARCHITECTURE.md](./ARCHITECTURE.md) (system design), [DEPLOY.md](./DEPLOY.md) (testnet deployment), and [DESIGN.md](./DESIGN.md) (visual design system).

## What this is

Zield is a risk-aware USDC yield vault on Base. `ZieldVault` (ERC-4626, Solidity) holds deposits and allocates them across pluggable strategy contracts. An off-chain keeper scores opportunities with a transparent risk model and proposes rebalances; a Next.js frontend shows live on-chain state and lets users deposit/withdraw.

## Structure

- `contracts/` — Hardhat + Solidity. `ZieldVault`, `IStrategy`, strategy adapters (real Aave v3 + mocks). Build outputs (`artifacts/`, `cache/`) are gitignored — run `npm run compile` to regenerate.
- `keeper/` — TypeScript risk engine, optimizer, and execution bot. `npm run dry-run` simulates, `npm run execute` sends real rebalance transactions (requires explicit confirmation).
- `keeper-python/` — Python reference implementation of the same risk model, kept in sync with the TS keeper.
- `frontend/` — Next.js dashboard. `frontend/lib/engine.ts` has a server-side decision engine mirroring the keeper's risk model; `frontend/lib/config.ts` holds vault/chain config.
- `design/huly-reference/` — style reference docs (tokens, palette, do's/don'ts) the current visual design is based on.

## Current deployment state

- Contracts are deployed to **Base Sepolia (testnet)**, not mainnet. Vault: `0x2d5AE0dd8B64DC5DEf338Df0620EFFdF4B7E364B`. Don't describe the product as "live on mainnet" until it actually is.
- Frontend is live at https://zield-nu.vercel.app (Vercel project `fired-interns-projects/zield`, auto-deploys on push to `main`).

## Working conventions

- Keep the risk model in `frontend/lib/engine.ts` and `keeper/src/risk.ts` in sync — both files note this dependency inline.
- Push to `main` as changes land (every push auto-deploys to production).
- No mock data labeled as "live" — this product's credibility depends on every displayed number being real (on-chain reads or real market data APIs).
- `contracts/.env`, `keeper/.env`, `frontend/.env.local` hold secrets (RPC URLs, private keys) — never commit them, never print their contents.
