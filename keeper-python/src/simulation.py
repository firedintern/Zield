from models import OptimizerOutput, SimulationReport
from config import config

def run_preflight(
    proposed: OptimizerOutput,
    current_tvl_usd: int = 2_500_000
) -> SimulationReport:
    reasons = []
    warnings = []

    # Economic checks
    if proposed.estimated_gas_cost_usd > config.max_gas_cost_usd:
        reasons.append(f"Gas cost too high: ${proposed.estimated_gas_cost_usd}")

    expected_profit = max(0, (proposed.expected_portfolio_apy_bps - 850) * (current_tvl_usd / 365) * 7)
    net_ratio = expected_profit / proposed.estimated_gas_cost_usd if proposed.estimated_gas_cost_usd > 0 else 0

    if expected_profit < config.min_profit_usd:
        reasons.append(f"Expected profit too low: ${int(expected_profit)}")

    if net_ratio < config.min_net_benefit_multiplier:
        reasons.append(f"Net benefit ratio too low: {net_ratio:.1f}x")

    can_execute = len(reasons) == 0

    return SimulationReport(
        can_execute=can_execute,
        reasons=reasons,
        estimated_gas_usd=proposed.estimated_gas_cost_usd,
        expected_7day_profit_usd=int(expected_profit),
        net_benefit_ratio=round(net_ratio, 2),
        current_tvl_usd=current_tvl_usd,
        warnings=warnings,
        simulation_success=True,  # In real version we would do eth_call simulation here
    )
