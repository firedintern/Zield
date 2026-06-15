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
]);

const STRATEGY_ABI = parseAbi([
  'function totalAssets() view returns (uint256)',
  'function estimatedAPY() view returns (uint256)',
  'function riskScore() view returns (uint8)',
  'function isActive() view returns (bool)',
]);

// Strategy name registry — maps address to human name for Sepolia mocks
const STRATEGY_NAMES: Record<string, string> = {
  '0x9b3ef0c9782fbbbb372fc09a03875ba259b57843': 'Mock Aave USDC',
  '0x52026b04664c28aaba8450e0ba5243e3f5d7eb83': 'Conservative Yield',
  '0xa9df4fc5d0d7bbff511275a7f43a6b83f14f8ef9': 'High Yield',
};

export async function GET() {
  if (!VAULT_ADDRESS || VAULT_ADDRESS === '0x0000000000000000000000000000000000000000') {
    return NextResponse.json({ configured: false });
  }

  try {
    const chain = CHAIN_ID === 84532 ? baseSepolia : base;
    const client = createPublicClient({ chain, transport: http(RPC_URL) });

    const totalAssets = await client.readContract({
      address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'totalAssets',
    });

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
        strategies.push({
          address: addr,
          name: STRATEGY_NAMES[addr.toLowerCase()] ?? `Strategy ${i + 1}`,
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
      strategies,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('[vault-state]', err);
    return NextResponse.json({ configured: true, error: err.message }, { status: 500 });
  }
}
