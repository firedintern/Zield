'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, Shield, Zap, RefreshCw, Lock, TrendingUp, Eye, ChevronRight, ArrowUpRight } from 'lucide-react';

/* ── Scroll-reveal hook ─────────────────────────────────────────── */

function useReveal(rootMargin = '-60px') {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('z-revealed'); obs.disconnect(); } },
      { rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin]);
  return ref;
}

/* ── Animated counter ───────────────────────────────────────────── */

function useCounter(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  const started = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || started.current) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || started.current) return;
      started.current = true;
      obs.disconnect();
      const start = performance.now();
      const animate = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        setValue(Math.round(ease * target));
        if (t < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, { rootMargin: '-40px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);

  return { ref, value };
}

/* ── Live stats ─────────────────────────────────────────────────── */

interface VaultStats { tvlUsd: number; strategyCount: number; blendedApy: number }

function useLiveStats(): VaultStats | null {
  const [stats, setStats] = useState<VaultStats | null>(null);
  useEffect(() => {
    fetch('/api/vault-state').then(r => r.json()).then(d => {
      if (!d.configured || d.error) return;
      const blended = d.strategies?.reduce((acc: number, s: { apyBps: number; targetBps: number }) =>
        acc + (s.apyBps * s.targetBps) / 10000, 0) ?? 0;
      setStats({ tvlUsd: d.totalAssetsUsd ?? 0, strategyCount: d.strategies?.length ?? 0, blendedApy: blended / 100 });
    }).catch(() => {});
  }, []);
  return stats;
}

/* ── Vault UI mock — the "product screenshot" ───────────────────── */

function VaultMock({ stats }: { stats: VaultStats | null }) {
  const apy = stats?.blendedApy ?? 4.20;
  const risk = 18;
  const strategies = [
    { name: 'Aave v3 USDC', pct: 50, apy: 4.2, color: '#5683da' },
    { name: 'Moonwell USDC', pct: 30, apy: 5.1, color: '#ff8964' },
    { name: 'Extra Finance', pct: 20, apy: 6.8, color: '#a78bfa' },
  ];

  return (
    <div className="relative select-none" style={{ filter: 'drop-shadow(0 32px 64px rgba(0,0,0,0.7))' }}>
      {/* Outer glow ring */}
      <div className="absolute -inset-px rounded-2xl pointer-events-none"
        style={{ background: 'linear-gradient(135deg, rgba(86,131,218,0.4) 0%, rgba(255,137,100,0.2) 100%)', borderRadius: 18 }} />

      {/* App window frame */}
      <div className="relative overflow-hidden" style={{
        background: '#0d0e11',
        border: '1px solid rgba(74,75,80,0.8)',
        borderRadius: 16,
        width: '100%',
        maxWidth: 480,
      }}>
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(74,75,80,0.5)', background: '#0a0b0e' }}>
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
            <span className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }} />
            <span className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
          </div>
          <span className="flex-1 text-center text-xs font-mono" style={{ color: 'rgba(149,151,158,0.6)', fontSize: 11 }}>
            zield.app — vault dashboard
          </span>
        </div>

        {/* App header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(74,75,80,0.3)' }}>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
              style={{ background: '#5683da', color: '#fff', fontSize: 9 }}>Z</div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Zield</span>
            <span style={{ fontSize: 9, color: '#5683da', background: 'rgba(86,131,218,0.12)', padding: '1px 6px', borderRadius: 9999, border: '1px solid rgba(86,131,218,0.2)', fontWeight: 500 }}>BETA</span>
          </div>
          <div className="flex items-center gap-1.5" style={{ fontSize: 10, color: '#5683da' }}>
            <span className="z-live-dot" style={{ width: 5, height: 5 }} />
            Live · Base
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Top stat row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl" style={{ background: '#111111', border: '1px solid rgba(74,75,80,0.5)' }}>
              <div style={{ fontSize: 9, color: '#6b6c6d', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 500 }}>Blended APY</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#5683da', letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {apy.toFixed(2)}<span style={{ fontSize: 14, color: 'rgba(86,131,218,0.5)', marginLeft: 1 }}>%</span>
              </div>
              <div style={{ fontSize: 9, color: '#6b6c6d', marginTop: 4 }}>{strategies.length} strategies</div>
            </div>
            <div className="p-4 rounded-xl" style={{ background: '#111111', border: '1px solid rgba(74,75,80,0.5)' }}>
              <div style={{ fontSize: 9, color: '#6b6c6d', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontWeight: 500 }}>Portfolio Risk</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#34d399', letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {risk}<span style={{ fontSize: 14, color: 'rgba(52,211,153,0.5)', marginLeft: 1 }}>/100</span>
              </div>
              <div style={{ fontSize: 9, color: '#34d399', marginTop: 4 }}>Low Risk</div>
            </div>
          </div>

          {/* Allocation bar */}
          <div>
            <div style={{ fontSize: 10, color: '#6b6c6d', marginBottom: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Allocation</div>
            <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full mb-3" style={{ background: 'rgba(74,75,80,0.3)' }}>
              {strategies.map(s => (
                <div key={s.name} className="h-full rounded-full"
                  style={{ width: `${s.pct}%`, background: s.color, transition: 'width 1s ease' }} />
              ))}
            </div>

            {/* Strategy rows */}
            <div className="space-y-2">
              {strategies.map(s => (
                <div key={s.name} className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                  style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(74,75,80,0.3)' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-5 rounded-full" style={{ background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#d1d1d1' }}>{s.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: 10, color: s.color, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{s.apy}%</span>
                    <span style={{ fontSize: 10, color: '#6b6c6d', fontVariantNumeric: 'tabular-nums' }}>{s.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deposit button mock */}
          <div className="rounded-full py-3 text-center text-sm font-semibold"
            style={{ background: '#5683da', color: '#fff', fontSize: 12 }}>
            Deposit USDC
          </div>
        </div>

        {/* Bottom keeper badge */}
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg"
            style={{ background: 'rgba(86,131,218,0.06)', border: '1px solid rgba(86,131,218,0.15)' }}>
            <div className="flex items-center gap-2">
              <Zap size={10} style={{ color: '#5683da' }} />
              <span style={{ fontSize: 10, color: '#95979e' }}>Keeper last ran</span>
            </div>
            <span style={{ fontSize: 10, color: '#5683da', fontVariantNumeric: 'tabular-nums' }}>2m ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Feature card ───────────────────────────────────────────────── */

function FeatureCard({ icon: Icon, title, body, glow, delay = 0 }: {
  icon: React.ElementType; title: string; body: string; glow?: 'iris' | 'ember'; delay?: number
}) {
  const ref = useReveal();
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>}
      className="z-feature-card z-reveal z-card-lift relative overflow-hidden flex flex-col gap-4 p-6"
      style={{ transitionDelay: `${delay}ms` }}>
      {glow === 'iris' && (
        <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(86,131,218,0.18) 0%, transparent 70%)' }} />
      )}
      {glow === 'ember' && (
        <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,137,100,0.18) 0%, transparent 70%)' }} />
      )}
      <div className="w-9 h-9 rounded-xl flex items-center justify-center relative z-10"
        style={{ background: glow === 'ember' ? 'var(--color-ember-soft)' : 'var(--color-iris-soft)' }}>
        <Icon size={16} style={{ color: glow === 'ember' ? 'var(--color-ember-pulse)' : 'var(--color-electric-iris)' }} />
      </div>
      <div className="relative z-10">
        <h3 className="font-semibold mb-1.5" style={{ color: 'var(--color-snow)', fontSize: 15 }}>{title}</h3>
        <p style={{ color: 'var(--color-ash)', fontSize: 13, lineHeight: 1.6 }}>{body}</p>
      </div>
    </div>
  );
}

/* ── Step row ────────────────────────────────────────────────────── */

function StepRow({ n, title, body, delay = 0 }: { n: number; title: string; body: string; delay?: number }) {
  const ref = useReveal();
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="z-reveal flex gap-5" style={{ transitionDelay: `${delay}ms` }}>
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5"
        style={{ background: 'var(--color-iris-soft)', color: 'var(--color-electric-iris)', border: '1px solid rgba(86,131,218,0.3)' }}>
        {n}
      </div>
      <div className="pb-8 border-b last:border-b-0" style={{ borderColor: 'var(--border)', flex: 1 }}>
        <div className="font-semibold mb-1" style={{ color: 'var(--color-snow)', fontSize: 15 }}>{title}</div>
        <div style={{ color: 'var(--color-ash)', fontSize: 14, lineHeight: 1.6 }}>{body}</div>
      </div>
    </div>
  );
}

/* ── Animated risk axis bar ─────────────────────────────────────── */

function RiskAxisRow({ label, score, desc, delay = 0 }: {
  label: string; score: number; desc: string; delay?: number
}) {
  const [animated, setAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const color = score < 30 ? 'var(--risk-low)' : score < 55 ? 'var(--risk-mid)' : 'var(--risk-high)';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setTimeout(() => setAnimated(true), delay); obs.disconnect(); }
    }, { rootMargin: '-40px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span style={{ color: 'var(--color-snow)', fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span className="z-num font-mono" style={{ color, fontSize: 12 }}>{score}/100</span>
      </div>
      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--border-strong)' }}>
        <div className="h-full rounded-full"
          style={{ width: animated ? `${score}%` : '0%', background: color, transition: 'width 1s cubic-bezier(0.2,0.8,0.2,1)' }} />
      </div>
      <div style={{ color: 'var(--color-iron-veil)', fontSize: 11 }}>{desc}</div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const stats = useLiveStats();
  const heroTextRef = useReveal('-20px');
  const heroMockRef = useReveal('-20px');

  return (
    <main style={{ background: 'var(--color-obsidian-canvas)', color: 'var(--color-snow)', fontFamily: 'var(--font-inter)' }}>

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 sm:px-10 py-4"
        style={{ background: 'rgba(48,50,54,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{ background: 'var(--color-electric-iris)', color: '#fff' }}>Z</div>
          <span className="font-semibold text-base tracking-tight" style={{ color: 'var(--color-snow)' }}>Zield</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#how" className="text-sm hidden sm:block transition-colors hover:text-white"
            style={{ color: 'var(--color-smoke)' }}>How it works</a>
          <a href="#risk" className="text-sm hidden sm:block transition-colors hover:text-white"
            style={{ color: 'var(--color-smoke)' }}>Risk engine</a>
          <Link href="/app" className="z-btn z-btn-primary px-5 py-2 text-sm">
            Launch App <ArrowRight size={13} />
          </Link>
        </div>
      </nav>

      {/* ── Hero — Huly split layout ─────────────────────────────────── */}
      {/*
       * Left: headline + CTAs + live stats
       * Right: floating vault UI mock
       * Behind both: dramatic aurora beam (CSS via .aurora-bg)
       */}
      <section className="aurora-bg relative overflow-hidden min-h-[90vh] flex items-center">
        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 sm:px-10 py-24 sm:py-32">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left — text */}
            <div ref={heroTextRef as React.RefObject<HTMLDivElement>} className="z-reveal">
              {/* Live badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-8"
                style={{ background: 'rgba(86,131,218,0.10)', color: 'var(--color-electric-iris)', border: '1px solid rgba(86,131,218,0.25)' }}>
                <span className="z-live-dot" />
                Live on Base Sepolia
                <span style={{ color: 'var(--color-iron-veil)' }}>·</span>
                <span style={{ color: 'var(--color-smoke)' }}>Mainnet soon</span>
              </div>

              <h1 className="display-heading mb-6" style={{ fontSize: 'clamp(48px, 6vw, 80px)', color: 'var(--color-snow)' }}>
                Yield that<br />
                knows when<br />
                <span className="z-gradient-text">to say no.</span>
              </h1>

              <p className="mb-10 leading-relaxed"
                style={{ fontSize: 17, maxWidth: 480, color: 'var(--color-ash)', fontWeight: 300, letterSpacing: '-0.01em' }}>
                A risk-aware USDC vault on Base. The keeper scores every opportunity across
                four axes — and only allocates where yield justifies the exposure.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap gap-3 mb-12">
                <Link href="/app" className="z-btn z-btn-primary px-7 py-3.5 text-sm font-semibold">
                  Launch App <ArrowUpRight size={15} />
                </Link>
                <a href="#how" className="z-btn z-btn-ghost px-7 py-3.5 text-sm">
                  See how it works
                </a>
              </div>

              {/* Inline stats */}
              <div className="flex flex-wrap gap-6">
                {[
                  { label: 'Blended APY', value: stats ? `${stats.blendedApy.toFixed(2)}%` : '—', color: 'var(--color-electric-iris)' },
                  { label: 'Risk Score', value: '18/100', color: 'var(--risk-low)' },
                  { label: 'Strategies', value: stats ? `${stats.strategyCount}` : '3', color: 'var(--color-snow)' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="z-num font-mono text-2xl font-semibold" style={{ color, letterSpacing: '-0.02em' }}>{value}</div>
                    <div className="z-label mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — vault UI mock */}
            <div ref={heroMockRef as React.RefObject<HTMLDivElement>}
              className="z-reveal z-reveal-d2 hidden lg:flex justify-center items-center">
              <VaultMock stats={stats} />
            </div>
          </div>
        </div>

        {/* Bottom fade into canvas */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-40"
          style={{ background: 'linear-gradient(to bottom, transparent, var(--color-obsidian-canvas))' }} />
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 sm:px-10 py-24">
        <div className="z-reveal text-center mb-14" ref={useReveal() as React.RefObject<HTMLDivElement>}>
          <h2 className="display-heading-sm mb-4" style={{ fontSize: 'clamp(32px, 4vw, 48px)', color: 'var(--color-snow)' }}>
            Built different
          </h2>
          <p style={{ color: 'var(--color-ash)', fontSize: 15, maxWidth: 480, margin: '0 auto' }}>
            Most vaults chase the highest number. Zield chases the best risk-adjusted number.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <FeatureCard delay={0}   glow="iris"  icon={Shield}     title="4-Axis Risk Scoring"
            body="Every strategy is scored on smart contract risk, market risk, liquidity depth, and operational risk before a single dollar moves." />
          <FeatureCard delay={80}  glow="iris"  icon={Eye}        title="Live On-Chain Data"
            body="Aave v3 supply rates are read directly from the Base mainnet pool contract every cycle. No oracle assumptions, no stale feeds." />
          <FeatureCard delay={160} glow="ember" icon={RefreshCw}  title="Automated Rebalancing"
            body="A permissioned keeper calls rebalance() on-chain after the off-chain engine determines the allocation change justifies gas costs." />
          <FeatureCard delay={240} glow="iris"  icon={Lock}       title="ERC-4626 Vault"
            body="Standard share token. Any protocol that integrates ERC-4626 (Morpho, Euler, treasuries) can treat zUSDC as a yield-bearing primitive." />
          <FeatureCard delay={320} glow="ember" icon={TrendingUp} title="Performance Fee Only"
            body="Zield earns 10% of positive yield — nothing on deposits, nothing on withdrawals, nothing when the vault makes nothing." />
          <FeatureCard delay={400} glow="iris"  icon={Zap}        title="Gas-Aware Decisions"
            body="The keeper computes rebalance gas cost before execution. If net benefit is below the safety margin, the rebalance is skipped." />
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how" className="px-6 sm:px-10 py-24"
        style={{ background: 'var(--color-charcoal-card)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-2xl mx-auto">
          <div className="z-reveal text-center mb-14" ref={useReveal() as React.RefObject<HTMLDivElement>}>
            <h2 className="display-heading-sm mb-4" style={{ fontSize: 'clamp(32px, 4vw, 48px)', color: 'var(--color-snow)' }}>
              How it works
            </h2>
            <p style={{ color: 'var(--color-ash)', fontSize: 15 }}>Five steps from deposit to optimized yield.</p>
          </div>
          <div className="flex flex-col">
            <StepRow delay={0}   n={1} title="Deposit USDC"
              body="Approve and deposit in one flow. You receive zUSDC share tokens representing your pro-rata slice of the vault." />
            <StepRow delay={100} n={2} title="Engine scans protocols"
              body="The risk engine reads live APY from Aave v3 on-chain and scans DefiLlama for emerging opportunities on Base." />
            <StepRow delay={200} n={3} title="Risk scoring filters the list"
              body="Each candidate is scored 0–100 across four axes. Only opportunities passing the composite threshold proceed." />
            <StepRow delay={300} n={4} title="Keeper executes allocation"
              body="The keeper calls rebalance() on-chain: withdraws from overweight strategies, deposits into underweight ones. Fully verifiable." />
            <StepRow delay={400} n={5} title="Yield accrues to your shares"
              body="As strategies earn yield, totalAssets() grows. Your shares redeem for more USDC than you deposited — no claiming required." />
          </div>
        </div>
      </section>

      {/* ── Risk Engine ──────────────────────────────────────────────── */}
      <section id="risk" className="max-w-5xl mx-auto px-6 sm:px-10 py-24">
        <div className="z-reveal text-center mb-14" ref={useReveal() as React.RefObject<HTMLDivElement>}>
          <h2 className="display-heading-sm mb-4" style={{ fontSize: 'clamp(32px, 4vw, 48px)', color: 'var(--color-snow)' }}>
            The Risk Engine
          </h2>
          <p style={{ color: 'var(--color-ash)', fontSize: 15, maxWidth: 440, margin: '0 auto' }}>
            A composite score across four independent axes. Lower is safer.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="z-card z-reveal p-7 flex flex-col gap-6" ref={useReveal() as React.RefObject<HTMLDivElement>}>
            <div>
              <div className="z-label mb-0.5">Example — Aave v3 USDC on Base</div>
              <div className="font-semibold" style={{ color: 'var(--color-snow)', fontSize: 15 }}>Composite score: 16 / 100</div>
            </div>
            <div className="flex flex-col gap-5">
              <RiskAxisRow delay={0}   label="Smart Contract" score={18} desc="3 audits, 2yr live, $1M bug bounty" />
              <RiskAxisRow delay={120} label="Market"         score={12} desc="Pure USDC, minimal depeg exposure" />
              <RiskAxisRow delay={240} label="Liquidity"      score={20} desc="$200M+ pool depth on Base" />
              <RiskAxisRow delay={360} label="Operational"    score={15} desc="3/5 multisig, open-source, no incidents" />
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-full self-start"
              style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--risk-low)' }} />
              <span style={{ color: 'var(--risk-low)', fontSize: 12, fontWeight: 500 }}>Low Risk — Approved</span>
            </div>
          </div>

          <div className="z-reveal flex flex-col gap-5 py-2" ref={useReveal('-40px') as React.RefObject<HTMLDivElement>}>
            {[
              { title: 'Smart Contract Risk', body: 'Audit count, age, bug bounty size, verified source code. Protocols with 3+ audits from top firms score below 25.' },
              { title: 'Market Risk', body: 'Stablecoin depeg exposure, collateral concentration, and correlation to broader market drawdowns.' },
              { title: 'Liquidity Risk', body: "TVL depth vs. vault position size. A shallow pool can't support a large exit without significant slippage." },
              { title: 'Operational Risk', body: 'Admin key exposure, upgrade multisig quality, team track record, incident history.' },
            ].map(({ title, body }) => (
              <div key={title} className="pb-5 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                <div className="font-semibold mb-1" style={{ color: 'var(--color-snow)', fontSize: 14 }}>{title}</div>
                <div style={{ color: 'var(--color-ash)', fontSize: 13, lineHeight: 1.6 }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA band ─────────────────────────────────────────────────── */}
      <section className="text-center px-6 py-28 relative overflow-hidden"
        style={{ background: 'var(--color-charcoal-card)', borderTop: '1px solid var(--border)' }}>
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-60"
          style={{ background: 'radial-gradient(ellipse 60% 80% at 50% 0%, rgba(86,131,218,0.12) 0%, transparent 70%)' }} />

        <div className="z-reveal relative z-10" ref={useReveal() as React.RefObject<HTMLDivElement>}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-8"
            style={{ background: 'rgba(255,137,100,0.08)', color: 'var(--color-ember-pulse)', border: '1px solid rgba(255,137,100,0.25)' }}>
            <span className="z-ember-dot" />
            Base Sepolia testnet — mainnet coming
          </div>
          <h2 className="display-heading-sm mx-auto mb-6"
            style={{ fontSize: 'clamp(36px, 5vw, 56px)', maxWidth: 600, color: 'var(--color-snow)' }}>
            Ready to earn smarter yield?
          </h2>
          <p className="mx-auto mb-10" style={{ color: 'var(--color-ash)', fontSize: 15, maxWidth: 400 }}>
            Connect MetaMask, get test USDC from the Base faucet, and watch the keeper allocate in real time.
          </p>
          <Link href="/app" className="z-btn z-btn-primary px-8 py-4 text-sm font-semibold">
            Launch App <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 sm:px-10 py-7 text-xs"
        style={{ background: 'var(--color-obsidian-canvas)', borderTop: '1px solid var(--border)', color: 'var(--color-iron-veil)' }}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
            style={{ background: 'var(--color-electric-iris)', color: '#fff' }}>Z</div>
          <span>Zield — risk-aware yield on Base</span>
        </div>
        <div className="flex gap-5">
          <Link href="/app" className="hover:text-white transition-colors">App</Link>
          <a href="https://github.com/firedintern" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
        </div>
        <span>Testnet only · No audits · Not financial advice</span>
      </footer>
    </main>
  );
}
