// Zield Frontend Configuration
// Update these values after deploying to Base Sepolia

export const ZIELD_CONFIG = {
  // === Base Sepolia (recommended for testing) ===
  chainId: 84532,
  rpcUrl: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org',

  // Deploy your vault with `cd contracts && npm run deploy:sepolia`
  // Then paste the Vault address here
  vaultAddress: (process.env.NEXT_PUBLIC_ZIELD_VAULT_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`,

  // USDC on Base Sepolia (official Circle test token)
  usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`,

  // === Base Mainnet (for later) ===
  // vaultAddress: '0x...', 
  // usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
} as const;

export const isVaultConfigured = () => {
  return ZIELD_CONFIG.vaultAddress !== '0x0000000000000000000000000000000000000000';
};
