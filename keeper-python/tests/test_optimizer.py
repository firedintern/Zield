"""
Basic tests for the Python keeper's core logic.
"""

import pytest
from src.risk import compute_composite_risk, risk_adjusted_score
from src.models import RiskVector
from src.optimizer import run_optimizer
from src.models import StrategySnapshot, PortfolioSnapshot


def test_compute_composite_risk():
    risk = RiskVector(
        smart_contract=10,
        market=15,
        liquidity=20,
        operational=5
    )
    score = compute_composite_risk(risk)
    assert 0 <= score <= 100
    assert score < 30  # Should be low risk


def test_risk_adjusted_score():
    score = risk_adjusted_score(apy_bps=800, composite_risk=20)
    assert score > 0


def test_optimizer_respects_risk_caps():
    strategies = [
        StrategySnapshot(
            address="0x1",
            name="Aggressive",
            asset="USDC",
            current_apy_bps=2000,
            risk=RiskVector(smart_contract=60, market=70, liquidity=50, operational=40),
            tvl=100_000_000_000,
            max_allocation_bps=2000,
        ),
        StrategySnapshot(
            address="0x2",
            name="Safe",
            asset="USDC",
            current_apy_bps=500,
            risk=RiskVector(smart_contract=10, market=10, liquidity=10, operational=10),
            tvl=100_000_000_000,
            max_allocation_bps=4000,
        ),
    ]

    portfolio = PortfolioSnapshot(
        vault_address="0xVault",
        total_assets=200_000_000_000,
        current_allocations={},
    )

    result = run_optimizer(strategies, portfolio)

    # The aggressive strategy (high risk) should be capped at 20%
    aggressive = next(d for d in result.decisions if "Aggressive" in d.rationale or d.strategy_address == "0x1")
    assert aggressive.target_bps <= 2000, "High risk strategy exceeded 20% cap"


if __name__ == "__main__":
    pytest.main([__file__])
