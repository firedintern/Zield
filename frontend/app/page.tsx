'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Shield, Zap, RefreshCw, ArrowRight, Lock,
  TrendingUp, Eye, ChevronRight,
} from 'lucide-react';

/* ── Live stats from vault ───────────────────────────────────────── */

interface VaultStats {
  tvlUsd: number;
  strategyCount: number;
  blendedApy: number;
}

function useLiveStats(): VaultStats | null {
  const [stats, setStats] = useState<VaultStats | null>(null);
  useEffect(() => {
    fetch('/api/vault-state')
      .then(r => r.json())
      .then(d => {
        if (!d.configured || d.error) return;
        const blended = d.strategies?.reduce((acc: number, s: { apyBps: number; targetBps: number }) =>
          acc + (s.apyBps * s.targetBps) / 10000, 0) ?? 0;
        setStats({
          tvlUsd: d.totalAssetsUsd ?? 0,
          strategyCount: d.strategies?.length ?? 0,
          blendedApy: blended / 100,
        });
      })
      .catch(() => {});
  }, []);
  return stats;
}

/* ── Sub-components ──────────────────────────────────────────────── */

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-4 rounded-2xl"
      style={{ background: 'var(--z-bg-2)', border: '1px solid var(--z-border-strong)' }}>
      <span className="text-2xl font-bold" style={{ color: 'var(--z-accent)' }}>{value}</span>
      <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--z-text-tertiary)' }}>{label}</span>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div className="p-6 rounded-2xl flex flex-col gap-3"
      style={{ background: 'var(--z-bg-2)', border: '1px solid var(--z-border)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: 'var(--z-accent-soft)' }}>
        <Icon size={20} style={{ color: 'var(--z-accent)' }} />
      </div>
      <h3 className="font-semibold text-base" style={{ color: 'var(--z-text-primary)' }}>{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--z-text-secondary)' }}>{body}</p>
    </div>
  );
}

function RiskRow({ axis, score, label }: { axis: string; score: number; label: string }) {
  const width = `${score}%`;
  const color = score < 35 ? 'var(--z-risk-1)' : score < 55 ? 'var(--z-risk-2)' : score < 70 ? 'var(--z-risk-3)' : 'var(--z-risk-4)';
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-xs shrink-0" style={{ color: 'var(--z-text-tertiary)' }}>{axis}</span>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--z-border-strong)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width, background: color }} />
      </div>
      <span className="w-16 text-xs text-right" style={{ color: 'var(--z-text-secondary)' }}>{label}</span>
    </div>
  );
}

function StepCard({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-sm font-bold"
        style={{ background: 'var(--z-accent-soft)', color: 'var(--z-accent)' }}>
        {n}
      </div>
      <div className="flex flex-col gap-1">
        <h4 className="font-semibold text-sm" style={{ color: 'var(--z-text-primary)' }}>{title}</h4>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--z-text-secondary)' }}>{body}</p>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const stats = useLiveStats();

  const tvlDisplay = stats
    ? stats.tvlUsd < 1000
      ? `$${stats.tvlUsd.toFixed(2)}`
      : `$${(stats.tvlUsd / 1000).toFixed(1)}k`
    : '—';

  const apyDisplay = stats ? `${stats.blendedApy.toFixed(2)}%` : '—';
  const strategiesDisplay = stats ? `${stats.strategyCount}` : '—';

  return (
    <main style={{ background: 'var(--z-bg-0)', color: 'var(--z-text-primary)' }} className="min-h-screen">

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b flex items-center justify-between px-6 py-4"
        style={{ background: 'rgba(10,11,15,0.85)', backdropFilter: 'blur(16px)', borderColor: 'var(--z-border)' }}>
        <span className="font-bold text-lg tracking-tight" style={{ color: 'var(--z-accent)' }}>Zield</span>
        <div className="flex items-center gap-4">
          <a href="#how" className="text-sm hidden sm:block" style={{ color: 'var(--z-text-secondary)' }}>How it works</a>
          <a href="#risk" className="text-sm hidden sm:block" style={{ color: 'var(--z-text-secondary)' }}>Risk Engine</a>
          <Link href="/app"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:brightness-110"
            style={{ background: 'var(--z-accent)', color: '#0a0b0f' }}>
            Launch App <ArrowRight size={14} />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-20 px-6 text-center"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(45,212,167,0.09), transparent 70%)' }}>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-8"
          style={{ background: 'var(--z-accent-soft)', color: 'var(--z-accent)', border: '1px solid rgba(45,212,167,0.2)' }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--z-accent)' }} />
          Live on Base Sepolia — mainnet soon
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 max-w-3xl mx-auto leading-tight">
          Yield that knows<br />
          <span style={{ color: 'var(--z-accent)' }}>when to say no.</span>
        </h1>

        <p className="text-lg max-w-xl mx-auto mb-10 leading-relaxed" style={{ color: 'var(--z-text-secondary)' }}>
          Zield is a risk-aware USDC vault on Base. The keeper scores every opportunity across
          four risk axes — then allocates only where yield actually justifies the exposure.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
          <Link href="/app"
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-semibold text-sm transition-all hover:brightness-110"
            style={{ background: 'var(--z-accent)', color: '#0a0b0f' }}>
            Launch App <ChevronRight size={16} />
          </Link>
          <a href="#how"
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-semibold text-sm"
            style={{ background: 'var(--z-bg-2)', color: 'var(--z-text-primary)', border: '1px solid var(--z-border-strong)' }}>
            See how it works
          </a>
        </div>

        {/* Live stats bar */}
        <div className="flex flex-wrap justify-center gap-4">
          <StatPill label="Vault TVL" value={tvlDisplay} />
          <StatPill label="Blended APY" value={apyDisplay} />
          <StatPill label="Active Strategies" value={strategiesDisplay} />
          <StatPill label="Rebalance Cadence" value="6h" />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-3">Built different</h2>
        <p className="text-center mb-12 text-sm" style={{ color: 'var(--z-text-secondary)' }}>
          Most vaults chase the highest number. Zield chases the best risk-adjusted number.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard icon={Shield} title="4-Axis Risk Scoring"
            body="Every strategy is scored on smart contract risk, market risk, liquidity depth, and operational risk before a single dollar moves." />
          <FeatureCard icon={Eye} title="Live On-Chain Data"
            body="Aave v3 supply rates are read directly from the Base mainnet pool contract every cycle. No oracle assumptions, no stale feeds." />
          <FeatureCard icon={RefreshCw} title="Automated Rebalancing"
            body="A permissioned keeper calls rebalance() on-chain after the off-chain engine determines the allocation change justifies gas costs." />
          <FeatureCard icon={Lock} title="ERC-4626 Vault"
            body="Standard share token. Any protocol that integrates ERC-4626 (Morpho, Euler, treasuries) can treat zUSDC as a yield-bearing primitive." />
          <FeatureCard icon={TrendingUp} title="Performance Fee Only"
            body="Zield earns 10% of positive yield generated — nothing on deposits, nothing on withdrawals, nothing when the vault makes nothing." />
          <FeatureCard icon={Zap} title="Gas-Aware Decisions"
            body="The keeper computes estimated rebalance gas cost before execution. If net benefit < gas cost × safety margin, the rebalance is skipped." />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-3">How it works</h2>
        <p className="text-center mb-12 text-sm" style={{ color: 'var(--z-text-secondary)' }}>
          Five steps from deposit to optimized yield.
        </p>
        <div className="flex flex-col gap-8">
          <StepCard n={1} title="Deposit USDC"
            body="Approve and deposit USDC in one flow. You receive zUSDC share tokens representing your pro-rata slice of the vault." />
          <StepCard n={2} title="Engine scans protocols"
            body="Every cycle the risk engine reads live APY from Aave v3 on-chain and scans DefiLlama for emerging opportunities on Base." />
          <StepCard n={3} title="Risk scoring filters the list"
            body="Each candidate is scored 0-100 across smart contract, market, liquidity, and operational axes. Only opportunities passing the composite threshold proceed." />
          <StepCard n={4} title="Keeper executes allocation"
            body="The keeper calls rebalance() on-chain: withdraws from overweight strategies, deposits into underweight ones. All logic is verifiable on-chain." />
          <StepCard n={5} title="Yield accrues to your shares"
            body="As strategies earn yield, totalAssets() increases. Your shares redeem for more USDC than you deposited — no claiming required." />
        </div>
      </section>

      {/* Risk Engine explainer */}
      <section id="risk" className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-3">The Risk Engine</h2>
        <p className="text-center mb-12 text-sm" style={{ color: 'var(--z-text-secondary)' }}>
          A composite score across four independent axes. Lower is safer.
        </p>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="p-6 rounded-2xl flex flex-col gap-5"
            style={{ background: 'var(--z-bg-2)', border: '1px solid var(--z-border)' }}>
            <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--z-text-secondary)' }}>
              Example: Aave v3 USDC on Base
            </h3>
            <RiskRow axis="Smart Contract" score={18} label="Very Low" />
            <RiskRow axis="Market" score={12} label="Very Low" />
            <RiskRow axis="Liquidity" score={20} label="Low" />
            <RiskRow axis="Operational" score={15} label="Very Low" />
            <div className="pt-3 border-t" style={{ borderColor: 'var(--z-border)' }}>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--z-text-tertiary)' }}>Composite score</span>
                <span className="font-semibold" style={{ color: 'var(--z-risk-1)' }}>16 / 100 — Low</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-5">
            {[
              { title: 'Smart Contract Risk', body: 'Audit count, age, bug bounty, verified source. Protocols audited by multiple top firms score <20.' },
              { title: 'Market Risk', body: 'Stablecoin depeg exposure, collateral concentration, correlation to broader market drawdowns.' },
              { title: 'Liquidity Risk', body: "TVL depth vs. vault position size. A shallow pool can't support a large exit without significant slippage." },
              { title: 'Operational Risk', body: 'Admin key exposure, upgrade multisig quality, team track record, incident history.' },
            ].map(({ title, body }) => (
              <div key={title}>
                <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--z-text-primary)' }}>{title}</h4>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--z-text-secondary)' }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center px-6 py-24"
        style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 100%, rgba(45,212,167,0.07), transparent 70%)' }}>
        <h2 className="text-4xl font-bold mb-4">Ready to deposit?</h2>
        <p className="max-w-md mx-auto mb-8 text-sm leading-relaxed" style={{ color: 'var(--z-text-secondary)' }}>
          The vault is live on Base Sepolia. Connect MetaMask, get test USDC from the Base faucet, and watch the keeper work.
        </p>
        <Link href="/app"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold text-sm transition-all hover:brightness-110"
          style={{ background: 'var(--z-accent)', color: '#0a0b0f' }}>
          Launch App <ArrowRight size={16} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs"
        style={{ borderColor: 'var(--z-border)', color: 'var(--z-text-tertiary)' }}>
        <span>Zield — risk-aware yield on Base</span>
        <div className="flex gap-4">
          <Link href="/app" style={{ color: 'var(--z-text-tertiary)' }}>App</Link>
          <a href="https://github.com/firedintern" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--z-text-tertiary)' }}>GitHub</a>
        </div>
        <span>Testnet only. No audits. Use at your own risk.</span>
      </footer>
    </main>
  );
}
