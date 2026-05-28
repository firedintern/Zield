from models import StrategySnapshot, PortfolioSnapshot, AllocationDecision, OptimizerOutput
from risk import compute_composite_risk, risk_adjusted_score
import time

def run_optimizer(
    strategies: list[StrategySnapshot],
    portfolio: PortfolioSnapshot,
    current_gas_cost_usd: int = 22
) -> OptimizerOutput:
    # Score strategies
    scored = []
    for s in strategies:
        composite = compute_composite_risk(s.risk)
        score = risk_adjusted_score(s.current_apy_bps, composite)
        scored.append({**s.model_dump(), "composite_risk": composite, "risk_adjusted_score": score})

    # Sort by score
    scored.sort(key=lambda x: x["risk_adjusted_score"], reverse=True)

    # Hard constraints (same as TS)
    MAX_PER_STRATEGY = 4000
    MAX_HIGH_RISK = 2000

    remaining_bps = 10000
    high_risk_used = 0
    decisions: list[AllocationDecision] = []

    for s in scored:
        is_high_risk = s["composite_risk"] > 55
        target = min(remaining_bps, MAX_PER_STRATEGY)

        if is_high_risk:
            room = MAX_HIGH_RISK - high_risk_used
            target = min(target, room)
            high_risk_used += target

        if target < 100:
            target = 0

        remaining_bps -= target

        decisions.append(AllocationDecision(
            strategy_address=s["address"],
            target_bps=target,
            expected_net_apy_bps=s["current_apy_bps"],
            risk_score=s["composite_risk"],
            rationale=f"{s['name']} — RA score {s['risk_adjusted_score']:.1f}"
        ))

    # Fill remaining to highest non-high-risk if needed
    if remaining_bps > 0:
        for d in decisions:
            if d.risk_score <= 55:
                d.target_bps += remaining_bps
                break

    total_apy = sum(d.expected_net_apy_bps * d.target_bps for d in decisions) / 10000
    weighted_risk = sum(d.risk_score * d.target_bps for d in decisions) / 10000

    return OptimizerOutput(
        timestamp=int(time.time()),
        vault=portfolio.vault_address,
        decisions=decisions,
        expected_portfolio_apy_bps=int(total_apy),
        portfolio_risk_score=int(weighted_risk),
        estimated_gas_cost_usd=current_gas_cost_usd,
        net_benefit_threshold_usd=current_gas_cost_usd * 4,
        can_execute=True,
    )
