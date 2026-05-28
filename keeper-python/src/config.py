from pydantic import BaseModel
from dotenv import load_dotenv
import os

load_dotenv()

class KeeperConfig(BaseModel):
    # Risk & Allocation Hard Gates
    max_allocation_per_strategy_bps: int = 4000      # 40%
    max_high_risk_bucket_bps: int = 2000             # 20% in strategies with risk > 55

    # Safety Thresholds
    min_net_benefit_multiplier: int = 4              # Expected profit must be at least 4x gas
    min_profit_usd: int = 25
    max_gas_cost_usd: int = 80

    # RPCs
    rpc_url: str = os.getenv("BASE_MAINNET_RPC", "https://mainnet.base.org")
    execution_rpc_url: str = os.getenv("BASE_MAINNET_RPC", "https://mainnet.base.org")

    # Behavior
    rebalance_cooldown_hours: int = 6
    drift_threshold_bps: int = 300

    # Secrets
    private_key: str | None = os.getenv("KEEPER_PRIVATE_KEY")
    vault_address: str | None = os.getenv("VAULT_ADDRESS")

config = KeeperConfig()