import { NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http, parseAbi, type Address } from 'viem';
import { baseSepolia, base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const VAULT_ADDRESS = process.env.NEXT_PUBLIC_ZIELD_VAULT_ADDRESS as Address | undefined;
const KEEPER_PK = process.env.KEEPER_PRIVATE_KEY as `0x${string}` | undefined;
const CHAIN_ID = 84532;
const RPC_URL = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org';

const VAULT_ABI = parseAbi([
  'function rebalance() external',
  'function totalAssets() view returns (uint256)',
  'function strategies(uint256 i) view returns (address)',
  'function targetAllocationBps(address) view returns (uint16)',
]);

const STRATEGY_ABI = parseAbi([
  'function totalAssets() view returns (uint256)',
  'function estimatedAPY() view returns (uint256)',
  'function riskScore() view returns (uint8)',
]);

// Vercel Cron: only allow requests from Vercel infra or with the cron secret
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev mode — no secret required
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!VAULT_ADDRESS || VAULT_ADDRESS === '0x0000000000000000000000000000000000000000') {
    return NextResponse.json({ error: 'NEXT_PUBLIC_ZIELD_VAULT_ADDRESS not configured' }, { status: 400 });
  }
  if (!KEEPER_PK) {
    return NextResponse.json({ error: 'KEEPER_PRIVATE_KEY not configured' }, { status: 400 });
  }

  const chain = CHAIN_ID === 84532 ? baseSepolia : base;
  const account = privateKeyToAccount(KEEPER_PK);

  const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain, transport: http(RPC_URL) });

  try {
    // Read pre-rebalance state
    const tvlBefore = await publicClient.readContract({
      address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'totalAssets',
    });

    // Read strategies and their current allocations
    const strategyData: Array<{ address: string; targetBps: number; assetsBefore: bigint; apyBps: number; riskScore: number }> = [];
    for (let i = 0; i < 10; i++) {
      try {
        const stratAddr = await publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'strategies', args: [BigInt(i)] });
        const [bps, assets, apy, risk] = await Promise.all([
          publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'targetAllocationBps', args: [stratAddr] }),
          publicClient.readContract({ address: stratAddr, abi: STRATEGY_ABI, functionName: 'totalAssets' }),
          publicClient.readContract({ address: stratAddr, abi: STRATEGY_ABI, functionName: 'estimatedAPY' }),
          publicClient.readContract({ address: stratAddr, abi: STRATEGY_ABI, functionName: 'riskScore' }),
        ]);
        strategyData.push({ address: stratAddr, targetBps: Number(bps), assetsBefore: assets as bigint, apyBps: Number(apy), riskScore: Number(risk) });
      } catch { break; }
    }

    // Execute rebalance
    const hash = await walletClient.writeContract({
      address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'rebalance',
    });

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });

    const tvlAfter = await publicClient.readContract({
      address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'totalAssets',
    });

    return NextResponse.json({
      success: true,
      txHash: hash,
      status: receipt.status,
      tvlBefore: Number(tvlBefore),
      tvlAfter: Number(tvlAfter),
      strategies: strategyData.map(s => ({
        address: s.address,
        targetPct: s.targetBps / 100,
        apyBps: s.apyBps,
        riskScore: s.riskScore,
      })),
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('[keeper-run] rebalance failed:', err);
    return NextResponse.json(
      { error: err?.shortMessage || err?.message || 'Rebalance failed' },
      { status: 500 },
    );
  }
}
