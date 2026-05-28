"""
Zield Python Keeper - Real Transaction Execution

This module handles actually sending the rebalance transaction on-chain.
It is intentionally kept simple but safe (mirrors the philosophy of the TS execute.ts).
"""

from web3 import Web3
from eth_account import Account
from eth_account.signers.local import LocalAccount
from dotenv import load_dotenv
import os

from config import config
from models import OptimizerOutput

load_dotenv()


def get_web3() -> Web3:
    """Get a Web3 instance connected to the configured RPC."""
    w3 = Web3(Web3.HTTPProvider(config.rpc_url))
    if not w3.is_connected():
        raise ConnectionError(f"Failed to connect to RPC: {config.rpc_url}")
    return w3


def execute_rebalance(vault_address: str, decision: OptimizerOutput) -> str:
    """
    Execute the rebalance transaction on-chain.
    
    Returns the transaction hash.
    """
    if not config.private_key:
        raise ValueError("KEEPER_PRIVATE_KEY is required for execution")

    w3 = get_web3()
    account: LocalAccount = Account.from_key(config.private_key)

    # Ensure we're on the right chain
    chain_id = w3.eth.chain_id
    print(f"Connected to chain ID: {chain_id}")

    # Build the transaction
    vault_address = Web3.to_checksum_address(vault_address)
    nonce = w3.eth.get_transaction_count(account.address)

    # Simple rebalance transaction
    tx = {
        "from": account.address,
        "to": vault_address,
        "data": w3.keccak(text="rebalance()")[:4],  # function selector for rebalance()
        "nonce": nonce,
        "chainId": chain_id,
    }

    # Estimate gas (with buffer)
    try:
        estimated_gas = w3.eth.estimate_gas(tx)
        tx["gas"] = int(estimated_gas * 1.2)  # 20% buffer
    except Exception as e:
        print(f"Gas estimation failed: {e}. Using default gas limit.")
        tx["gas"] = 300_000  # Safe default for rebalance

    # Get gas price (EIP-1559 aware)
    try:
        base_fee = w3.eth.get_block("latest").baseFeePerGas
        priority_fee = w3.to_wei(2, "gwei")  # 2 gwei priority
        tx["maxFeePerGas"] = base_fee * 2 + priority_fee
        tx["maxPriorityFeePerGas"] = priority_fee
    except Exception:
        # Fallback to legacy gas price
        tx["gasPrice"] = w3.eth.gas_price

    # Sign and send
    signed_tx = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)

    print(f"Transaction sent: {tx_hash.hex()}")
    return tx_hash.hex()


def wait_for_receipt(tx_hash: str, timeout: int = 180) -> dict:
    """Wait for transaction receipt (useful for scripts)."""
    w3 = get_web3()
    return w3.eth.wait_for_transaction_receipt(tx_hash, timeout=timeout)
