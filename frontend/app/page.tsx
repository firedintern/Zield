'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useState, useEffect, useCallback } from 'react';
import {
  ArrowUpRight, Shield, Zap, RefreshCw, ChevronDown, Radar,
  Flame, CheckCircle2, XCircle, Landmark, Lock, ExternalLink,
} from 'lucide-react';
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt, useConfig } from 'wagmi';

import { parseUnits, formatUnits } from 'viem';
import { toast } from 'sonner';
import { ZIELD_CONFIG, isVaultConfigured } from '../lib/config';

/* ── ABIs ─────────────────────────────────────────────────────────── */

const USDC_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
] as const;

const VAULT_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }], outputs: [{ name: 'shares', type: 'uint256' }] },
  { name: 'redeem', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'shares', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }], outputs: [{ name: 'assets', type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalAssets', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
] as const;

/* ── Types (mirror lib/engine.ts) ─────────────────────────────────── */

interface RiskVector { smartContract: number; market: number; liquidity: number; operational: number }

interface AllocationTarget {
  name: string; project: string; apy: number; tvlUsd: number;
  risk: RiskVector; compositeRisk: number; score: number;
  targetPct: number; rationale: string; color: string;
}

interface RejectedOpportunity { name: string; apy: number; tvlUsd: number; compositeRisk: number; reason: string }

interface KeeperDecision {
  timestamp: number; blendedAPY: number; portfolioRisk: number; riskLabel: string;
  vaultTvlUsd: number | null; est30dEarningsPer10k: number; estRebalanceGasUsd: number;
  netBenefitX: number; allocations: AllocationTarget[]; rejected: RejectedOpportunity[];
  liveSources: string[]; modelVersion: string;
}

/* ── Risk scale helpers ───────────────────────────────────────────── */

function riskColor(v: number): string {
  if (v < 25) return 'var(--z-risk-1)';
  if (v < 40) return 'var(--z-risk-2)';
  if (v < 55) return 'var(--z-risk-3)';
  if (v < 70) return 'var(--z-risk-4)';
  return 'var(--z-risk-5)';
}

function riskTone(v: number): string {
  if (v < 25) return 'Low';
  if (v < 40) return 'Moderate';
  if (v < 55) return 'Elevated';
  if (v < 70) return 'High';
  return 'Critical';
}

const ALLOCATION_PALETTE = ['#2dd4a7', '#60a5fa', '#a78bfa', '#fbbf24', '#f472b6', '#2dd4bf'];

/* ── Small building blocks ────────────────────────────────────────── */

function LiveTicker({ timestamp }: { timestamp: number }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  const label = s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;
  return (
    <span className="inline-flex items-center gap-2 text-[var(--z-text-tertiary)]">
      <span className="z-live-dot" aria-hidden />
      <span>Updated {label}</span>
    </span>
  );
}

function RiskMeter({ value }: { value: number }) {
  return (
    <div className="w-full">
      <div className="relative h-1.5 rounded-full" style={{
        background: 'linear-gradient(90deg, var(--z-risk-1), var(--z-risk-2) 32%, var(--z-risk-3) 55%, var(--z-risk-4) 75%, var(--z-risk-5))',
        opacity: 0.85,
      }}>
        <div
          className="absolute -top-[3px] h-3 w-3 rounded-full border-2 border-[var(--z-bg-0)] transition-all duration-700"
          style={{ left: `calc(${Math.min(value, 100)}% - 6px)`, background: riskColor(value), boxShadow: '0 0 8px rgba(0,0,0,0.6)' }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-[var(--z-text-tertiary)]">
        <span>Safer</span>
        <span>Riskier</span>
      </div>
    </div>
  );
}

const RISK_AXES: Array<{ key: keyof RiskVector; label: string }> = [
  { key: 'smartContract', label: 'Contract' },
  { key: 'market', label: 'Market' },
  { key: 'liquidity', label: 'Liquidity' },
  { key: 'operational', label: 'Operational' },
];

function RiskVectorBars({ risk }: { risk: RiskVector }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
      {RISK_AXES.map(({ key, label }) => (
        <div key={key}>
          <div className="mb-1.5 flex justify-between text-[10px] text-[var(--z-text-tertiary)]">
            <span>{label}</span>
            <span className="z-num font-mono text-[var(--z-text-secondary)]">{risk[key]}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${risk[key]}%`, background: riskColor(risk[key]) }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RiskPill({ value }: { value: number }) {
  const c = riskColor(value);
  return (
    <span
      className="z-num inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px]"
      style={{ color: c, borderColor: 'color-mix(in srgb, ' + c + ' 30%, transparent)', background: 'color-mix(in srgb, ' + c + ' 8%, transparent)' }}
    >
      <span className="h-1 w-1 rounded-full" style={{ background: c }} />
      {value}
    </span>
  );
}

function SkeletonDashboard() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8" aria-busy="true" aria-label="Loading live market data">
      <div className="mb-12 flex flex-col gap-8 lg:flex-row lg:justify-between">
        <div className="space-y-4">
          <div className="z-skeleton h-3 w-64" />
          <div className="z-skeleton h-14 w-80" />
          <div className="z-skeleton h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-4">
          <div className="z-skeleton h-32 w-44" />
          <div className="z-skeleton h-32 w-44" />
        </div>
      </div>
      <div className="z-skeleton mb-8 h-48 w-full" />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="z-skeleton h-80 lg:col-span-3" />
        <div className="z-skeleton h-80 lg:col-span-2" />
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────── */

export default function ZieldDashboard() {
  const [decision, setDecision] = useState<KeeperDecision | null>(null);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState('1000');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);

  const [simulationReport, setSimulationReport] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showSimModal, setShowSimModal] = useState(false);

  const [activities, setActivities] = useState<any[]>([]);
  const [activitiesIsDemo, setActivitiesIsDemo] = useState(true);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const isOnCorrectNetwork = chainId === ZIELD_CONFIG.chainId;
  const vaultReady = isVaultConfigured();

  const { data: usdcBalance } = useReadContract({
    address: ZIELD_CONFIG.usdcAddress, abi: USDC_ABI, functionName: 'balanceOf',
    args: address ? [address] : undefined, query: { enabled: !!address },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: ZIELD_CONFIG.usdcAddress, abi: USDC_ABI, functionName: 'allowance',
    args: address && vaultReady ? [address, ZIELD_CONFIG.vaultAddress] : undefined,
    query: { enabled: !!address && vaultReady },
  });

  const { data: userShares, refetch: refetchShares } = useReadContract({
    address: ZIELD_CONFIG.vaultAddress, abi: VAULT_ABI, functionName: 'balanceOf',
    args: address ? [address] : undefined, query: { enabled: !!address && vaultReady },
  });

  const { data: onchainTotalAssets, refetch: refetchTotalAssets } = useReadContract({
    address: ZIELD_CONFIG.vaultAddress, abi: VAULT_ABI, functionName: 'totalAssets',
    query: { enabled: vaultReady, refetchInterval: 15_000 },
  });

  const amountInUnits = parseUnits(depositAmount || '0', 6);
  const needsApproval = allowance !== undefined && amountInUnits > allowance;

  const { writeContractAsync } = useWriteContract();
  const wagmiConfig = useConfig();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { isLoading: isTxPending, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const fetchKeeperDecision = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/keeper-decision');
      if (!res.ok) throw new Error('engine unavailable');
      setDecision(await res.json());
    } catch {
      // keep previous decision on transient failures; initial failure shows retry state
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecentActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/recent-activity');
      const data = await res.json();
      setActivities(data.activities || []);
      setActivitiesIsDemo(data.isDemo ?? true);
    } catch {
      setActivities([]);
    }
  }, []);

  useEffect(() => {
    fetchKeeperDecision();
    fetchRecentActivity();
    const interval = setInterval(fetchKeeperDecision, 150_000);
    return () => clearInterval(interval);
  }, [fetchKeeperDecision, fetchRecentActivity]);

  useEffect(() => {
    if (isTxSuccess) {
      toast.success('Transaction confirmed');
      setTxHash(undefined);
      refetchAllowance();
      refetchShares();
      refetchTotalAssets();
    }
  }, [isTxSuccess, refetchAllowance, refetchShares, refetchTotalAssets]);

  async function handleDeposit() {
    if (!address || !vaultReady) return;
    setIsDepositing(true);
    try {
      // Step 1: approve if needed
      if (needsApproval) {
        toast('Step 1 of 2 — Approve USDC', { description: 'Confirm the spending approval in your wallet.' });
        const approveHash = await writeContractAsync({
          address: ZIELD_CONFIG.usdcAddress, abi: USDC_ABI, functionName: 'approve',
          args: [ZIELD_CONFIG.vaultAddress, amountInUnits],
        });
        // Wait for approval to confirm before depositing
        const { waitForTransactionReceipt } = await import('wagmi/actions');
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
        await refetchAllowance();
        toast('Step 2 of 2 — Deposit USDC', { description: 'Confirm the deposit in your wallet.' });
      }

      // Step 2: deposit
      const hash = await writeContractAsync({
        address: ZIELD_CONFIG.vaultAddress, abi: VAULT_ABI, functionName: 'deposit',
        args: [amountInUnits, address],
      });
      setTxHash(hash);
      toast('Deposit submitted', { description: 'Your zUSDC shares will arrive on confirmation.' });
    } catch {
      toast.error('Deposit failed or was rejected.');
    } finally {
      setIsDepositing(false);
    }
  }

  async function handleWithdraw() {
    if (!address || !vaultReady || !withdrawAmount) return;
    setIsWithdrawing(true);
    try {
      const hash = await writeContractAsync({
        address: ZIELD_CONFIG.vaultAddress, abi: VAULT_ABI, functionName: 'redeem',
        args: [parseUnits(withdrawAmount, 6), address, address],
      });
      setTxHash(hash);
      setWithdrawAmount('');
      toast('Withdrawal submitted', { description: 'USDC will arrive on confirmation.' });
    } catch {
      toast.error('Withdraw failed. Check your share balance and vault liquidity.');
    } finally {
      setIsWithdrawing(false);
    }
  }

  async function runSimulation() {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/simulate-rebalance');
      if (!res.ok) throw new Error('unavailable');
      setSimulationReport(await res.json());
      setShowSimModal(true);
    } catch {
      toast.error('Simulation unavailable — upstream data sources may be down.');
    } finally {
      setIsSimulating(false);
    }
  }

  /* ── Header (always rendered) ─────────────────────────────────── */

  const header = (
    <header className="sticky top-0 z-50 border-b border-[var(--z-border)] bg-[rgba(10,11,15,0.78)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-b from-white to-[#d8dade] shadow-[0_2px_10px_rgba(255,255,255,0.12)]">
              <span className="mt-[-1px] text-[20px] font-semibold leading-none tracking-[-2.5px] text-[var(--z-bg-0)]">Z</span>
            </div>
            <span className="text-[20px] font-semibold tracking-[-0.04em]">Zield</span>
          </div>
          <span className="rounded-md border border-[var(--z-border)] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium tracking-[0.12em] text-[var(--z-text-tertiary)]">
            BETA
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isConnected && (
            <div
              className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors md:flex ${
                isOnCorrectNetwork
                  ? 'border-[rgba(45,212,167,0.25)] bg-[var(--z-accent-soft)] text-[var(--z-accent)]'
                  : 'border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.08)] text-[var(--z-danger)]'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isOnCorrectNetwork ? 'bg-[var(--z-accent)]' : 'bg-[var(--z-danger)]'}`} />
              {isOnCorrectNetwork ? 'Base Sepolia' : 'Wrong network'}
            </div>
          )}
          <ConnectButton showBalance={false} accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }} />
        </div>
      </div>
    </header>
  );

  if (!decision && loading) {
    return (
      <div className="z-backdrop min-h-screen">
        {header}
        <SkeletonDashboard />
      </div>
    );
  }

  if (!decision) {
    return (
      <div className="z-backdrop min-h-screen">
        {header}
        <div className="flex flex-col items-center justify-center gap-5 py-40">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--z-border-strong)] bg-white/[0.03]">
            <Radar className="h-5 w-5 text-[var(--z-warning)]" />
          </div>
          <div className="text-sm text-[var(--z-text-secondary)]">The decision engine is temporarily unavailable.</div>
          <button onClick={fetchKeeperDecision} className="z-btn z-btn-ghost px-5 py-2 text-xs">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const usdcBalanceFormatted = usdcBalance ? formatUnits(usdcBalance, 6) : '0';
  const userSharesFormatted = userShares ? formatUnits(userShares, 6) : '0';

  // On-chain TVL — overrides keeper decision's vaultTvlUsd when available
  const onchainTvlUsd = onchainTotalAssets !== undefined
    ? Number(formatUnits(onchainTotalAssets, 6))
    : null;
  const displayTvl = onchainTvlUsd ?? decision?.vaultTvlUsd ?? null;

  return (
    <div className="z-backdrop min-h-screen text-[var(--z-text-primary)]">
      {header}

      <main className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="z-fade-up mb-12 flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[560px]">
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-medium tracking-[0.08em]">
              <span className="inline-flex items-center gap-1.5 text-[var(--z-accent)]">
                <span className="z-live-dot" /> LIVE
              </span>
              <span className="text-[var(--z-text-tertiary)]">BASE</span>
              <span className="text-[var(--z-text-tertiary)]">·</span>
              <span className="font-mono text-[var(--z-text-tertiary)]">{decision.modelVersion}</span>
              <span className="text-[var(--z-text-tertiary)]">·</span>
              <LiveTicker timestamp={decision.timestamp} />
            </div>
            <h1 className="text-[44px] font-semibold leading-[1.04] tracking-[-0.045em] sm:text-[56px]">
              Risk-adjusted
              <br />
              <span className="bg-gradient-to-r from-[var(--z-accent)] to-[#7ee8cf] bg-clip-text text-transparent">yield</span>, engineered.
            </h1>
            <p className="mt-4 max-w-[46ch] text-[16px] leading-relaxed text-[var(--z-text-secondary)]">
              Every number on this page is computed live from Base mainnet and real market data.
              The keeper refuses raw APY when the risk math says no — and shows you exactly why.
            </p>
          </div>

          {/* Stat cards */}
          <div className="grid w-full max-w-md grid-cols-2 gap-4">
            <div className="z-card p-5">
              <div className="z-label mb-3">Blended APY</div>
              <div className="z-num font-mono text-[40px] font-semibold leading-none text-[var(--z-accent)]">
                {decision.blendedAPY.toFixed(2)}
                <span className="ml-0.5 text-xl text-[color-mix(in_srgb,var(--z-accent)_60%,transparent)]">%</span>
              </div>
              <div className="mt-3 text-xs text-[var(--z-text-tertiary)]">
                Across {decision.allocations.length} strategies
              </div>
            </div>
            <div className="z-card p-5">
              <div className="z-label mb-3">Portfolio Risk</div>
              <div className="flex items-baseline gap-2">
                <div className="z-num font-mono text-[40px] font-semibold leading-none" style={{ color: riskColor(decision.portfolioRisk) }}>
                  {decision.portfolioRisk}
                </div>
                <div className="text-xs text-[var(--z-text-tertiary)]">/ 100</div>
              </div>
              <div className="mt-1 mb-3 text-xs" style={{ color: riskColor(decision.portfolioRisk) }}>
                {riskTone(decision.portfolioRisk)}
              </div>
              <RiskMeter value={decision.portfolioRisk} />
            </div>
          </div>
        </section>

        {/* ── Keeper recommendation (hero card) ─────────────────── */}
        <section className="z-card-hero z-fade-up z-d1 mb-8 p-6 sm:p-8">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(45,212,167,0.25)] bg-[var(--z-accent-soft)]">
                <Zap className="h-4 w-4 text-[var(--z-accent)]" />
              </div>
              <div>
                <div className="text-sm font-medium">Keeper recommendation</div>
                <div className="text-[11px] text-[var(--z-text-tertiary)]">
                  Computed from {decision.liveSources.length} live sources · high-risk bucket capped at 20%
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={fetchKeeperDecision} disabled={loading} className="z-btn z-btn-ghost px-3.5 py-1.5 text-xs" aria-label="Refresh live data">
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button onClick={runSimulation} disabled={isSimulating} className="z-btn z-btn-accent px-4 py-1.5 text-xs">
                {isSimulating ? (
                  <><RefreshCw className="h-3 w-3 animate-spin" /> Simulating…</>
                ) : (
                  <>Simulate rebalance</>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:divide-x sm:divide-[var(--z-border)]">
            <div className="sm:pr-6">
              <div className="z-label mb-2 flex items-center gap-1.5">
                <Landmark className="h-3 w-3" />
                Est. 30-day earnings {displayTvl === null && <span className="normal-case opacity-70">(per $10k)</span>}
              </div>
              <div className="z-num font-mono text-[38px] font-semibold leading-none text-[var(--z-accent)]">
                +${decision.est30dEarningsPer10k.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="sm:px-6">
              <div className="z-label mb-2 flex items-center gap-1.5">
                <Flame className="h-3 w-3" />
                Rebalance gas <span className="normal-case opacity-70">(live)</span>
              </div>
              <div className="z-num font-mono text-[38px] font-semibold leading-none text-[var(--z-text-primary)]">
                ${decision.estRebalanceGasUsd.toFixed(2)}
              </div>
            </div>
            <div className="sm:pl-6">
              <div className="z-label mb-2 flex items-center gap-1.5">
                <ArrowUpRight className="h-3 w-3" />
                Net benefit
              </div>
              <div className="z-num font-mono text-[38px] font-semibold leading-none">
                {decision.netBenefitX.toLocaleString()}
                <span className="ml-0.5 text-xl text-[var(--z-text-tertiary)]">×</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Allocation + Deposit ───────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Allocation */}
          <section className="z-card z-fade-up z-d2 p-6 sm:p-7 lg:col-span-3">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-sm font-medium">
                <Shield className="h-4 w-4 text-[var(--z-text-secondary)]" />
                Target allocation
              </div>
              <div className="rounded-full border border-[var(--z-border)] bg-white/[0.03] px-3 py-1 text-[11px] text-[var(--z-text-secondary)]">
                {displayTvl !== null
                  ? `TVL $${displayTvl.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                  : 'Vault not yet live'}
              </div>
            </div>

            {/* Segmented allocation bar */}
            <div className="mb-2 flex h-3 w-full gap-[3px] overflow-hidden rounded-full" role="img" aria-label="Allocation split">
              {decision.allocations.map((a, i) => (
                <div
                  key={a.project}
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${a.targetPct}%`, background: ALLOCATION_PALETTE[i % ALLOCATION_PALETTE.length] }}
                />
              ))}
            </div>
            <div className="mb-6 flex flex-wrap gap-x-5 gap-y-1.5">
              {decision.allocations.map((a, i) => (
                <span key={a.project} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--z-text-tertiary)]">
                  <span className="h-2 w-2 rounded-[3px]" style={{ background: ALLOCATION_PALETTE[i % ALLOCATION_PALETTE.length] }} />
                  {a.name} · <span className="z-num font-mono">{a.targetPct}%</span>
                </span>
              ))}
            </div>

            {/* Strategy rows */}
            <div className="space-y-1.5">
              {decision.allocations.map((strat, i) => {
                const expanded = expandedStrategy === strat.project;
                return (
                  <div key={strat.project} className={`rounded-2xl border transition-colors duration-200 ${expanded ? 'border-[var(--z-border-strong)] bg-white/[0.03]' : 'border-transparent hover:bg-white/[0.025]'}`}>
                    <button
                      onClick={() => setExpandedStrategy(expanded ? null : strat.project)}
                      className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left"
                      aria-expanded={expanded}
                    >
                      <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: ALLOCATION_PALETTE[i % ALLOCATION_PALETTE.length] }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{strat.name}</span>
                        <span className="mt-0.5 block text-[11px] text-[var(--z-text-tertiary)]">
                          {strat.tvlUsd > 0 ? `Pool TVL $${(strat.tvlUsd / 1e6).toFixed(1)}M` : 'On-chain read'}
                        </span>
                      </span>
                      <span className="z-num hidden font-mono text-sm text-[var(--z-accent)] sm:block">{strat.apy.toFixed(2)}%</span>
                      <RiskPill value={strat.compositeRisk} />
                      <span className="z-num w-12 text-right font-mono text-sm font-semibold">{strat.targetPct}%</span>
                      <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[var(--z-text-tertiary)] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    {expanded && (
                      <div className="px-5 pb-5 pt-1">
                        <RiskVectorBars risk={strat.risk} />
                        <p className="mt-4 text-xs leading-relaxed text-[var(--z-text-secondary)]">{strat.rationale}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="mt-5 px-1 text-[11px] leading-relaxed text-[var(--z-text-tertiary)]">
              Select a strategy to inspect its full 4-axis risk vector. Hard caps: 40% per strategy,
              20% total in anything with composite risk above 55.
            </p>
          </section>

          {/* Deposit / Withdraw */}
          <section className="z-card z-fade-up z-d3 flex flex-col p-6 sm:p-7 lg:col-span-2">
            <div className="mb-5 flex items-center justify-between">
              <div className="text-sm font-medium">Deposit USDC</div>
              {isConnected && vaultReady && (
                <div className="z-num font-mono text-[11px] text-[var(--z-text-tertiary)]">
                  Balance {parseFloat(usdcBalanceFormatted).toFixed(2)}
                </div>
              )}
            </div>

            {!vaultReady ? (
              /* Premium not-live state */
              <div className="flex flex-1 flex-col">
                <div className="z-inset flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--z-border-strong)] bg-white/[0.03]">
                    <Lock className="h-5 w-5 text-[var(--z-text-secondary)]" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Vault opens soon</div>
                    <p className="mx-auto mt-1.5 max-w-[30ch] text-xs leading-relaxed text-[var(--z-text-tertiary)]">
                      The Base Sepolia vault is being deployed. Deposits unlock the moment it&apos;s live —
                      the strategy engine above is already running.
                    </p>
                  </div>
                  <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-[var(--z-border)] bg-white/[0.03] px-3 py-1.5 text-[11px] text-[var(--z-text-secondary)]">
                    <span className="z-live-dot" />
                    Engine live · vault pending
                  </div>
                </div>

                {decision.blendedAPY > 0 && (
                  <div className="mt-5 rounded-2xl border border-[rgba(45,212,167,0.16)] bg-[var(--z-accent-soft)] px-4 py-3.5 text-xs leading-relaxed text-[var(--z-text-secondary)]">
                    At today&apos;s blended rate, <span className="z-num font-mono text-[var(--z-text-primary)]">$10,000</span> would earn ≈{' '}
                    <span className="z-num font-mono font-medium text-[var(--z-accent)]">
                      ${((10000 * decision.blendedAPY) / 100 / 12).toFixed(0)}/month
                    </span>
                  </div>
                )}

                {!isConnected && <div className="mt-5"><ConnectButton /></div>}
              </div>
            ) : (
              /* Live deposit flow */
              <div className="flex flex-1 flex-col">
                {!isOnCorrectNetwork && isConnected && (
                  <div className="mb-4 rounded-xl border border-[rgba(251,191,36,0.25)] bg-[rgba(251,191,36,0.07)] px-4 py-3 text-xs text-[var(--z-warning)]">
                    Switch to Base Sepolia in your wallet to continue.
                  </div>
                )}

                <div className="z-inset relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    disabled={!isConnected || !isOnCorrectNetwork}
                    aria-label="Deposit amount in USDC"
                    className="z-num w-full bg-transparent px-5 py-5 font-mono text-4xl font-semibold tracking-tight outline-none placeholder:text-[var(--z-text-tertiary)] disabled:opacity-50"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 rounded-lg border border-[var(--z-border)] bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-[var(--z-text-secondary)]">
                    USDC
                  </span>
                </div>

                <div className="mt-3 flex gap-2">
                  {[100, 1000, 5000].map((v) => (
                    <button
                      key={v}
                      onClick={() => setDepositAmount(String(v))}
                      disabled={!isConnected}
                      className="z-btn z-btn-ghost flex-1 rounded-xl py-2 text-xs"
                    >
                      ${v.toLocaleString()}
                    </button>
                  ))}
                </div>

                {decision.blendedAPY > 0 && parseFloat(depositAmount) > 0 && (
                  <div className="mt-4 text-xs text-[var(--z-text-tertiary)]">
                    ≈{' '}
                    <span className="z-num font-mono font-medium text-[var(--z-accent)]">
                      ${((parseFloat(depositAmount) * decision.blendedAPY) / 100 / 12).toFixed(2)}/month
                    </span>{' '}
                    at the current blended rate
                  </div>
                )}

                <div className="flex-1" />

                {!isConnected ? (
                  <div className="mt-6"><ConnectButton /></div>
                ) : (
                  <button
                    onClick={handleDeposit}
                    disabled={isDepositing || isTxPending || !isOnCorrectNetwork || parseFloat(depositAmount) <= 0}
                    className="z-btn z-btn-primary mt-6 w-full rounded-2xl py-3.5 text-sm font-semibold"
                  >
                    {isDepositing && needsApproval ? 'Approving…' : isDepositing || isTxPending ? 'Depositing…' : needsApproval ? 'Approve & Deposit' : 'Deposit USDC'}
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                )}

                {/* Withdraw */}
                <div className="mt-7 border-t border-[var(--z-border)] pt-6">
                  <div className="mb-2.5 flex items-center justify-between">
                    <div className="text-xs font-medium text-[var(--z-text-secondary)]">Withdraw zUSDC</div>
                    {parseFloat(userSharesFormatted) > 0 && (
                      <button onClick={() => setWithdrawAmount(userSharesFormatted)} className="text-[11px] text-[var(--z-accent)] hover:underline">
                        Max · {parseFloat(userSharesFormatted).toFixed(2)}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2.5">
                    <div className="z-inset relative flex-1">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="0.00"
                        disabled={!isConnected || parseFloat(userSharesFormatted) === 0 || !isOnCorrectNetwork}
                        aria-label="Withdraw amount in zUSDC shares"
                        className="z-num w-full bg-transparent px-4 py-2.5 font-mono text-lg outline-none placeholder:text-[var(--z-text-tertiary)] disabled:opacity-50"
                      />
                    </div>
                    <button
                      onClick={handleWithdraw}
                      disabled={!isConnected || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || !isOnCorrectNetwork || isWithdrawing}
                      className="z-btn z-btn-ghost rounded-xl px-6 text-xs"
                    >
                      {isWithdrawing ? 'Withdrawing…' : 'Withdraw'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ── Rejected pools — the transparency differentiator ───── */}
        {decision.rejected.length > 0 && (
          <section className="z-card z-fade-up z-d4 mt-6 overflow-hidden">
            <div className="px-6 pb-1 pt-6 sm:px-7">
              <div className="flex items-center gap-2.5 text-sm font-medium">
                <Radar className="h-4 w-4 text-[var(--z-warning)]" />
                What the keeper rejected — and why
              </div>
              <p className="mt-1.5 text-xs text-[var(--z-text-tertiary)]">
                Live Base stable pools that didn&apos;t make the cut. Most yield products hide this. We don&apos;t.
              </p>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--z-border)] text-[11px] uppercase tracking-[0.06em] text-[var(--z-text-tertiary)]">
                    <th className="px-6 py-3 text-left font-medium sm:px-7">Pool</th>
                    <th className="px-4 py-3 text-right font-medium">APY</th>
                    <th className="px-4 py-3 text-right font-medium">TVL</th>
                    <th className="px-4 py-3 text-right font-medium">Risk</th>
                    <th className="px-6 py-3 text-left font-medium sm:px-7">Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--z-border)]">
                  {decision.rejected.map((r, i) => (
                    <tr key={i} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-6 py-3.5 font-medium sm:px-7">{r.name}</td>
                      <td className="z-num px-4 py-3.5 text-right font-mono text-[var(--z-warning)]">{r.apy.toFixed(2)}%</td>
                      <td className="z-num px-4 py-3.5 text-right font-mono text-[var(--z-text-tertiary)]">
                        {r.tvlUsd > 0 ? `$${(r.tvlUsd / 1e6).toFixed(1)}M` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right"><RiskPill value={r.compositeRisk} /></td>
                      <td className="max-w-[36ch] px-6 py-3.5 text-xs leading-relaxed text-[var(--z-text-tertiary)] sm:px-7">{r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Activity ───────────────────────────────────────────── */}
        <section className="z-card mt-6 p-6 sm:p-7">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-medium">Recent keeper activity</div>
            {activitiesIsDemo && (
              <span className="rounded-full border border-[rgba(251,191,36,0.25)] bg-[rgba(251,191,36,0.07)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--z-warning)]">
                Demo data
              </span>
            )}
          </div>

          {activities.length > 0 ? (
            <div className="space-y-2">
              {activities.map((act, i) => {
                const profit = act.profit || act.totalAssetsAfter - act.totalAssetsBefore;
                return (
                  <div key={i} className="z-inset flex items-center justify-between px-4 py-3 text-xs">
                    <div>
                      <div className="font-medium text-[var(--z-text-primary)]">Rebalance executed</div>
                      <div className="mt-0.5 text-[var(--z-text-tertiary)]">{new Date(act.timestamp).toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="z-num font-mono font-medium text-[var(--z-accent)]">+${(profit / 1e6).toFixed(0)}</div>
                      {act.txHash && (
                        <a
                          href={`https://${ZIELD_CONFIG.chainId === 84532 ? 'sepolia.' : ''}basescan.org/tx/${act.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-[var(--z-info)] hover:underline"
                        >
                          View tx <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-[var(--z-text-tertiary)]">No rebalances yet. Deploy a vault and run the keeper to see activity here.</p>
          )}
        </section>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="mt-12 border-t border-[var(--z-border)] pt-8 pb-4 text-center">
          <div className="mx-auto max-w-2xl text-[11px] leading-relaxed text-[var(--z-text-tertiary)]">
            <span className="font-medium text-[var(--z-text-secondary)]">Live sources:</span>{' '}
            {decision.liveSources.join(' · ')}
            <br />
            <span className="font-mono">{decision.modelVersion}</span> · Early software. Nothing here constitutes financial advice.
          </div>
        </footer>
      </main>

      {/* ── Simulation modal ─────────────────────────────────────── */}
      {showSimModal && simulationReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-6"
          onClick={() => setShowSimModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Rebalance simulation report"
        >
          <div
            className="z-card z-fade-up max-h-[90vh] w-full max-w-3xl overflow-y-auto bg-[var(--z-bg-1)] p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium tracking-[0.08em] text-[var(--z-accent)]">
                  <Zap className="h-3.5 w-3.5" /> KEEPER SIMULATION
                </div>
                <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.03em]">Rebalance preflight</h2>
                <p className="mt-1 text-xs text-[var(--z-text-tertiary)]">vs {simulationReport.baselineLabel}</p>
              </div>
              <button onClick={() => setShowSimModal(false)} className="z-btn z-btn-ghost h-8 w-8 rounded-lg p-0 text-sm" aria-label="Close">
                ✕
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="z-inset p-4">
                <div className="z-label mb-1.5">
                  30d profit{simulationReport.proposedAction.referenceIsHypothetical ? ' / $10k' : ''}
                </div>
                <div className="z-num font-mono text-xl font-semibold text-[var(--z-accent)]">
                  +${simulationReport.proposedAction.expected30DayProfitUsd}
                </div>
              </div>
              <div className="z-inset p-4">
                <div className="z-label mb-1.5">Gas (live)</div>
                <div className="z-num font-mono text-xl font-semibold">${simulationReport.proposedAction.estimatedGasUsd}</div>
              </div>
              <div className="z-inset p-4">
                <div className="z-label mb-1.5">Net benefit</div>
                <div className="z-num font-mono text-xl font-semibold text-[var(--z-accent)]">
                  {simulationReport.proposedAction.netBenefitRatio}×
                </div>
              </div>
              <div className="z-inset p-4">
                <div className="z-label mb-1.5">Verdict</div>
                <div className={`text-xl font-semibold ${simulationReport.finalRecommendation === 'EXECUTE' ? 'text-[var(--z-accent)]' : 'text-[var(--z-warning)]'}`}>
                  {simulationReport.finalRecommendation}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="z-label mb-2.5">Proposed allocation changes</div>
              <div className="space-y-1.5 text-sm">
                {simulationReport.allocationChanges.map((change: any, i: number) => (
                  <div key={i} className="z-inset flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-medium">{change.strategy}</span>
                    <span className={`z-num font-mono text-xs ${change.delta > 0 ? 'text-[var(--z-accent)]' : 'text-[var(--z-warning)]'}`}>
                      {change.current}% → {change.proposed}%
                      <span className="ml-2 opacity-70">({change.delta > 0 ? '+' : ''}{change.delta}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="z-inset mt-5 p-4">
              <div className="z-label mb-1.5">Keeper rationale</div>
              <p className="text-xs leading-relaxed text-[var(--z-text-secondary)]">{simulationReport.rationale}</p>
            </div>

            {simulationReport.safetyGates && (
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]">
                {Object.entries(simulationReport.safetyGates).map(([key, val]) => (
                  <span key={key} className={`inline-flex items-center gap-1 ${val ? 'text-[var(--z-accent)]' : 'text-[var(--z-danger)]'}`}>
                    {val ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </span>
                ))}
              </div>
            )}

            {simulationReport.warnings?.length > 0 && (
              <div className="mt-3 text-[11px] text-[var(--z-warning)]">
                {simulationReport.warnings.map((w: string, i: number) => <div key={i}>⚠ {w}</div>)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
