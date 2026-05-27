import { createPublicClient, http, parseAbi, type Address } from 'viem';
import { base } from 'viem/chains';

/**
 * Real data fetcher for Aave v3 USDC supply APY on Base (MVP simplified version).
 *
 * Uses a minimal ABI to avoid complex tuple parsing issues.
 */

const AAVE_V3_POOL = '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5' as Address;

const MINIMAL_POOL_ABI = parseAbi([
  'function getReserveData(address asset) external view returns (uint256, uint128, uint128, uint128, uint128, uint128, uint40, uint16, address, address, address, address, uint128, uint128, uint128)',
]);

const RAY = 10n ** 27n;

export async function fetchAaveUsdcSupplyApyBps(rpcUrl?: string): Promise<number> {
  const client = createPublicClient({
    chain: base,
    transport: http(rpcUrl || 'https://mainnet.base.org'),
  });

  const reserve = await client.readContract({
    address: AAVE_V3_POOL,
    abi: MINIMAL_POOL_ABI,
    functionName: 'getReserveData',
    args: ['0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'],
  });

  const liquidityRate = reserve[2]; // index 2 = currentLiquidityRate

  const secondsPerYear = 31536000n;
  const apyRay = (liquidityRate * secondsPerYear) / RAY;
  const apyBps = Number(apyRay) / 1e23;

  return Math.max(10, Math.round(apyBps)); // never return 0 in MVP
}

