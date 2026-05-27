import { NextResponse } from 'next/server';

// In the future this will call the real keeper service or run the optimizer logic server-side.
// For now it returns realistic data matching the keeper's current behavior.

export async function GET() {
  // This mirrors what a real call to the Zield keeper would return
  const decision = {
    timestamp: Date.now(),
    blendedAPY: 12.3,
    portfolioRisk: 31,
    tvlUsd: 2_480_000,
    expected7dProfit: 1240,
    gasCost: 28,
    netBenefitX: 44,
    decisions: [
      { name: 'Conservative Yield', target: 40, apy: 9.2, risk: 18, color: '#22c55e' },
      { name: 'Aave v3 USDC', target: 20, apy: 0.1, risk: 9, color: '#3b82f6' },
      { name: 'High Yield (Risk-capped)', target: 40, apy: 21.5, risk: 55, color: '#f59e0b' },
    ],
    liveSources: [
      'Aave v3 (on-chain)',
      'DefiLlama (Aerodrome pools)',
    ],
  };

  return NextResponse.json(decision);
}
