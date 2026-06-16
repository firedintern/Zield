'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight, Shield, Zap, RefreshCw, ChevronDown, Radar,
  Flame, CheckCircle2, XCircle, Landmark, Lock, ExternalLink, ArrowLeft,
} from 'lucide-react';
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt, useConfig } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { toast } from 'sonner';
import { ZIELD_CONFIG, isVaultConfigured } from '../../lib/config';

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
  { name: 'strategies', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] },
  { name: 'targetAllocationBps', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'uint16' }] },
] as const;

/* ── Types ────────────────────────────────────────────────────────── */

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

/* ── Risk helpers ─────────────────────────────────────────────────── */

function riskColor(v: number) {
  if (v < 25) return 'var(--risk-low)';
  if (v < 40) return 'var(--risk-med)';
  if (v < 55) return 'var(--risk-mid)';
  if (v < 70) return 'var(--risk-high)';
  return 'var(--risk-crit)';
}
function riskLabel(v: number) {
  if (v < 25) return 'Low';
  if (v < 40) return 'Moderate';
  if (v < 55) return 'Elevated';
  if (v < 70) return 'High';
  return 'Critical';
}

const PALETTE = ['#5683da', '#ff8964', '#a78bfa', '#34d399', '#fbbf24', '#60a5fa'];

/* ── Tiny components ──────────────────────────────────────────────── */

function LiveTicker({ timestamp }: { timestamp: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  const t = s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;
  return (
    <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--color-iron-veil)' }}>
      <span className="z-live-dot" />
      {t}
    </span>
  );
}

function RiskMeter({ value }: { value: number }) {
  return (
    <div>
      <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-strong)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(value, 100)}%`, background: `linear-gradient(90deg, var(--risk-low), var(--risk-med) 40%, var(--risk-mid) 60%, var(--risk-high) 80%, var(--risk-crit))` }} />
      </div>
      <div className="mt-1.5 flex justify-between" style={{ fontSize: 10, color: 'var(--color-iron-veil)' }}>
        <span>Safer</span><span>Riskier</span>
      </div>
    </div>
  );
}

function RiskPill({ value }: { value: number }) {
  const c = riskColor(value);
  return (
    <span className="z-num inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full"
      style={{ color: c, border: `1px solid color-mix(in srgb, ${c} 30%, transparent)`, background: `color-mix(in srgb, ${c} 8%, transparent)`, fontSize: 11, fontWeight: 500 }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
      {value}
    </span>
  );
}

function RiskVectorBars({ risk }: { risk: RiskVector }) {
  const axes: Array<{ key: keyof RiskVector; label: string }> = [
    { key: 'smartContract', label: 'Contract' },
    { key: 'market', label: 'Market' },
    { key: 'liquidity', label: 'Liquidity' },
    { key: 'operational', label: 'Operational' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {axes.map(({ key, label }) => (
        <div key={key}>
          <div className="flex justify-between mb-1" style={{ fontSize: 10, color: 'var(--color-iron-veil)' }}>
            <span>{label}</span>
            <span className="z-num font-mono" style={{ color: 'var(--color-smoke)' }}>{risk[key]}</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border-strong)' }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${risk[key]}%`, background: riskColor(risk[key]) }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-7xl px-5 sm:px-8 py-12" aria-busy>
      <div className="mb-12 flex flex-col gap-8 lg:flex-row lg:justify-between">
        <div className="space-y-4">
          <div className="z-skeleton h-3 w-56 rounded" />
          <div className="z-skeleton h-12 w-72 rounded" />
          <div className="z-skeleton h-4 w-80 rounded" />
        </div>
        <div className="flex gap-3">
          <div className="z-skeleton h-32 w-40 rounded-xl" />
          <div className="z-skeleton h-32 w-40 rounded-xl" />
        </div>
      </div>
      <div className="z-skeleton mb-6 h-44 w-full rounded-xl" />
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="z-skeleton h-72 rounded-xl lg:col-span-3" />
        <div className="z-skeleton h-72 rounded-xl lg:col-span-2" />
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
  const [vaultState, setVaultState] = useState<any>(null);

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
      if (!res.ok) throw new Error('unavailable');
      setDecision(await res.json());
    } catch { /* keep previous */ } finally { setLoading(false); }
  }, []);

  const fetchRecentActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/recent-activity');
      setActivities((await res.json()).activities || []);
    } catch { setActivities([]); }
  }, []);

  const fetchVaultState = useCallback(async () => {
    try {
      const res = await fetch('/api/vault-state');
      const d = await res.json();
      if (d.configured && !d.error) setVaultState(d);
    } catch {}
  }, []);

  useEffect(() => {
    fetchKeeperDecision(); fetchRecentActivity(); fetchVaultState();
    const id = setInterval(() => { fetchKeeperDecision(); fetchVaultState(); }, 150_000);
    return () => clearInterval(id);
  }, [fetchKeeperDecision, fetchRecentActivity, fetchVaultState]);

  useEffect(() => {
    if (isTxSuccess) {
      toast.success('Transaction confirmed');
      setTxHash(undefined);
      refetchAllowance(); refetchShares(); refetchTotalAssets();
    }
  }, [isTxSuccess, refetchAllowance, refetchShares, refetchTotalAssets]);

  async function handleDeposit() {
    if (!address || !vaultReady) return;
    setIsDepositing(true);
    try {
      if (needsApproval) {
        toast('Step 1 of 2 — Approve USDC', { description: 'Confirm the spending approval in your wallet.' });
        let approveHash: `0x${string}`;
        try {
          approveHash = await writeContractAsync({
            address: ZIELD_CONFIG.usdcAddress, abi: USDC_ABI, functionName: 'approve',
            args: [ZIELD_CONFIG.vaultAddress, amountInUnits],
          });
        } catch {
          toast.error('Approval rejected.'); return;
        }
        const { waitForTransactionReceipt } = await import('wagmi/actions');
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
        await refetchAllowance();
        toast('Step 2 of 2 — Deposit USDC', { description: 'Confirm the deposit in your wallet.' });
      }
      const hash = await writeContractAsync({
        address: ZIELD_CONFIG.vaultAddress, abi: VAULT_ABI, functionName: 'deposit',
        args: [amountInUnits, address],
      });
      setTxHash(hash);
      toast('Deposit submitted', { description: 'zUSDC shares arrive on confirmation.' });
    } catch {
      toast.error('Deposit rejected.');
    } finally { setIsDepositing(false); }
  }

  async function handleWithdraw() {
    if (!address || !vaultReady || !withdrawAmount) return;
    setIsWithdrawing(true);
    try {
      const hash = await writeContractAsync({
        address: ZIELD_CONFIG.vaultAddress, abi: VAULT_ABI, functionName: 'redeem',
        args: [parseUnits(withdrawAmount, 6), address, address],
      });
      setTxHash(hash); setWithdrawAmount('');
      toast('Withdrawal submitted', { description: 'USDC arrives on confirmation.' });
    } catch {
      toast.error('Withdraw failed. Check share balance and vault liquidity.');
    } finally { setIsWithdrawing(false); }
  }

  async function runSimulation() {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/simulate-rebalance');
      if (!res.ok) throw new Error();
      setSimulationReport(await res.json()); setShowSimModal(true);
    } catch { toast.error('Simulation unavailable.'); } finally { setIsSimulating(false); }
  }

  /* ── Shared header ─────────────────────────────────────────────── */

  const header = (
    <header className="sticky top-0 z-50"
      style={{ background: 'rgba(9,10,12,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
      <div className="mx-auto flex h-15 max-w-7xl items-center justify-between px-5 sm:px-8" style={{ height: 60 }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1 text-xs transition-opacity hover:opacity-60 mr-1"
            style={{ color: 'var(--color-iron-veil)' }}>
            <ArrowLeft size={11} /> Home
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs"
              style={{ background: 'var(--color-iris)', color: '#fff' }}>Z</div>
            <span className="font-semibold text-base tracking-tight" style={{ color: 'var(--color-snow)' }}>Zield</span>
          </div>
          <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-medium tracking-wider"
            style={{ background: 'var(--color-iris-soft)', color: 'var(--color-iris)', border: '1px solid rgba(86,131,218,0.2)' }}>
            BETA
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isConnected && (
            <div className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ${
              isOnCorrectNetwork ? '' : ''
            }`} style={{
              border: `1px solid ${isOnCorrectNetwork ? 'rgba(86,131,218,0.3)' : 'rgba(248,113,113,0.3)'}`,
              background: isOnCorrectNetwork ? 'var(--color-iris-soft)' : 'rgba(248,113,113,0.08)',
              color: isOnCorrectNetwork ? 'var(--color-iris)' : 'var(--color-danger)',
            }}>
              <span className="w-1.5 h-1.5 rounded-full"
                style={{ background: isOnCorrectNetwork ? 'var(--color-iris)' : 'var(--color-danger)' }} />
              {isOnCorrectNetwork ? 'Base Sepolia' : 'Wrong network'}
            </div>
          )}
          <ConnectButton showBalance={false} accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }} />
        </div>
      </div>
    </header>
  );

  if (!decision && loading) return <div className="z-backdrop min-h-screen">{header}<Skeleton /></div>;

  if (!decision) return (
    <div className="z-backdrop min-h-screen">
      {header}
      <div className="flex flex-col items-center justify-center gap-5 py-40">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--color-card)', border: '1px solid var(--border)' }}>
          <Radar size={20} style={{ color: 'var(--color-warning)' }} />
        </div>
        <div style={{ color: 'var(--color-smoke)', fontSize: 14 }}>The decision engine is temporarily unavailable.</div>
        <button onClick={fetchKeeperDecision} className="z-btn z-btn-ghost px-5 py-2 text-xs">
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    </div>
  );

  const usdcBalanceFormatted = usdcBalance ? formatUnits(usdcBalance, 6) : '0';
  const userSharesFormatted = userShares ? formatUnits(userShares, 6) : '0';
  const onchainTvlUsd = onchainTotalAssets !== undefined ? Number(formatUnits(onchainTotalAssets, 6)) : null;
  const displayTvl = onchainTvlUsd ?? decision?.vaultTvlUsd ?? null;

  return (
    <div className="z-backdrop min-h-screen" style={{ color: 'var(--color-snow)' }}>
      {header}

      <main className="mx-auto max-w-7xl px-5 sm:px-8 py-10">

        {/* ── Hero strip ───────────────────────────────────────────── */}
        <section className="z-fade-up mb-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div style={{ maxWidth: 560 }}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-4" style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--color-iris)' }}>
                <span className="z-live-dot" /> Live
              </span>
              <span style={{ color: 'var(--color-iron-veil)' }}>Base</span>
              <span style={{ color: 'var(--color-iron-veil)' }}>·</span>
              <span className="font-mono" style={{ color: 'var(--color-iron-veil)' }}>{decision.modelVersion}</span>
              <span style={{ color: 'var(--color-iron-veil)' }}>·</span>
              <LiveTicker timestamp={decision.timestamp} />
            </div>
            <h1 className="display-heading mb-4" style={{ fontSize: 'clamp(36px, 5vw, 52px)', color: 'var(--color-snow)' }}>
              Risk-adjusted yield,<br />
              <span style={{ color: 'var(--color-iris)' }}>engineered.</span>
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--color-ash)', maxWidth: '44ch', fontWeight: 300 }}>
              Every number on this page is computed live from Base mainnet.
              The keeper refuses raw APY when the risk math says no.
            </p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 w-full" style={{ maxWidth: 380 }}>
            <div className="p-5" style={{ background: 'var(--color-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div className="z-label mb-2">Blended APY</div>
              <div className="z-num font-mono leading-none mb-1" style={{ fontSize: 38, fontWeight: 600, color: 'var(--color-iris)' }}>
                {decision.blendedAPY.toFixed(2)}
                <span style={{ fontSize: 18, color: 'rgba(86,131,218,0.55)', marginLeft: 2 }}>%</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-iron-veil)' }}>{decision.allocations.length} strategies</div>
            </div>
            <div className="p-5" style={{ background: 'var(--color-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div className="z-label mb-2">Portfolio Risk</div>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="z-num font-mono leading-none" style={{ fontSize: 38, fontWeight: 600, color: riskColor(decision.portfolioRisk) }}>
                  {decision.portfolioRisk}
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-iron-veil)' }}>/ 100</span>
              </div>
              <div style={{ fontSize: 11, color: riskColor(decision.portfolioRisk), marginBottom: 8 }}>{riskLabel(decision.portfolioRisk)}</div>
              <RiskMeter value={decision.portfolioRisk} />
            </div>
          </div>
        </section>

        {/* ── Keeper card ──────────────────────────────────────────── */}
        <section className="z-card-hero z-fade-up z-d1 mb-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-7">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--color-iris-soft)', border: '1px solid rgba(86,131,218,0.25)' }}>
                <Zap size={15} style={{ color: 'var(--color-iris)' }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Keeper recommendation</div>
                <div style={{ fontSize: 11, color: 'var(--color-iron-veil)' }}>
                  {decision.liveSources.length} live sources · high-risk cap 20%
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={fetchKeeperDecision} disabled={loading} className="z-btn z-btn-ghost px-3.5 py-1.5 text-xs">
                <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
              <button onClick={runSimulation} disabled={isSimulating} className="z-btn z-btn-accent px-4 py-1.5 text-xs">
                {isSimulating ? <><RefreshCw size={11} className="animate-spin" /> Simulating…</> : 'Simulate rebalance'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:divide-x" style={{ '--tw-divide-opacity': 1 } as any}>
            {[
              {
                icon: Landmark, label: `Est. 30-day earnings${displayTvl === null ? ' (per $10k)' : ''}`,
                value: `+$${decision.est30dEarningsPer10k.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                color: 'var(--color-iris)',
              },
              { icon: Flame, label: 'Rebalance gas (live)', value: `$${decision.estRebalanceGasUsd.toFixed(2)}`, color: 'var(--color-snow)' },
              { icon: ArrowUpRight, label: 'Net benefit', value: `${decision.netBenefitX.toLocaleString()}×`, color: 'var(--color-snow)' },
            ].map(({ icon: Icon, label, value, color }, i) => (
              <div key={i} className={i === 0 ? 'sm:pr-6' : i === 1 ? 'sm:px-6' : 'sm:pl-6'}
                style={{ borderColor: 'var(--border)' }}>
                <div className="z-label flex items-center gap-1.5 mb-2"><Icon size={11} />{label}</div>
                <div className="z-num font-mono leading-none" style={{ fontSize: 36, fontWeight: 600, color }}>{value}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Allocation + Deposit ──────────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-5">

          {/* Allocation panel */}
          <section className="z-card z-fade-up z-d2 p-6 sm:p-7 lg:col-span-3">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 500 }}>
                <Shield size={14} style={{ color: 'var(--color-smoke)' }} />
                {vaultState?.strategies?.length > 0 ? 'Vault allocation' : 'Keeper recommendation'}
              </div>
              <div className="px-3 py-1 rounded-full text-xs" style={{ background: 'var(--color-iris-soft)', color: 'var(--color-iris)', border: '1px solid rgba(86,131,218,0.2)' }}>
                {displayTvl !== null ? `TVL $${displayTvl.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : 'Vault not yet live'}
              </div>
            </div>

            {/* Allocation bar */}
            {(() => {
              const source = vaultState?.strategies?.length > 0 ? vaultState.strategies : decision.allocations;
              const isOnchain = vaultState?.strategies?.length > 0;
              return (
                <>
                  {isOnchain && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="z-tag" style={{ background: 'rgba(86,131,218,0.10)', color: 'var(--color-iris)', border: '1px solid rgba(86,131,218,0.2)' }}>On-chain</span>
                      <span style={{ fontSize: 11, color: 'var(--color-iron-veil)' }}>Live vault allocation</span>
                    </div>
                  )}
                  <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full mb-2" aria-label="Allocation bar">
                    {source.map((s: any, i: number) => (
                      <div key={isOnchain ? s.address : s.project} className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${isOnchain ? s.targetPct : s.targetPct}%`, background: PALETTE[i % PALETTE.length] }} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-6">
                    {source.map((s: any, i: number) => (
                      <span key={isOnchain ? s.address : s.project} className="inline-flex items-center gap-1.5"
                        style={{ fontSize: 11, color: 'var(--color-smoke)' }}>
                        <span className="w-2 h-2 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                        {isOnchain ? s.name : s.name}
                        <span className="z-num font-mono">{isOnchain ? s.targetPct.toFixed(0) : s.targetPct}%</span>
                      </span>
                    ))}
                  </div>

                  {/* Strategy rows */}
                  <div className="space-y-1">
                    {source.map((strat: any, i: number) => {
                      const isOc = vaultState?.strategies?.length > 0;
                      const key = isOc ? strat.address : strat.project;
                      const apy = isOc ? strat.apyBps / 100 : strat.apy;
                      const risk = isOc ? strat.riskScore : strat.compositeRisk;
                      const pct = strat.targetPct;
                      const rationale = isOc ? `${(strat.currentAssets / 1e6).toFixed(4)} USDC deployed` : strat.rationale;
                      const expanded = expandedStrategy === key;
                      return (
                        <div key={key} style={{
                          borderRadius: 8,
                          border: `1px solid ${expanded ? 'var(--border-strong)' : 'transparent'}`,
                          background: expanded ? 'rgba(255,255,255,0.025)' : 'transparent',
                          transition: 'all 0.2s',
                        }}>
                          <button onClick={() => setExpandedStrategy(expanded ? null : key)}
                            className="flex w-full items-center gap-4 px-4 py-3.5 text-left"
                            aria-expanded={expanded}>
                            <span className="w-0.5 h-8 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                            <span className="flex-1 min-w-0">
                              <span className="block truncate" style={{ fontSize: 13, fontWeight: 500 }}>{isOc ? strat.name : strat.name}</span>
                              <span className="block mt-0.5" style={{ fontSize: 11, color: 'var(--color-iron-veil)' }}>
                                {!isOc && strat.tvlUsd > 0 ? `Pool TVL $${(strat.tvlUsd / 1e6).toFixed(1)}M` : 'On-chain strategy'}
                              </span>
                            </span>
                            <span className="z-num font-mono hidden sm:block" style={{ fontSize: 13, color: 'var(--color-iris)' }}>{apy.toFixed(2)}%</span>
                            <RiskPill value={risk} />
                            <span className="z-num font-mono w-10 text-right" style={{ fontSize: 13, fontWeight: 600 }}>{typeof pct === 'number' ? pct.toFixed(0) : pct}%</span>
                            <ChevronDown size={13} style={{ color: 'var(--color-iron-veil)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                          </button>
                          {expanded && (
                            <div className="px-5 pb-5">
                              {!isOc && strat.risk && <RiskVectorBars risk={strat.risk} />}
                              <p className="mt-3" style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--color-smoke)' }}>{rationale}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            <p className="mt-5 px-1" style={{ fontSize: 11, color: 'var(--color-iron-veil)', lineHeight: 1.6 }}>
              Select a strategy to inspect its 4-axis risk breakdown. Hard caps: 40% per strategy, 20% total above risk 55.
            </p>
          </section>

          {/* Deposit / Withdraw panel */}
          <section className="z-card z-fade-up z-d3 flex flex-col p-6 sm:p-7 lg:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <div style={{ fontSize: 14, fontWeight: 500 }}>Deposit USDC</div>
              {isConnected && vaultReady && (
                <div className="z-num font-mono" style={{ fontSize: 11, color: 'var(--color-iron-veil)' }}>
                  Balance {parseFloat(usdcBalanceFormatted).toFixed(2)}
                </div>
              )}
            </div>

            {!vaultReady ? (
              <div className="flex flex-1 flex-col gap-5">
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center rounded-lg"
                  style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)' }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'var(--color-card)', border: '1px solid var(--border)' }}>
                    <Lock size={18} style={{ color: 'var(--color-smoke)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>Vault opens soon</div>
                    <p className="mx-auto mt-1.5" style={{ fontSize: 12, color: 'var(--color-iron-veil)', maxWidth: '28ch', lineHeight: 1.6 }}>
                      The Base Sepolia vault is being deployed. The strategy engine is already running.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                    style={{ border: '1px solid var(--border)', fontSize: 11, color: 'var(--color-smoke)' }}>
                    <span className="z-live-dot" /> Engine live · vault pending
                  </div>
                </div>
                {decision.blendedAPY > 0 && (
                  <div className="rounded-xl px-4 py-3.5" style={{ background: 'var(--color-iris-soft)', border: '1px solid rgba(86,131,218,0.2)', fontSize: 12, color: 'var(--color-smoke)', lineHeight: 1.6 }}>
                    At today's blended rate, <span className="z-num font-mono" style={{ color: 'var(--color-snow)' }}>$10,000</span> would earn ≈{' '}
                    <span className="z-num font-mono font-medium" style={{ color: 'var(--color-iris)' }}>
                      ${((10000 * decision.blendedAPY) / 100 / 12).toFixed(0)}/month
                    </span>
                  </div>
                )}
                {!isConnected && <div><ConnectButton /></div>}
              </div>
            ) : (
              <div className="flex flex-1 flex-col">
                {!isOnCorrectNetwork && isConnected && (
                  <div className="mb-4 rounded-lg px-4 py-3" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)', fontSize: 12, color: 'var(--color-warning)' }}>
                    Switch to Base Sepolia in your wallet to continue.
                  </div>
                )}

                {/* Amount input */}
                <div className="relative rounded" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)' }}>
                  <input
                    type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*"
                    value={depositAmount}
                    onChange={e => { const v = e.target.value; if (/^(\d*\.?\d*)$/.test(v)) setDepositAmount(v); }}
                    disabled={!isConnected || !isOnCorrectNetwork}
                    aria-label="Deposit amount in USDC"
                    className="z-num w-full bg-transparent px-5 py-5 font-mono outline-none placeholder:opacity-30 disabled:opacity-40"
                    style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em' }}
                    placeholder="0"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded text-xs font-medium"
                    style={{ background: 'var(--color-canvas)', color: 'var(--color-smoke)', border: '1px solid var(--border)' }}>
                    USDC
                  </span>
                </div>

                {/* Quick amounts */}
                <div className="flex gap-2 mt-3">
                  {[100, 1000, 5000].map(v => (
                    <button key={v} onClick={() => setDepositAmount(String(v))} disabled={!isConnected}
                      className="z-btn z-btn-ghost flex-1 py-2 text-xs rounded-full">
                      ${v.toLocaleString()}
                    </button>
                  ))}
                </div>

                {/* Projected earning */}
                {decision.blendedAPY > 0 && parseFloat(depositAmount) > 0 && (
                  <div className="mt-3" style={{ fontSize: 12, color: 'var(--color-iron-veil)' }}>
                    ≈ <span className="z-num font-mono font-medium" style={{ color: 'var(--color-iris)' }}>
                      ${((parseFloat(depositAmount) * decision.blendedAPY) / 100 / 12).toFixed(2)}/month
                    </span> at current blended rate
                  </div>
                )}

                <div className="flex-1" />

                {!isConnected ? (
                  <div className="mt-6"><ConnectButton /></div>
                ) : (
                  <button onClick={handleDeposit}
                    disabled={isDepositing || isTxPending || !isOnCorrectNetwork || parseFloat(depositAmount) <= 0}
                    className="z-btn z-btn-primary mt-6 w-full py-3.5 text-sm font-semibold">
                    {isDepositing && needsApproval ? 'Approving…' : isDepositing || isTxPending ? 'Depositing…' : needsApproval ? 'Approve & Deposit' : 'Deposit USDC'}
                    <ArrowUpRight size={15} />
                  </button>
                )}

                {/* Withdraw */}
                <div className="mt-7 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-2.5">
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-smoke)' }}>Withdraw zUSDC</div>
                    {parseFloat(userSharesFormatted) > 0 && (
                      <button onClick={() => setWithdrawAmount(userSharesFormatted)}
                        style={{ fontSize: 11, color: 'var(--color-iris)' }} className="hover:underline">
                        Max · {parseFloat(userSharesFormatted).toFixed(2)}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2.5">
                    <div className="flex-1 relative rounded" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)' }}>
                      <input type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*"
                        value={withdrawAmount}
                        onChange={e => { const v = e.target.value; if (/^(\d*\.?\d*)$/.test(v)) setWithdrawAmount(v); }}
                        placeholder="0.00"
                        disabled={!isConnected || parseFloat(userSharesFormatted) === 0 || !isOnCorrectNetwork}
                        aria-label="Withdraw amount in zUSDC"
                        className="z-num w-full bg-transparent px-4 py-2.5 font-mono outline-none placeholder:opacity-30 disabled:opacity-40"
                        style={{ fontSize: 16 }}
                      />
                    </div>
                    <button onClick={handleWithdraw}
                      disabled={!isConnected || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || !isOnCorrectNetwork || isWithdrawing}
                      className="z-btn z-btn-ghost px-5 text-xs rounded-full">
                      {isWithdrawing ? 'Withdrawing…' : 'Withdraw'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ── Rejected pools ────────────────────────────────────────── */}
        {decision.rejected.length > 0 && (
          <section className="z-card z-fade-up z-d4 mt-5 overflow-hidden">
            <div className="px-6 sm:px-7 pt-6 pb-1">
              <div className="flex items-center gap-2.5" style={{ fontSize: 14, fontWeight: 500 }}>
                <Radar size={14} style={{ color: 'var(--color-warning)' }} />
                What the keeper rejected — and why
              </div>
              <p className="mt-1.5" style={{ fontSize: 12, color: 'var(--color-iron-veil)' }}>
                Live Base stable pools that didn&apos;t make the cut. Most yield products hide this. We don&apos;t.
              </p>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[620px]" style={{ fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-iron-veil)' }}>
                    <th className="px-6 sm:px-7 py-3 text-left font-medium">Pool</th>
                    <th className="px-4 py-3 text-right font-medium">APY</th>
                    <th className="px-4 py-3 text-right font-medium">TVL</th>
                    <th className="px-4 py-3 text-right font-medium">Risk</th>
                    <th className="px-6 sm:px-7 py-3 text-left font-medium">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {decision.rejected.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                      className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-6 sm:px-7 py-3.5 font-medium">{r.name}</td>
                      <td className="z-num px-4 py-3.5 text-right font-mono" style={{ color: 'var(--color-warning)' }}>{r.apy.toFixed(2)}%</td>
                      <td className="z-num px-4 py-3.5 text-right font-mono" style={{ color: 'var(--color-iron-veil)' }}>
                        {r.tvlUsd > 0 ? `$${(r.tvlUsd / 1e6).toFixed(1)}M` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right"><RiskPill value={r.compositeRisk} /></td>
                      <td className="px-6 sm:px-7 py-3.5" style={{ fontSize: 12, color: 'var(--color-iron-veil)', maxWidth: '34ch' }}>{r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Activity ──────────────────────────────────────────────── */}
        <section className="z-card mt-5 p-6 sm:p-7">
          <div className="flex items-center justify-between mb-5">
            <div style={{ fontSize: 14, fontWeight: 500 }}>Vault activity</div>
            {!vaultReady && (
              <span className="z-tag" style={{ background: 'rgba(251,191,36,0.07)', color: 'var(--color-warning)', border: '1px solid rgba(251,191,36,0.25)' }}>
                Vault not deployed
              </span>
            )}
          </div>
          {activities.length > 0 ? (
            <div className="space-y-2">
              {activities.map((act, i) => {
                const isD = act.type === 'deposit';
                const isW = act.type === 'withdraw';
                const label = isD ? 'Deposit' : isW ? 'Withdrawal' : 'Rebalance';
                const amount = (isD || isW ? act.assets / 1e6 : (act.profit ?? 0) / 1e6).toFixed(2);
                const color = isW ? 'var(--color-danger)' : 'var(--color-iris)';
                const sender = act.sender ? `${act.sender.slice(0, 6)}…${act.sender.slice(-4)}` : null;
                return (
                  <div key={i} className="flex items-center justify-between px-4 py-3 rounded-lg"
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', fontSize: 12 }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        {label}
                        {sender && <span className="ml-2 font-normal" style={{ color: 'var(--color-iron-veil)' }}>by {sender}</span>}
                      </div>
                      <div className="mt-0.5" style={{ color: 'var(--color-iron-veil)', fontSize: 11 }}>
                        {new Date(act.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="z-num font-mono font-medium" style={{ color }}>{isW ? '−' : '+'}${amount}</div>
                      {act.txHash && (
                        <a href={`https://${ZIELD_CONFIG.chainId === 84532 ? 'sepolia.' : ''}basescan.org/tx/${act.txHash}`}
                          target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 mt-0.5 hover:underline"
                          style={{ fontSize: 10, color: 'var(--color-info)' }}>
                          View tx <ExternalLink size={9} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-iron-veil)' }}>No on-chain activity yet.</p>
          )}
        </section>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <footer className="mt-12 pt-8 pb-4 text-center" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="mx-auto max-w-2xl" style={{ fontSize: 11, color: 'var(--color-iron-veil)', lineHeight: 1.7 }}>
            <span style={{ color: 'var(--color-smoke)', fontWeight: 500 }}>Live sources:</span>{' '}
            {decision.liveSources.join(' · ')}
            <br />
            <span className="font-mono">{decision.modelVersion}</span> · Early software. Nothing here constitutes financial advice.
          </div>
        </footer>
      </main>

      {/* ── Simulation modal ─────────────────────────────────────────── */}
      {showSimModal && simulationReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowSimModal(false)} role="dialog" aria-modal aria-label="Rebalance simulation">
          <div className="z-card z-fade-up max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6 sm:p-8"
            style={{ background: 'var(--color-card)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1.5" style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-iris)' }}>
                  <Zap size={12} /> Keeper Simulation
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>Rebalance preflight</h2>
                <p style={{ fontSize: 12, color: 'var(--color-iron-veil)', marginTop: 2 }}>vs {simulationReport.baselineLabel}</p>
              </div>
              <button onClick={() => setShowSimModal(false)} className="z-btn z-btn-ghost w-8 h-8 rounded-lg p-0 text-sm" aria-label="Close">✕</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: `30d profit${simulationReport.proposedAction.referenceIsHypothetical ? ' / $10k' : ''}`, value: `+$${simulationReport.proposedAction.expected30DayProfitUsd}`, color: 'var(--color-iris)' },
                { label: 'Gas (live)', value: `$${simulationReport.proposedAction.estimatedGasUsd}`, color: 'var(--color-snow)' },
                { label: 'Net benefit', value: `${simulationReport.proposedAction.netBenefitRatio}×`, color: 'var(--color-iris)' },
                { label: 'Verdict', value: simulationReport.finalRecommendation, color: simulationReport.finalRecommendation === 'EXECUTE' ? 'var(--color-iris)' : 'var(--color-warning)' },
              ].map(({ label, value, color }) => (
                <div key={label} className="p-4 rounded-lg" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)' }}>
                  <div className="z-label mb-1.5">{label}</div>
                  <div className="z-num font-mono" style={{ fontSize: 18, fontWeight: 600, color }}>{value}</div>
                </div>
              ))}
            </div>

            <div className="mb-4">
              <div className="z-label mb-2.5">Proposed allocation changes</div>
              <div className="space-y-1.5">
                {simulationReport.allocationChanges.map((ch: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-lg"
                    style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)', fontSize: 12 }}>
                    <span style={{ fontWeight: 500 }}>{ch.strategy}</span>
                    <span className="z-num font-mono" style={{ color: ch.delta > 0 ? 'var(--color-iris)' : 'var(--color-warning)' }}>
                      {ch.current}% → {ch.proposed}%
                      <span className="ml-2 opacity-60">({ch.delta > 0 ? '+' : ''}{ch.delta}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg p-4 mb-4" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)' }}>
              <div className="z-label mb-1.5">Keeper rationale</div>
              <p style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--color-smoke)' }}>{simulationReport.rationale}</p>
            </div>

            {simulationReport.safetyGates && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4" style={{ fontSize: 11 }}>
                {Object.entries(simulationReport.safetyGates).map(([key, val]) => (
                  <span key={key} className="inline-flex items-center gap-1"
                    style={{ color: val ? 'var(--color-iris)' : 'var(--color-danger)' }}>
                    {val ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </span>
                ))}
              </div>
            )}

            {simulationReport.warnings?.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--color-warning)' }}>
                {simulationReport.warnings.map((w: string, i: number) => <div key={i}>⚠ {w}</div>)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
