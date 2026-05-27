import { createPublicClient, http, parseAbi, type Address, type PublicClient } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { KEEPER_CONFIG } from './config.js';

const VAULT_ABI = parseAbi([
  'function totalAssets() view returns (uint256)',
  'function asset() view returns (address)',
  'function getAllStrategies() view returns ((address strategy, uint16 targetBps)[])',
  'function strategyAssets(address) view returns (uint256)',
]);

const STRATEGY_ABI = parseAbi([
  'function totalAssets() view returns (uint256)',
  'function estimatedAPY() view returns (uint256)',
  'function riskScore() view returns (uint8)',
  'function isActive() view returns (bool)',
]);

export interface OnChainVaultState {
  vaultAddress: Address;
  totalAssets: bigint;
  assetAddress: Address;
  strategies: Array<{
    address: Address;
    targetBps: number;
    currentAssets: bigint;
    apyBps: number;
    riskScore: number;
    isActive: boolean;
  }>;
}

/**
 * Reads the live state of a deployed ZieldVault.
 * This is the bridge between on-chain reality and the off-chain optimizer.
 */
export async function readVaultState(
  vaultAddress: Address,
  rpcUrl?: string,
  chain = base
): Promise<OnChainVaultState> {
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl || KEEPER_CONFIG.SIMULATION_RPC),
  });

  // Read vault level data
  const [totalAssets, assetAddress, strategyTuples] = await Promise.all([
    client.readContract({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: 'totalAssets',
    }),
    client.readContract({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: 'asset',
    }),
    client.readContract({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: 'getAllStrategies',
    }),
  ]);

  // Read per-strategy data in parallel
  const strategyData = await Promise.all(
    strategyTuples.map(async (tuple) => {
      const stratAddress = tuple[0] as Address;
      const targetBps = Number(tuple[1]);

      const [currentAssets, apyBps, riskScore, isActive] = await Promise.all([
        client.readContract({
          address: stratAddress,
          abi: STRATEGY_ABI,
          functionName: 'totalAssets',
        }),
        client.readContract({
          address: stratAddress,
          abi: STRATEGY_ABI,
          functionName: 'estimatedAPY',
        }),
        client.readContract({
          address: stratAddress,
          abi: STRATEGY_ABI,
          functionName: 'riskScore',
        }),
        client.readContract({
          address: stratAddress,
          abi: STRATEGY_ABI,
          functionName: 'isActive',
        }),
      ]);

      return {
        address: stratAddress,
        targetBps,
        currentAssets,
        apyBps: Number(apyBps),
        riskScore: Number(riskScore),
        isActive,
      };
    })
  );

  return {
    vaultAddress,
    totalAssets,
    assetAddress,
    strategies: strategyData,
  };
}

/**
 * Converts on-chain state into the format the optimizer expects.
 */
export function vaultStateToSnapshots(state: OnChainVaultState) {
  const strategies = state.strategies.map((s) => ({
    address: s.address,
    name: s.address.slice(0, 10) + '...', // In real version we'd have names in config
    asset: state.assetAddress,
    currentAPYBps: s.apyBps,
    risk: {
      smartContract: s.riskScore,
      market: Math.floor(s.riskScore * 0.8),
      liquidity: Math.floor(s.riskScore * 0.7),
      operational: 20,
    },
    tvl: s.currentAssets,
    maxAllocationBps: 4000,
  }));

  const portfolio = {
    vaultAddress: state.vaultAddress,
    totalAssets: state.totalAssets,
    currentAllocations: Object.fromEntries(
      state.strategies.map(s => [s.address, s.currentAssets])
    ),
  };

  return { strategies, portfolio };
}
