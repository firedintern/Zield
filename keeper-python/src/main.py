"""
Zield Python Keeper (MVP)

Usage:
    python -m src.main dry-run
    python -m src.main execute --yes
"""

import typer
from rich.console import Console
from rich.table import Table
from dotenv import load_dotenv

from config import config
from models import StrategySnapshot, PortfolioSnapshot, RiskVector
from optimizer import run_optimizer
from simulation import run_preflight
from simulator import simulate_rebalance
from executor import execute_rebalance

load_dotenv()
app = typer.Typer()
console = Console()

# Demo strategies (same as TS version for consistency)
DEMO_STRATEGIES = [
    StrategySnapshot(
        address="0xAaveV3USDCStrategy",
        name="Aave v3 USDC",
        asset="USDC",
        current_apy_bps=420,
        risk=RiskVector(smart_contract=12, market=8, liquidity=5, operational=10),
        tvl=2_400_000_000_000,
        max_allocation_bps=4000,
    ),
    StrategySnapshot(
        address="0xConservativeMock",
        name="Conservative Yield",
        asset="USDC",
        current_apy_bps=920,
        risk=RiskVector(smart_contract=22, market=15, liquidity=18, operational=14),
        tvl=1_100_000_000_000,
        max_allocation_bps=4000,
    ),
    StrategySnapshot(
        address="0xAggressiveMock",
        name="High Yield (Risk-capped)",
        asset="USDC",
        current_apy_bps=1850,
        risk=RiskVector(smart_contract=55, market=72, liquidity=48, operational=35),
        tvl=380_000_000_000,
        max_allocation_bps=2000,
    ),
]

DEMO_PORTFOLIO = PortfolioSnapshot(
    vault_address="0xDemoVault",
    total_assets=4_200_000_000_000,
    current_allocations={},
)


@app.command()
def dry_run():
    """Run full optimizer + preflight without executing anything."""
    console.print("[bold]Zield Python Keeper — DRY RUN[/bold]\n", style="cyan")

    decision = run_optimizer(DEMO_STRATEGIES, DEMO_PORTFOLIO)
    preflight = run_preflight(decision)

    table = Table(title="Optimizer Decision")
    table.add_column("Strategy", style="cyan")
    table.add_column("Target %", justify="right")
    table.add_column("APY", justify="right")
    table.add_column("Risk", justify="right")

    for d in decision.decisions:
        table.add_row(d.strategy_address[:12] + "...", f"{d.target_bps/100:.0f}%", f"{d.expected_net_apy_bps/100:.1f}%", str(d.risk_score))

    console.print(table)
    console.print(f"\nExpected Portfolio APY: [green]{decision.expected_portfolio_apy_bps/100:.1f}%[/green]")
    console.print(f"Portfolio Risk Score: [yellow]{decision.portfolio_risk_score}[/yellow]")

    console.print("\n--- Preflight ---")
    if preflight.can_execute:
        console.print("[green]✅ Would be safe to execute[/green]")
        console.print(f"Expected 7d Profit: ${preflight.expected_7day_profit_usd}")
        console.print(f"Net Benefit: {preflight.net_benefit_ratio}x gas")
    else:
        console.print("[red]❌ Execution would be blocked[/red]")
        for r in preflight.reasons:
            console.print(f"  - {r}")


@app.command()
def execute(yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation")):
    """Run full preflight and (optionally) execute the rebalance."""
    console.print("[bold red]EXECUTION MODE[/bold red] — This can move real capital.\n")

    decision = run_optimizer(DEMO_STRATEGIES, DEMO_PORTFOLIO)
    preflight = run_preflight(decision)

    if not preflight.can_execute:
        console.print("[red]Preflight failed. Aborting.[/red]")
        for r in preflight.reasons:
            console.print(f"  - {r}")
        raise typer.Exit(1)

    console.print("[green]Economic preflight passed.[/green]")

    # NOTE: The current Python MVP still uses DEMO_STRATEGIES for decision making,
    # even when a real VAULT_ADDRESS is provided. This is a known limitation.
    # The simulation + execution against the real vault is real, however.

    # === Real on-chain simulation (new) ===
    if config.vault_address and config.private_key:
        from web3 import Web3
        from eth_account import Account

        w3 = Web3(Web3.HTTPProvider(config.rpc_url))
        account = Account.from_key(config.private_key)

        console.print("[cyan]Running on-chain simulation...[/cyan]")
        sim_success, revert_reason = simulate_rebalance(
            w3,
            Web3.to_checksum_address(config.vault_address),
            account.address,
        )

        if not sim_success:
            console.print(f"[red]On-chain simulation failed: {revert_reason}[/red]")
            raise typer.Exit(1)

        console.print("[green]On-chain simulation successful.[/green]")
    else:
        console.print("[yellow]Skipping on-chain simulation (no VAULT_ADDRESS or private key).[/yellow]")

    if not yes:
        confirm = input("Type 'YES' to execute the rebalance: ")
        if confirm != "YES":
            console.print("Execution cancelled.")
            raise typer.Exit(0)

    console.print("[yellow]Executing rebalance on-chain...[/yellow]")

    if not config.vault_address:
        console.print("[red]VAULT_ADDRESS is required in environment to execute.[/red]")
        raise typer.Exit(1)

    try:
        tx_hash = execute_rebalance(config.vault_address, decision)
        console.print(f"[green]Rebalance transaction sent successfully![/green]")
        console.print(f"Tx Hash: {tx_hash}")
        console.print(f"Explorer: https://basescan.org/tx/{tx_hash}")
    except Exception as e:
        console.print(f"[red]Execution failed: {e}[/red]")
        raise typer.Exit(1)


if __name__ == "__main__":
    app()
