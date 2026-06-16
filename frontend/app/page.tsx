'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, Shield, Zap, RefreshCw, Lock, TrendingUp, Eye, ChevronRight } from 'lucide-react';

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

function useCounter(target: number, duration = 1200) {
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

/* ── Stat card with counter animation ──────────────────────────── */

function StatCard({ label, rawValue, prefix = '', suffix = '', sub }: {
  label: string; rawValue: number; prefix?: string; suffix?: string; sub?: string
}) {
  const { ref, value } = useCounter(Math.round(rawValue * 100));
  const display = rawValue === 0 ? '—' : `${prefix}${(value / 100).toFixed(rawValue < 10 ? 2 : 0)}${suffix}`;

  return (
    <div className="z-card z-card-lift z-reveal flex flex-col gap-1 px-6 py-5 min-w-[140px]">
      <span ref={ref} className="z-num z-count-in text-3xl font-semibold"
        style={{ color: 'var(--color-snow)', letterSpacing: '-0.03em' }}>
        {display}
      </span>
      <span className="z-label">{label}</span>
      {sub && <span style={{ color: 'var(--color-iron-veil)', fontSize: 11 }}>{sub}</span>}
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
        <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full transition-all duration-500"
          style={{ background: 'radial-gradient(circle, rgba(86,131,218,0.20) 0%, transparent 70%)' }} />
      )}
      {glow === 'ember' && (
        <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full transition-all duration-500"
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
    <div ref={ref as React.RefObject<HTMLDivElement>}
      className="z-reveal flex gap-5"
      style={{ transitionDelay: `${delay}ms` }}>
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

/* ── Risk axis row with animated bar ────────────────────────────── */

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
  const heroRef = useRef<HTMLDivElement>(null);
  const heroTextRef = useReveal('-20px');

  const tvlRaw = stats?.tvlUsd ?? 0;
  const apyRaw = stats?.blendedApy ?? 0;
  const stratsRaw = stats?.strategyCount ?? 0;

  /* Parallax on scroll for aurora beam */
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const onScroll = () => {
      const y = window.scrollY;
      hero.style.setProperty('--parallax-y', `${y * 0.35}px`);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

      {/* ── Hero — full aurora ───────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="aurora-bg relative overflow-hidden pt-32 pb-28 px-6 sm:px-10 text-center"
        style={{ '--parallax-y': '0px' } as React.CSSProperties}>

        {/* Hero content fades up */}
        <div ref={heroTextRef as React.RefObject<HTMLDivElement>} className="z-reveal relative z-10">
          {/* Live badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-10"
            style={{ background: 'rgba(86,131,218,0.10)', color: 'var(--color-electric-iris)', border: '1px solid rgba(86,131,218,0.25)' }}>
            <span className="z-live-dot" />
            Live on Base Sepolia
            <span style={{ color: 'var(--color-iron-veil)' }}>·</span>
            <span style={{ color: 'var(--color-smoke)' }}>Mainnet soon</span>
          </div>

          {/* Headline — display-heading at full Huly scale */}
          <h1 className="display-heading mx-auto mb-6"
            style={{ fontSize: 'clamp(52px, 8vw, 84px)', maxWidth: 820, color: 'var(--color-snow)' }}>
            Yield that knows<br />
            <span className="z-gradient-text">when to say no.</span>
          </h1>

          <p className="mx-auto mb-12 leading-relaxed"
            style={{ fontSize: 17, maxWidth: 520, color: 'var(--color-ash)', fontWeight: 300, letterSpacing: '-0.01em' }}>
            Zield is a risk-aware USDC vault on Base. The keeper scores every opportunity
            across four risk axes — then allocates only where yield justifies the exposure.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
            <Link href="/app" className="z-btn z-btn-primary px-8 py-3.5 text-sm font-semibold">
              Launch App <ChevronRight size={15} />
            </Link>
            <a href="#how" className="z-btn z-btn-ghost px-8 py-3.5 text-sm">
              See how it works
            </a>
          </div>

          {/* Live stats — animated counters */}
          <div className="flex flex-wrap justify-center gap-3">
            <StatCard label="Vault TVL" rawValue={tvlRaw} prefix="$" />
            <StatCard label="Blended APY" rawValue={apyRaw} suffix="%" />
            <StatCard label="Strategies" rawValue={stratsRaw} />
            <div className="z-card z-card-lift flex flex-col gap-1 px-6 py-5 min-w-[140px]">
              <span className="z-num text-3xl font-semibold" style={{ color: 'var(--color-snow)', letterSpacing: '-0.03em' }}>Daily</span>
              <span className="z-label">Rebalance</span>
              <span style={{ color: 'var(--color-iron-veil)', fontSize: 11 }}>Keeper-driven</span>
            </div>
          </div>
        </div>

        {/* Bottom fade into canvas */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32"
          style={{ background: 'linear-gradient(to bottom, transparent, var(--color-obsidian-canvas))' }} />
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 sm:px-10 py-24">
        <div className="text-center mb-14 z-reveal" ref={useReveal() as React.RefObject<HTMLDivElement>}>
          <h2 className="display-heading-sm mb-4" style={{ fontSize: 'clamp(32px, 4vw, 48px)', color: 'var(--color-snow)' }}>
            Built different
          </h2>
          <p style={{ color: 'var(--color-ash)', fontSize: 15, maxWidth: 480, margin: '0 auto' }}>
            Most vaults chase the highest number. Zield chases the best risk-adjusted number.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <FeatureCard delay={0}   glow="iris"  icon={Shield}    title="4-Axis Risk Scoring"
            body="Every strategy is scored on smart contract risk, market risk, liquidity depth, and operational risk before a single dollar moves." />
          <FeatureCard delay={80}  glow="iris"  icon={Eye}       title="Live On-Chain Data"
            body="Aave v3 supply rates are read directly from the Base mainnet pool contract every cycle. No oracle assumptions, no stale feeds." />
          <FeatureCard delay={160} glow="ember" icon={RefreshCw} title="Automated Rebalancing"
            body="A permissioned keeper calls rebalance() on-chain after the off-chain engine determines the allocation change justifies gas costs." />
          <FeatureCard delay={240} glow="iris"  icon={Lock}      title="ERC-4626 Vault"
            body="Standard share token. Any protocol that integrates ERC-4626 (Morpho, Euler, treasuries) can treat zUSDC as a yield-bearing primitive." />
          <FeatureCard delay={320} glow="ember" icon={TrendingUp} title="Performance Fee Only"
            body="Zield earns 10% of positive yield — nothing on deposits, nothing on withdrawals, nothing when the vault makes nothing." />
          <FeatureCard delay={400} glow="iris"  icon={Zap}       title="Gas-Aware Decisions"
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
          {/* Score card */}
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

          {/* Axis descriptions */}
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
        {/* Subtle iris glow at top */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48"
          style={{ background: 'radial-gradient(ellipse 60% 80% at 50% 0%, rgba(86,131,218,0.15) 0%, transparent 70%)' }} />

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
