# Zield — Testnet Deployment & End-to-End Guide

This guide walks you through getting a fully working Zield system on Base Sepolia.

## 1. Prerequisites

- Node.js 20+
- A wallet with Base Sepolia ETH + test USDC
  - ETH Faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
  - USDC Faucet: https://faucet.circle.com/

## 2. Deploy the Contracts

```bash
cd contracts

# Add your private key (Sepolia only — never use mainnet keys here)
echo "DEPLOYER_PRIVATE_KEY=0xYourSepoliaPrivateKey" >> .env

npm run deploy:sepolia
```

Copy the **Vault** address from the output.

## 3. Point the Keeper at Your Vault

```bash
cd ../keeper

# Create .env if you haven't already
cp .env.example .env

# Edit .env and set:
# VAULT_ADDRESS=0xTheAddressFromTheDeployScript
```

Run the keeper:

```bash
npm run dry-run     # See what it would do (safe)
npm run dev         # Continuous mode
```

## 4. Open the Frontend

```bash
cd ../frontend
npm run dev
```

- Connect your wallet
- Switch to **Base Sepolia**
- Deposit test USDC

The dashboard will show live keeper decisions based on the real on-chain state of your vault.

## 5. Experiment

- In the keeper terminal, you can change the mock strategies' APY and risk on the fly (via the MockYieldStrategy contracts) and watch the optimizer react.
- Use `npm run keeper:dry-run` any time to see a full simulation report without sending transactions.

## Next Steps After Testing

- Deploy to Base mainnet (with real Aave + more strategies)
- Add a real second protocol (Morpho or Aerodrome)
- Give the keeper a proper private key + monitoring for automated rebalancing

This flow gives you a complete, observable risk-aware yield optimizer on testnet in under 15 minutes.
