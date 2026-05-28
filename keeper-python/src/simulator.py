"""
On-chain simulation for the Python Zield Keeper.

This module provides real eth_call based simulation of the rebalance transaction,
mirroring what viem.simulateContract does in the TypeScript version.
"""

from web3 import Web3
from web3.exceptions import ContractLogicError
from eth_typing import ChecksumAddress


def simulate_rebalance(
    w3: Web3,
    vault_address: ChecksumAddress,
    from_address: ChecksumAddress,
) -> tuple[bool, str | None]:
    """
    Attempts to simulate the rebalance() call on-chain.

    Returns:
        (success: bool, revert_reason: str | None)
    """
    try:
        # Build the transaction for simulation
        tx = {
            "from": from_address,
            "to": vault_address,
            "data": w3.keccak(text="rebalance()")[:4],  # rebalance() selector
            "gas": 300_000,  # dummy gas for simulation
        }

        # This will revert if the on-chain call would fail
        w3.eth.call(tx)

        return True, None

    except ContractLogicError as e:
        # This is the expected path when simulation reverts
        reason = str(e)
        return False, reason

    except Exception as e:
        # Unexpected error during simulation
        return False, f"Simulation error: {str(e)}"
