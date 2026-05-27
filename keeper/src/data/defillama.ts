import type { StrategySnapshot } from '../types.js';

/**
 * DefiLlama Yields API integration (MVP)
 * Gives us real, broad yield data across Base protocols.
 */

const YIELDS_API = 'https://yields.llama.fi/pools';

interface LlamaPool {
  chain: string;
  project: string;
  symbol: string;
  apy: number;
  tvlUsd: number;
  pool: string;
}

export async function fetchTopBaseStableYields(limit = 8): Promise<any[]> {
  try {
    const res = await fetch(YIELDS_API);
    const data = await res.json();

    const baseStables = (data.data as LlamaPool[])
      .filter(p =>
        p.chain === 'Base' &&
        (p.symbol.includes('USDC') || p.symbol.includes('USDT') || p.symbol.includes('DAI')) &&
        p.tvlUsd > 500_000
      )
      .sort((a, b) => b.apy - a.apy)
      .slice(0, limit);

    return baseStables.map(p => ({
      name: `${p.project} ${p.symbol}`,
      apyBps: Math.round(p.apy * 100),
      tvlUsd: p.tvlUsd,
      source: 'defillama',
    }));
  } catch (e) {
    console.warn('[DefiLlama] Failed to fetch yields, returning empty');
    return [];
  }
}
