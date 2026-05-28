from pydantic import BaseModel
from typing import Dict

class RiskVector(BaseModel):
    smart_contract: int
    market: int
    liquidity: int
    operational: int

class StrategySnapshot(BaseModel):
    address: str
    name: str
    asset: str
    current_apy_bps: int
    risk: RiskVector
    tvl: int  # in smallest units (e.g. USDC * 1e6)
    max_allocation_bps: int

class PortfolioSnapshot(BaseModel):
    vault_address: str
    total_assets: int
    current_allocations: Dict[str, int]

class AllocationDecision(BaseModel):
    strategy_address: str
    target_bps: int
    expected_net_apy_bps: int
    risk_score: int
    rationale: str

class OptimizerOutput(BaseModel):
    timestamp: int
    vault: str
    decisions: list[AllocationDecision]
    expected_portfolio_apy_bps: int
    portfolio_risk_score: int
    estimated_gas_cost_usd: int
    net_benefit_threshold_usd: int
    can_execute: bool

class SimulationReport(BaseModel):
    can_execute: bool
    reasons: list[str]
    estimated_gas_usd: int
    expected_7day_profit_usd: int
    net_benefit_ratio: float
    current_tvl_usd: int
    warnings: list[str]
    simulation_success: bool
    revert_reason: str | None = None