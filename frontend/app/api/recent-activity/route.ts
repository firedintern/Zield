import { NextResponse } from 'next/server';
import { createPublicClient, http, type Address, parseAbiItem } from 'viem';
import { base, baseSepolia } from 'viem/chains';

const VAULT_ADDRESS = (process.env.NEXT_PUBLIC_ZIELD_VAULT_ADDRESS || '0x0000000000000000000000000000000000000000') as Address;
const CHAIN_ID = 84532;
const RPC_URL = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org';

const DEPOSIT_EVENT = parseAbiItem('event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)');
const WITHDRAW_EVENT = parseAbiItem('event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)');
const REBALANCED_EVENT = parseAbiItem('event Rebalanced(uint256 totalAssetsBefore, uint256 totalAssetsAfter, uint256 timestamp)');

export async function GET() {
  if (!VAULT_ADDRESS || VAULT_ADDRESS === '0x0000000000000000000000000000000000000000') {
    return NextResponse.json({ isDemo: true, activities: [] });
  }

  try {
    const chain = CHAIN_ID === 84532 ? baseSepolia : base;
    const client = createPublicClient({ chain, transport: http(RPC_URL) });

    const [depositLogs, withdrawLogs, rebalanceLogs] = await Promise.all([
      client.getLogs({ address: VAULT_ADDRESS, event: DEPOSIT_EVENT, fromBlock: 'earliest', toBlock: 'latest' }),
      client.getLogs({ address: VAULT_ADDRESS, event: WITHDRAW_EVENT, fromBlock: 'earliest', toBlock: 'latest' }),
      client.getLogs({ address: VAULT_ADDRESS, event: REBALANCED_EVENT, fromBlock: 'earliest', toBlock: 'latest' }),
    ]);

    // Fetch block timestamps for deposit/withdraw events
    const blockNumbers = [
      ...depositLogs.map(l => l.blockNumber),
      ...withdrawLogs.map(l => l.blockNumber),
    ].filter((b): b is bigint => b !== null);
    const uniqueBlocks = [...new Set(blockNumbers)];
    const blockTimestamps = new Map<bigint, number>();
    await Promise.all(
      uniqueBlocks.map(async (bn) => {
        const block = await client.getBlock({ blockNumber: bn });
        blockTimestamps.set(bn, Number(block.timestamp) * 1000);
      })
    );

    const activities: Array<{
      type: string;
      timestamp: number;
      assets?: number;
      shares?: number;
      totalAssetsBefore?: number;
      totalAssetsAfter?: number;
      profit?: number;
      sender?: string;
      txHash: string | null;
    }> = [];

    for (const log of depositLogs) {
      const args = log.args as { sender: string; owner: string; assets: bigint; shares: bigint };
      activities.push({
        type: 'deposit',
        timestamp: log.blockNumber ? (blockTimestamps.get(log.blockNumber) ?? Date.now()) : Date.now(),
        assets: Number(args.assets),
        shares: Number(args.shares),
        sender: args.sender,
        txHash: log.transactionHash,
      });
    }

    for (const log of withdrawLogs) {
      const args = log.args as { sender: string; receiver: string; owner: string; assets: bigint; shares: bigint };
      activities.push({
        type: 'withdraw',
        timestamp: log.blockNumber ? (blockTimestamps.get(log.blockNumber) ?? Date.now()) : Date.now(),
        assets: Number(args.assets),
        shares: Number(args.shares),
        sender: args.owner,
        txHash: log.transactionHash,
      });
    }

    for (const log of rebalanceLogs) {
      const args = log.args as { totalAssetsBefore: bigint; totalAssetsAfter: bigint; timestamp: bigint };
      activities.push({
        type: 'rebalance',
        timestamp: Number(args.timestamp) * 1000,
        totalAssetsBefore: Number(args.totalAssetsBefore),
        totalAssetsAfter: Number(args.totalAssetsAfter),
        profit: Number(args.totalAssetsAfter - args.totalAssetsBefore),
        txHash: log.transactionHash,
      });
    }

    // Sort newest first, cap at 20
    activities.sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({ isDemo: false, activities: activities.slice(0, 20) });
  } catch (error) {
    console.error('Failed to fetch on-chain activity:', error);
    return NextResponse.json({ isDemo: true, activities: [], error: 'Could not fetch on-chain events.' });
  }
}
