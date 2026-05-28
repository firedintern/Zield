from models import RiskVector, StrategySnapshot

def compute_composite_risk(risk: RiskVector) -> int:
    weights = {
        "smart_contract": 0.35,
        "market": 0.25,
        "liquidity": 0.25,
        "operational": 0.15,
    }

    weighted = (
        risk.smart_contract * weights["smart_contract"] +
        risk.market * weights["market"] +
        risk.liquidity * weights["liquidity"] +
        risk.operational * weights["operational"]
    )

    max_axis = max(risk.smart_contract, risk.market, risk.liquidity, risk.operational)
    penalty = (max_axis - 80) * 0.4 if max_axis > 80 else 0

    return min(100, int(weighted + penalty))

def risk_adjusted_score(apy_bps: int, composite_risk: int) -> float:
    if apy_bps <= 0:
        return 0.0
    risk = max(composite_risk, 1)
    return (apy_bps ** 1.1) / (risk ** 1.15)
