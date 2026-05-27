# Zield — Vision, Plans, and Roadmap (Saved for Future Reference)

**Date saved:** 2026 (initial pivot from Algorand-only scoping)
**Status:** This document captures the ambitious, multichain, long-term thinking. The actual working MVP is being built in the main repo following the "Doable MVP" section below. Do not implement anything from this document until the MVP is live and battle-tested.

---

## Core Vision (The Real Problem)

Zield is a **risk-aware, automated yield optimizer** for DeFi.

The industry has plenty of "highest APY" vaults and yield aggregators. Very few have survived (or deserved to survive) once you apply a serious risk lens. Raw yield chasing has produced repeated blowups: bad oracles, concentrated smart contract risk, hidden liquidity risk, governance attacks, bridge failures, and strategies that looked good on paper until a black swan or slow drain.

**Zield's north star:**
"Deliver the best *risk-adjusted* yield available at any given moment, with transparent methodology, executable rebalancing, and capital that can actually exit when users want it."

This is much harder than it sounds.

---

## Why Most Yield Aggregators Fail at Risk-Adjusted Optimization

1. **Data is noisy and gameable** — Protocol-reported APYs are often optimistic, lagged, or ignore utilization curves and withdrawal queues.
2. **Risk is multi-dimensional and mostly qualitative** — Smart contract risk, market risk (IL, volatility, correlation), liquidity risk, operational risk, and "unknown unknowns" do not reduce cleanly to a single number.
3. **Rebalancing has real costs** — Gas, slippage, bridge fees, tax events, opportunity cost during withdrawal delays. An optimizer that ignores execution costs destroys value.
4. **Incentives are usually misaligned** — Many vaults are either fee-maximizers for the team or marketing vehicles for specific protocols.
5. **Multichain is not free** — Fragmented liquidity, bridge risk, and different security models per chain make "deploy everywhere" a liability unless you have excellent coordination and monitoring.

---

## Architecture Options Considered (The Big Plans)

### Option 1: Hub-and-Spoke with Per-Chain Vaults (Recommended long-term direction)
- Production-grade ERC-4626 (or equivalent) vaults on each major chain (Base, Arbitrum, OP, Solana via Kamino-style, etc.).
- Strategy adapters live on the same chain as the capital.
- A central Risk Engine + Optimizer (off-chain service with strong monitoring + simulation) computes target allocations across *all* opportunities.
- Keepers (redundant, bonded or insured) execute the rebalances.
- Later evolution: lightweight coordination hub (using LayerZero, Wormhole, or intent-based bridging) that can direct marginal capital across chains without forcing shared liquidity on day one.
- Strengths: Auditable per chain, easier to get security reviews, capital stays native until moved.
- Weaknesses: Still requires excellent cross-chain data and execution reliability.

### Option 2: Intent / Solver-Driven Capital Allocation (Highest UX, hardest to secure)
- User expresses intent ("I want to deposit X USDC into Zield with risk tolerance Y").
- A network of solvers (or your own high-quality solver) competes to route the funds to the current optimal set of positions, potentially across chains.
- Optimizer lives in the solver competition.
- Can achieve superior capital efficiency and one-click UX.
- Requires sophisticated simulation, reputation or bonding for solvers, and careful handling of failed or partial fills.
- This is closer to the future of DeFi (see CoW Swap, Across, Socket, etc.).

### Option 3: Single "God Vault" with Heavy On-Chain Logic
- One (or very few) massive vault contracts that try to do a lot of the optimization and accounting on-chain.
- Almost always the wrong choice for this problem. Hits hard limits on computation, data availability, and upgradability. Rebalancing decisions need fresh external data. History shows these designs either become governance-heavy or get exploited when the on-chain logic is gamed.

### Option 4: Insurance-Wrapped or "Risk-Transferred" Vaults (Differentiation play)
- Core yield optimization + an optional insurance layer (via existing DeFi insurance protocols or a custom underwriting pool) that lets users buy downside protection.
- Extremely powerful for institutions and large DAOs.
- Requires actuarial modeling, claims process, and capital efficiency on the insurance side. High bar.

---

## Longer-Term Product & Technical Ambitions

- **Transparent, versioned Risk Methodology** published on-chain or in a verifiable repo. Parameters updatable via governance or a Risk Council with timelocks and emergency powers.
- **On-chain + off-chain hybrid scoring** — Use on-chain signals (TVL, utilization, time since last incident, audit flags via some registry) combined with high-quality off-chain research.
- **Portfolio-level risk** — Not just per-strategy scores, but correlation-aware portfolio construction (true mean-variance or CVaR-style constraints).
- **Execution quality** — Flashbots / private RPCs, MEV protection, atomic multi-step rebalances where possible, pre- and post-rebalance simulation with profit checks.
- **Withdrawal queue / liquidity management** — Mature vaults need to handle the fact that some strategies have exit delays.
- **Institutional features** — Role-based access, custom risk parameters per depositor cohort, reporting APIs, SOC2-friendly audit trails.
- **Omnichain UX** — Eventually users should not have to think about which chain their capital sits on.
- **Composability** — Let other protocols use Zield as a primitive (e.g., "my treasury yield is managed by Zield").
- **Insurance / hedging module** — Native or partnered protection against smart contract and market events.
- **Governance minimization** — Where possible, push toward on-chain verifiable rules + off-chain high-quality keepers rather than token-holder votes on every parameter.

---

## Tech Choices Considered (For the Full Vision)

**Contracts**
- EVM: Solidity + Foundry (or Halmos / Kontrol for formal methods on critical paths).
- Solana: Anchor + Rust (for Kamino-style or native Solana yield).
- Cross-chain messaging: LayerZero (dominant for this use case), Wormhole, or Axelar depending on security model.

**Data & Risk Engine**
- Primary: DefiLlama, protocol-specific APIs, Goldsky / Dune / Flipside / custom subgraphs.
- Secondary: On-chain indexing via viem + event processing.
- Risk modeling: Python (pandas, scipy, cvxpy for optimization) or high-performance TS. Needs to be reproducible and reviewable.

**Execution / Keeper**
- TypeScript (Bun preferred for speed) + viem + Tenderly or Foundry simulation.
- Redundant keepers across regions/cloud providers.
- Alerting (PagerDuty / OpsGenie), on-chain monitoring (DefiLlama or custom), circuit breakers.

**Frontend**
- Next.js 15 + Tailwind + shadcn/ui + wagmi/viem + TanStack.
- Strong emphasis on transparency: show the current risk model parameters, historical rebalance rationale, withdrawal queue status, etc.

**Bridging & Intents (later)**
- Across, Socket, LayerZero + Stargate, or native intent solvers.

---

## Major Risks & Why This Is Hard

- **Security surface** is enormous once you have adapters for 8-15 different protocols across multiple chains.
- **Model risk** — A sophisticated-looking risk model that is actually wrong or overfit will lose people's money and destroy trust faster than a simple one.
- **Regulatory** — Yield products with any promise of optimization or risk management attract attention.
- **Capital efficiency & liquidity** — The best risk-adjusted yields are often in smaller or more illiquid pools. Scaling creates adverse selection.
- **Keeper economics & reliability** — Rebalancing must be net profitable after all costs, and the system must keep working when markets are stressed.
- **Competition** — Yearn, Morpho (with their own vault ecosystem), Beefy, Pendle teams, and several well-funded new entrants are already here.
- **Bridge and cross-chain risk** — Every time capital moves chains, you add a new failure mode.

---

## Doable MVP (The Thing We're Actually Building First)

See the main `README.md` and `ARCHITECTURE.md` in the repo root for the current MVP definition.

**Guiding principles for the MVP:**
- One chain first (Base is the current winner for low gas + real DeFi activity).
- Real protocol integrations, not mocks (Aave v3 at minimum).
- Credible but deliberately simple risk model that we document publicly.
- Automated keeper from day one (even if the optimizer starts semi-manual).
- Excellent local testing with forks.
- No over-promising on "we will beat the market risk-free."

All future work (full multichain, intents, insurance wrapper, on-chain risk oracles, portfolio optimization, etc.) is deliberately deferred until the MVP is live, has real users or test capital, and we have learned what actually breaks.

---

## Next Steps After MVP (High-Level Only)

1. Expand to 2nd chain (Arbitrum) with capital migration tools.
2. Add 4-6 more high-quality strategies with proper adapters.
3. Improve risk model with historical backtesting and correlation data.
4. Professional keeper infrastructure + economic security.
5. Public risk methodology + dashboard.
6. Consider insurance or hedging layer.
7. Explore intent-based or solver-based capital routing.
8. Governance / Risk Council design.

---

*This document exists so we do not lose the big thinking while we ruthlessly focus on the smallest viable thing that can prove the core loop: deposit → risk-aware allocation → profitable rebalancing → withdrawal.*

**Do not implement from this file until explicitly authorized after MVP success criteria are met.**