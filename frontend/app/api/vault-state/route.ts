import { NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi, type Address } from 'viem';
import { baseSepolia, base } from 'viem/chains';

const VAULT_ADDRESS = process.env.NEXT_PUBLIC_ZIELD_VAULT_ADDRESS as Address | undefined;
const CHAIN_ID = 84532;
const RPC_URL = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org';

const VAULT_ABI = parseAbi([
  'function totalAssets() view returns (uint256)',
  'function strategies(uint256 i) view returns (address)',
  'function targetAllocationBps(address) view returns (uint16)',
  'function totalFeesCollected() view returns (uint256)',
  'function performanceFeeBps() view returns (uint16)',
  'function lastRebalanceTotalAssets() view returns (uint256)',
]);

const STRATEGY_ABI = parseAbi([
  'function totalAssets() view returns (uint256)',
  'function estimatedAPY() view returns (uint256)',
  'function riskScore() view returns (uint8)',
  'function isActive() view returns (bool)',
]);

// Strategy name registry — maps deployed address to display name
const STRATEGY_NAMES: Record<string, { name: string; protocol: string }> = {
  '0x072287825f3535d37d5d3ccccc238e744d61d56b': { name: 'Aave v3 USDC (Simulated)', protocol: 'aave-v3' },
  '0xf4efb4b2a39abcc610fcb44e9650e673de76719b': { name: 'Conservative USDC', protocol: 'compound-v3' },
  '0x4f86a0e35fec4bfd16f308af60414ad724c64323': { name: 'High Yield USDC', protocol: 'moonwell' },
};

export async function GET() {
  if (!VAULT_ADDRESS || VAULT_ADDRESS === '0x0000000000000000000000000000000000000000') {
    return NextResponse.json({ configured: false });
  }

  try {
    const chain = CHAIN_ID === 84532 ? baseSepolia : base;
    const client = createPublicClient({ chain, transport: http(RPC_URL) });

    const [totalAssets, totalFeesCollected, performanceFeeBps, lastRebalanceTotalAssets] = await Promise.all([
      client.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'totalAssets' }),
      client.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'totalFeesCollected' }).catch(() => 0n),
      client.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'performanceFeeBps' }).catch(() => 1000n),
      client.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'lastRebalanceTotalAssets' }).catch(() => 0n),
    ]);

    const strategies = [];
    for (let i = 0; i < 10; i++) {
      try {
        const addr = await client.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'strategies', args: [BigInt(i)] });
        const [bps, stratAssets, apy, risk, active] = await Promise.all([
          client.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'targetAllocationBps', args: [addr] }),
          client.readContract({ address: addr, abi: STRATEGY_ABI, functionName: 'totalAssets' }),
          client.readContract({ address: addr, abi: STRATEGY_ABI, functionName: 'estimatedAPY' }),
          client.readContract({ address: addr, abi: STRATEGY_ABI, functionName: 'riskScore' }),
          client.readContract({ address: addr, abi: STRATEGY_ABI, functionName: 'isActive' }),
        ]);
        const meta = STRATEGY_NAMES[addr.toLowerCase()];
        strategies.push({
          address: addr,
          name: meta?.name ?? `Strategy ${i + 1}`,
          protocol: meta?.protocol ?? 'unknown',
          targetBps: Number(bps),
          targetPct: Number(bps) / 100,
          currentAssets: Number(stratAssets),
          apyBps: Number(apy),
          apyPct: Number(apy) / 100,
          riskScore: Number(risk),
          isActive: active,
        });
      } catch { break; }
    }

    return NextResponse.json({
      configured: true,
      totalAssets: Number(totalAssets),
      totalAssetsUsd: Number(totalAssets) / 1e6,
      totalFeesCollected: Number(totalFeesCollected),
      totalFeesCollectedUsd: Number(totalFeesCollected) / 1e6,
      performanceFeeBps: Number(performanceFeeBps),
      lastRebalanceTotalAssets: Number(lastRebalanceTotalAssets),
      strategies,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('[vault-state]', err);
    return NextResponse.json({ configured: true, error: err.message }, { status: 500 });
  }
}
