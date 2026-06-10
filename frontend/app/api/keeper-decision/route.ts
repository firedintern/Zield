import { NextResponse } from 'next/server';
import { getKeeperDecision } from '../../../lib/engine';

// Live decision computed from real on-chain + market data (cached ~2 min in the engine).
export async function GET() {
  try {
    const decision = await getKeeperDecision();
    return NextResponse.json(decision);
  } catch (error) {
    console.error('[keeper-decision] engine failed:', error);
    return NextResponse.json(
      { error: 'Decision engine unavailable. Upstream data sources may be down.' },
      { status: 503 },
    );
  }
}
