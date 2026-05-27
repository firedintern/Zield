import { NextResponse } from 'next/server';
import { createPublicClient, http, type Address } from 'viem';
import { base, baseSepolia } from 'viem/chains';

// Inline minimal config for the API route (avoids path resolution issues in Next.js build)
const VAULT_ADDRESS = (process.env.NEXT_PUBLIC_ZIELD_VAULT_ADDRESS || '0x0000000000000000000000000000000000000000') as Address;
const CHAIN_ID = 84532; // Base Sepolia for MVP
const RPC_URL = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org';

const REBALANCED_EVENT = {
  type: 'event',
  name: 'Rebalanced',
  inputs: [
    { name: 'totalAssetsBefore', type: 'uint256', indexed: false },
    { name: 'totalAssetsAfter', type: 'uint256', indexed: false },
    { name: 'timestamp', type: 'uint256', indexed: false },
  ],
} as const;

export async function GET() {
  const vaultAddress = VAULT_ADDRESS;

  if (!vaultAddress || vaultAddress === '0x0000000000000000000000000000000000000000') {
    // Return demo data when no real vault is configured
    return NextResponse.json({
      isDemo: true,
      activities: [
        {
          timestamp: Date.now() - 1000 * 60 * 60 * 18,
          totalAssetsBefore: 2_350_000_000_000,
          totalAssetsAfter: 2_412_000_000_000,
          profit: 62_000_000_000,
          txHash: null,
        },
        {
          timestamp: Date.now() - 1000 * 60 * 60 * 42,
          totalAssetsBefore: 2_180_000_000_000,
          totalAssetsAfter: 2_310_000_000_000,
          profit: 130_000_000_000,
          txHash: null,
        },
      ],
    });
  }

  try {
    const chain = CHAIN_ID === 84532 ? baseSepolia : base;
    const client = createPublicClient({
      chain,
      transport: http(RPC_URL),
    });

    const logs = await client.getLogs({
      address: vaultAddress,
      event: REBALANCED_EVENT,
      fromBlock: 'earliest',
      toBlock: 'latest',
    });

    const activities = logs
      .slice(-5) // last 5 rebalances
      .map((log) => {
        const args = log.args as {
          totalAssetsBefore: bigint;
          totalAssetsAfter: bigint;
          timestamp: bigint;
        };

        const profit = Number(args.totalAssetsAfter - args.totalAssetsBefore);

        return {
          timestamp: Number(args.timestamp) * 1000,
          totalAssetsBefore: Number(args.totalAssetsBefore),
          totalAssetsAfter: Number(args.totalAssetsAfter),
          profit,
          txHash: log.transactionHash,
        };
      })
      .reverse();

    return NextResponse.json({
      isDemo: false,
      activities,
    });
  } catch (error) {
    console.error('Failed to fetch on-chain activity:', error);

    // Fallback to demo on error
    return NextResponse.json({
      isDemo: true,
      activities: [
        {
          timestamp: Date.now() - 1000 * 60 * 60 * 18,
          totalAssetsBefore: 2_350_000_000_000,
          totalAssetsAfter: 2_412_000_000_000,
          profit: 62_000_000_000,
          txHash: null,
        },
      ],
      error: 'Could not fetch on-chain events. Showing demo data.',
    });
  }
}
