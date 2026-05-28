# Zield Keeper - Python (MVP)

This is the Python port of the Zield risk-aware rebalancing keeper.

## Current Status

- Core optimizer + risk model implemented
- Preflight / economic safety checks
- **Real on-chain simulation** using `eth_call` (catches reverts before execution)
- **Real on-chain execution** supported via web3.py (when `VAULT_ADDRESS` + `KEEPER_PRIVATE_KEY` are set)
- CLI with `dry-run` and `execute` commands
- Mirrors the architecture and safety philosophy of the TypeScript keeper (multi-layer preflight)

> **Known Limitation**: The current Python MVP still uses hardcoded demo strategies for decision-making, even when pointing at a real vault. The simulation and execution against the real contract are genuine, however. Full on-chain strategy reading is planned.

## Setup

```bash
cd keeper-python
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Optional: use uv (faster)
# uv pip install -r requirements.txt
```

## Usage

```bash
# Dry run (recommended first)
python -m src.main dry-run

# Execute (will ask for confirmation, then send the real transaction)
python -m src.main execute

# Skip confirmation (for automation)
python -m src.main execute --yes
```

## Environment Variables

Same as the TypeScript keeper:

- `BASE_MAINNET_RPC`
- `VAULT_ADDRESS`
- `KEEPER_PRIVATE_KEY` (only needed for real execution)

## Testing

```bash
pip install pytest
python -m pytest tests/ -v
```

## Roadmap

- More comprehensive test coverage
- Better logging + structured output
- Production service wrapper examples

This Python version exists primarily to satisfy the "Python or TypeScript bots" requirement and to provide a reference implementation in another language.
