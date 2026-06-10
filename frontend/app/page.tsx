'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useState, useEffect, useCallback } from 'react';
import { ArrowUpRight, Shield, Zap, RefreshCw, AlertTriangle, ChevronDown, Radar } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { toast } from 'sonner';
import { ZIELD_CONFIG, isVaultConfigured } from '../lib/config';

const USDC_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const VAULT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'redeem',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ name: 'assets', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

interface RiskVector {
  smartContract: number;
  market: number;
  liquidity: number;
  operational: number;
}

interface AllocationTarget {
  name: string;
  project: string;
  apy: number;
  tvlUsd: number;
  risk: RiskVector;
  compositeRisk: number;
  score: number;
  targetPct: number;
  rationale: string;
  color: string;
}

interface RejectedOpportunity {
  name: string;
  apy: number;
  tvlUsd: number;
  compositeRisk: number;
  reason: string;
}

interface KeeperDecision {
  timestamp: number;
  blendedAPY: number;
  portfolioRisk: number;
  riskLabel: string;
  vaultTvlUsd: number | null;
  est30dEarningsPer10k: number;
  estRebalanceGasUsd: number;
  netBenefitX: number;
  allocations: AllocationTarget[];
  rejected: RejectedOpportunity[];
  liveSources: string[];
  modelVersion: string;
}

const RISK_AXES: Array<{ key: keyof RiskVector; label: string }> = [
  { key: 'smartContract', label: 'Contract' },
  { key: 'market', label: 'Market' },
  { key: 'liquidity', label: 'Liquidity' },
  { key: 'operational', label: 'Operational' },
];

function riskColor(value: number): string {
  if (value < 25) return '#22c55e';
  if (value < 50) return '#f59e0b';
  return '#ef4444';
}

function RiskVectorBars({ risk }: { risk: RiskVector }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
      {RISK_AXES.map(({ key, label }) => (
        <div key={key}>
          <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
            <span>{label}</span>
            <span className="font-mono">{risk[key]}</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${risk[key]}%`, backgroundColor: riskColor(risk[key]) }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function ZieldDashboard() {
  const [decision, setDecision] = useState<KeeperDecision | null>(null);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState('1000');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isApproving, setIsApproving] = useState(false);
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
    address: ZIELD_CONFIG.usdcAddress,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: ZIELD_CONFIG.usdcAddress,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address && vaultReady ? [address, ZIELD_CONFIG.vaultAddress] : undefined,
    query: { enabled: !!address && vaultReady },
  });

  const { data: userShares, refetch: refetchShares } = useReadContract({
    address: ZIELD_CONFIG.vaultAddress,
    abi: VAULT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && vaultReady },
  });

  const amountInUnits = parseUnits(depositAmount || '0', 6);
  const needsApproval = allowance !== undefined && amountInUnits > allowance;

  const { writeContractAsync } = useWriteContract();

  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { isLoading: isTxPending, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const fetchKeeperDecision = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/keeper-decision');
      if (!res.ok) throw new Error('engine unavailable');
      const data = await res.json();
      setDecision(data);
    } catch {
      // keep the previous decision on transient failures; initial-load failure shows the retry screen
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
      setActivitiesIsDemo(true);
    }
  }, []);

  useEffect(() => {
    fetchKeeperDecision();
    fetchRecentActivity();
    // Keep the dashboard live without user interaction
    const interval = setInterval(fetchKeeperDecision, 150_000);
    return () => clearInterval(interval);
  }, [fetchKeeperDecision, fetchRecentActivity]);

  useEffect(() => {
    if (isTxSuccess) {
      toast.success('Transaction confirmed');
      setTxHash(undefined);
      refetchAllowance();
      refetchShares();
    }
  }, [isTxSuccess, refetchAllowance, refetchShares]);

  async function handleApprove() {
    if (!address || !vaultReady) return;
    setIsApproving(true);
    try {
      const hash = await writeContractAsync({
        address: ZIELD_CONFIG.usdcAddress,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [ZIELD_CONFIG.vaultAddress, amountInUnits],
      });
      setTxHash(hash);
      toast('Approval submitted', { description: 'Waiting for confirmation…' });
    } catch {
      toast.error('Approval failed or was rejected in your wallet.');
    } finally {
      setIsApproving(false);
    }
  }

  async function handleDeposit() {
    if (!address || !vaultReady) return;
    setIsDepositing(true);
    try {
      const hash = await writeContractAsync({
        address: ZIELD_CONFIG.vaultAddress,
        abi: VAULT_ABI,
        functionName: 'deposit',
        args: [amountInUnits, address],
      });
      setTxHash(hash);
      toast('Deposit submitted', { description: 'Your zUSDC shares will arrive on confirmation.' });
    } catch {
      toast.error('Deposit failed. Check your USDC balance and network.');
    } finally {
      setIsDepositing(false);
    }
  }

  async function handleWithdraw() {
    if (!address || !vaultReady || !withdrawAmount) return;
    setIsWithdrawing(true);
    try {
      const hash = await writeContractAsync({
        address: ZIELD_CONFIG.vaultAddress,
        abi: VAULT_ABI,
        functionName: 'redeem',
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

  if (!decision && loading) {
    return (
      <div className="min-h-screen bg-[var(--z-bg-0)] flex flex-col items-center justify-center gap-3 text-white">
        <Radar className="w-6 h-6 animate-pulse text-emerald-400" />
        <div className="text-sm text-zinc-400">Scanning live Base yield markets…</div>
      </div>
    );
  }

  if (!decision) {
    return (
      <div className="min-h-screen bg-[var(--z-bg-0)] flex flex-col items-center justify-center gap-4 text-white">
        <AlertTriangle className="w-6 h-6 text-amber-400" />
        <div className="text-sm text-zinc-400">The decision engine is temporarily unavailable.</div>
        <button
          onClick={fetchKeeperDecision}
          className="text-xs px-4 py-2 rounded-full border border-white/20 hover:bg-white/5"
        >
          Retry
        </button>
      </div>
    );
  }

  const usdcBalanceFormatted = usdcBalance ? formatUnits(usdcBalance, 6) : '0';
  const userSharesFormatted = userShares ? formatUnits(userShares, 6) : '0';

  const pieData = decision.allocations.map((a) => ({
    name: a.name,
    value: a.targetPct,
    color: a.color,
  }));

  return (
    <div className="min-h-screen bg-[var(--z-bg-0)] text-[var(--z-text-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--z-border)] bg-[var(--z-bg-0)]/95 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center">
                <span className="text-[var(--z-bg-0)] font-semibold text-[21px] tracking-[-2.5px] leading-none mt-[-1px]">Z</span>
              </div>
              <div className="font-semibold tracking-[-1.5px] text-[21px]">Zield</div>
            </div>
            <div className="ml-1 px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-medium tracking-[1px] text-white/40">BETA</div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-xs border transition-colors ${isOnCorrectNetwork ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isOnCorrectNetwork ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {isOnCorrectNetwork ? 'Base Sepolia' : 'Switch Network'}
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-x-12 gap-y-6 mb-10">
          <div className="max-w-[520px]">
            <div className="flex items-center gap-2 uppercase tracking-[2px] text-[11px] text-[var(--z-text-tertiary)] mb-2">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
              </span>
              <span>BASE • {decision.modelVersion.toUpperCase()} • UPDATED {timeAgo(decision.timestamp).toUpperCase()}</span>
            </div>
            <h1 className="text-[52px] leading-[1.05] font-semibold tracking-[-4.2px]">Risk-Adjusted<br />Yield</h1>
            <p className="mt-3 text-[17px] text-[var(--z-text-secondary)] max-w-[46ch]">
              Every number below is computed live from Base mainnet and real market data.
              The keeper refuses raw APY when the risk math says no — and shows you exactly why.
            </p>
            {!isConnected && (
              <div className="mt-5 text-sm text-[var(--z-text-secondary)]">
                Connect your wallet to start earning risk-aware yield.
              </div>
            )}
          </div>

          <div className="flex gap-12">
            <div>
              <div className="z-label mb-1.5">Blended APY</div>
              <div className="text-[52px] leading-none font-semibold tracking-[-3px] text-[var(--z-accent)] z-number">
                {decision.blendedAPY.toFixed(2)}<span className="text-3xl align-super">%</span>
              </div>
            </div>
            <div>
              <div className="z-label mb-1.5 flex items-center gap-1.5">
                Portfolio Risk <span className="text-[10px] opacity-60">(0–100, lower = safer)</span>
              </div>
              <div className="text-[52px] leading-none font-semibold tracking-[-3px] z-number">
                {decision.portfolioRisk}
              </div>
              <div className={`mt-1 text-sm ${decision.portfolioRisk < 35 ? 'text-[var(--z-accent)]' : 'text-amber-400'}`}>
                {decision.riskLabel} • {decision.allocations.length} strategies
              </div>
            </div>
          </div>
        </div>

        {/* Keeper recommendation */}
        <div className="mb-10 rounded-3xl border border-[var(--z-border-strong)] bg-[var(--z-bg-1)] p-7 shadow-sm">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <Zap className="w-4 h-4" /> KEEPER RECOMMENDATION — LIVE
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchKeeperDecision}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border border-white/10 hover:bg-white/5 active:bg-white/10 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={runSimulation}
                disabled={isSimulating}
                className="flex items-center gap-1.5 text-xs px-4 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 active:bg-emerald-500/30 disabled:opacity-50 font-medium"
              >
                {isSimulating ? 'Simulating…' : 'Simulate Rebalance'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
            <div>
              <div className="z-label mb-1">
                Est. 30-Day Earnings {decision.vaultTvlUsd === null && <span className="normal-case">(per $10k)</span>}
              </div>
              <div className="text-[42px] leading-none font-semibold tracking-[-2.5px] text-[var(--z-accent)] z-number">
                +${decision.est30dEarningsPer10k.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div className="z-label mb-1">Rebalance Gas (live est.)</div>
              <div className="text-[42px] leading-none font-semibold tracking-[-2.5px] text-[var(--z-warning)] z-number">
                ${decision.estRebalanceGasUsd.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="z-label mb-1">Net Benefit</div>
              <div className="text-[42px] leading-none font-semibold tracking-[-2.5px] text-[var(--z-accent)] z-number">
                {decision.netBenefitX.toLocaleString()}<span className="text-2xl align-super">×</span>
              </div>
            </div>
            <div className="flex items-end pb-1">
              <div className="text-[15px] leading-snug text-[var(--z-text-secondary)] max-w-[28ch]">
                Computed from {decision.liveSources.length} live sources. High-risk bucket capped at 20%.
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Allocation + risk transparency */}
          <div className="lg:col-span-3 z-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="font-medium flex items-center gap-2">
                <Shield className="w-4 h-4" /> Target Allocation (Risk-Capped)
              </div>
              <div className="text-xs px-2 py-1 rounded bg-white/5 border border-white/10">
                {decision.vaultTvlUsd !== null
                  ? `TVL $${decision.vaultTvlUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : 'Vault not yet live'}
              </div>
            </div>

            <div className="grid md:grid-cols-5 gap-8">
              <div className="md:col-span-3 space-y-2">
                {decision.allocations.map((strat) => {
                  const expanded = expandedStrategy === strat.project;
                  return (
                    <div key={strat.project} className="rounded-xl hover:bg-white/[0.03] transition-colors">
                      <button
                        onClick={() => setExpandedStrategy(expanded ? null : strat.project)}
                        className="w-full flex items-center gap-4 py-2 px-2 text-left"
                      >
                        <div className="w-36 text-sm font-medium text-white/90 truncate">{strat.name}</div>
                        <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${strat.targetPct}%`, backgroundColor: strat.color }}
                          />
                        </div>
                        <div className="w-12 text-right font-mono text-sm font-medium">{strat.targetPct}%</div>
                        <div className="w-28 text-right text-xs text-zinc-400">
                          {strat.apy.toFixed(2)}% • Risk {strat.compositeRisk}
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      </button>
                      {expanded && (
                        <div className="px-2 pb-4 pt-1">
                          <RiskVectorBars risk={strat.risk} />
                          <div className="mt-3 text-xs text-zinc-400 leading-relaxed">{strat.rationale}</div>
                          {strat.tvlUsd > 0 && (
                            <div className="mt-1 text-[10px] text-zinc-500">
                              Pool TVL ${(strat.tvlUsd / 1e6).toFixed(1)}M
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="text-[10px] text-zinc-500 pt-2 px-2">
                  Click a strategy to see its full 4-axis risk vector. Max 40% per strategy, 20% total in anything with composite risk &gt; 55.
                </div>
              </div>

              <div className="md:col-span-2 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        border: '1px solid #3f3f46',
                        borderRadius: '8px',
                        color: 'white',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Deposit / Withdraw */}
          <div className="lg:col-span-2 z-card p-7 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="font-medium">Deposit USDC</div>
              {isConnected && (
                <div className="text-xs text-zinc-400">
                  Balance: {parseFloat(usdcBalanceFormatted).toFixed(2)} USDC
                </div>
              )}
            </div>

            {!vaultReady && (
              <div className="mb-4 rounded-xl bg-amber-950/50 border border-amber-500/30 p-3 text-xs text-amber-300">
                No vault address configured. Deploy on Sepolia first, then set NEXT_PUBLIC_ZIELD_VAULT_ADDRESS.
              </div>
            )}

            {!isOnCorrectNetwork && isConnected && (
              <div className="mb-4 rounded-xl bg-red-950/50 border border-red-500/30 p-3 text-xs flex items-center gap-2 text-red-300">
                <AlertTriangle className="w-4 h-4" />
                Please switch to Base Sepolia in your wallet.
              </div>
            )}

            <div className="flex-1">
              <div className="relative">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  disabled={!isConnected || !isOnCorrectNetwork || !vaultReady}
                  className="w-full bg-black border border-white/20 rounded-2xl px-6 py-6 text-5xl font-semibold tracking-[-2px] focus:outline-none focus:border-white/40 disabled:opacity-50"
                />
                <div className="absolute right-6 top-7 text-2xl text-zinc-500">USDC</div>
              </div>

              <div className="flex gap-2 mt-3">
                {[100, 1000, 5000].map((v) => (
                  <button
                    key={v}
                    onClick={() => setDepositAmount(String(v))}
                    disabled={!isConnected}
                    className="flex-1 text-xs py-2 rounded-xl border border-white/10 hover:bg-white/5 active:bg-white/10 transition disabled:opacity-50"
                  >
                    ${v}
                  </button>
                ))}
              </div>

              {decision.blendedAPY > 0 && parseFloat(depositAmount) > 0 && (
                <div className="mt-3 text-xs text-zinc-400">
                  At the current blended rate, ${parseFloat(depositAmount).toLocaleString()} earns ≈{' '}
                  <span className="text-emerald-400 font-medium">
                    ${((parseFloat(depositAmount) * decision.blendedAPY) / 100 / 12).toFixed(2)}/month
                  </span>
                </div>
              )}

              {isConnected && parseFloat(userSharesFormatted) > 0 && (
                <div className="mt-3 text-xs text-emerald-400">
                  You own ≈ {parseFloat(userSharesFormatted).toFixed(2)} zUSDC shares
                </div>
              )}
            </div>

            {!isConnected ? (
              <div className="mt-6">
                <ConnectButton />
              </div>
            ) : needsApproval ? (
              <button
                onClick={handleApprove}
                disabled={isApproving || isTxPending || !vaultReady || !isOnCorrectNetwork}
                className="mt-6 w-full py-4 rounded-2xl bg-amber-500 text-black font-semibold disabled:opacity-50 active:bg-amber-400 transition"
              >
                {isApproving || isTxPending ? 'Approving…' : 'Approve USDC'}
              </button>
            ) : (
              <button
                onClick={handleDeposit}
                disabled={isDepositing || isTxPending || !vaultReady || !isOnCorrectNetwork || parseFloat(depositAmount) <= 0}
                className="mt-6 w-full py-4 rounded-2xl bg-white text-black font-semibold disabled:opacity-50 active:bg-zinc-200 transition flex items-center justify-center gap-2"
              >
                {isDepositing || isTxPending ? 'Depositing…' : 'Deposit & Mint zUSDC'} <ArrowUpRight className="w-4 h-4" />
              </button>
            )}

            <div className="text-center text-[10px] text-zinc-500 mt-3">
              {vaultReady
                ? 'You will receive zUSDC shares. The keeper allocates your capital across risk-adjusted strategies.'
                : 'Deploy the vault on Sepolia to enable real deposits.'}
            </div>

            {/* Withdraw */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-white/80">Withdraw zUSDC</div>
                {parseFloat(userSharesFormatted) > 0 && (
                  <button
                    onClick={() => setWithdrawAmount(userSharesFormatted)}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300"
                  >
                    Max
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={!isConnected || parseFloat(userSharesFormatted) === 0 || !vaultReady || !isOnCorrectNetwork}
                    className="w-full bg-black border border-white/20 rounded-2xl px-4 py-3 text-xl focus:outline-none focus:border-white/40 disabled:opacity-50"
                  />
                  <div className="absolute right-4 top-3.5 text-sm text-zinc-500">zUSDC</div>
                </div>

                <button
                  onClick={handleWithdraw}
                  disabled={
                    !isConnected ||
                    !withdrawAmount ||
                    parseFloat(withdrawAmount) <= 0 ||
                    !vaultReady ||
                    !isOnCorrectNetwork ||
                    isWithdrawing
                  }
                  className="px-8 rounded-2xl bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/20 text-sm font-medium disabled:opacity-50 transition"
                >
                  {isWithdrawing ? 'Withdrawing…' : 'Withdraw'}
                </button>
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px]">
                <span className="text-zinc-500">You hold ≈ {parseFloat(userSharesFormatted).toFixed(2)} zUSDC</span>
                <span className="text-zinc-500">1 zUSDC ≈ 1 USDC (plus accrued yield)</span>
              </div>
            </div>
          </div>
        </div>

        {/* What the keeper rejected — the transparency differentiator */}
        {decision.rejected.length > 0 && (
          <div className="mt-6 rounded-3xl border border-white/10 bg-zinc-900 overflow-hidden">
            <div className="px-6 pt-5 pb-1">
              <div className="font-medium flex items-center gap-2">
                <Radar className="w-4 h-4 text-amber-400" /> What the keeper rejected — and why
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                Live Base stable pools that didn&apos;t make the cut. Most yield products hide this. We don&apos;t.
              </div>
            </div>
            <table className="w-full text-sm mt-3">
              <thead className="border-b border-white/10 text-zinc-400 text-xs">
                <tr>
                  <th className="text-left py-3 px-6 font-normal">Pool</th>
                  <th className="text-right py-3 px-6 font-normal">APY</th>
                  <th className="text-right py-3 px-6 font-normal">Pool TVL</th>
                  <th className="text-right py-3 px-6 font-normal">Risk</th>
                  <th className="text-left py-3 px-6 font-normal">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {decision.rejected.map((r, i) => (
                  <tr key={i} className="hover:bg-white/5">
                    <td className="px-6 py-3 font-medium">{r.name}</td>
                    <td className="px-6 py-3 text-right font-mono text-amber-400">{r.apy.toFixed(2)}%</td>
                    <td className="px-6 py-3 text-right font-mono text-zinc-400">
                      {r.tvlUsd > 0 ? `$${(r.tvlUsd / 1e6).toFixed(1)}M` : '—'}
                    </td>
                    <td className="px-6 py-3 text-right font-mono" style={{ color: riskColor(r.compositeRisk) }}>
                      {r.compositeRisk}
                    </td>
                    <td className="px-6 py-3 text-xs text-zinc-400 max-w-[34ch]">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Recent keeper activity */}
        <div className="mt-8 rounded-3xl border border-white/10 bg-zinc-900 p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-white/70">Recent Keeper Activity</div>
            {activitiesIsDemo && (
              <div className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Demo data
              </div>
            )}
          </div>

          {activities.length > 0 ? (
            <div className="space-y-3 text-sm">
              {activities.map((act, i) => {
                const profit = act.profit || act.totalAssetsAfter - act.totalAssetsBefore;
                const profitUsd = (profit / 1e6).toFixed(0);
                const date = new Date(act.timestamp).toLocaleString();
                return (
                  <div key={i} className="flex justify-between items-center bg-black/30 px-4 py-3 rounded-2xl text-xs">
                    <div>
                      <div className="text-white/80">Rebalance executed</div>
                      <div className="text-zinc-500">{date}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-400 font-medium">+${profitUsd} profit</div>
                      {act.txHash && (
                        <a
                          href={`https://${ZIELD_CONFIG.chainId === 84532 ? 'sepolia.' : ''}basescan.org/tx/${act.txHash}`}
                          target="_blank"
                          className="text-[10px] text-blue-400 hover:underline"
                        >
                          View tx
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-zinc-400">No rebalances yet. Deploy a vault and run the keeper to see activity here.</div>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-zinc-500">
          Live sources: {decision.liveSources.join(' • ')}
          <br />
          Risk model {decision.modelVersion}. This is early software. Nothing here constitutes financial advice.
        </div>
      </div>

      {/* Simulation modal */}
      {showSimModal && simulationReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" onClick={() => setShowSimModal(false)}>
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-zinc-900 p-8 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-emerald-400 text-sm font-medium flex items-center gap-2">
                  <Zap className="w-4 h-4" /> KEEPER SIMULATION REPORT
                </div>
                <div className="text-3xl font-semibold tracking-tight mt-1">Rebalance Preflight</div>
                <div className="text-xs text-zinc-500 mt-1">vs {simulationReport.baselineLabel}</div>
              </div>
              <button onClick={() => setShowSimModal(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="rounded-2xl bg-black/40 p-4">
                <div className="text-zinc-400 text-xs">
                  Est. 30d Profit{simulationReport.proposedAction.referenceIsHypothetical ? ' (per $10k)' : ''}
                </div>
                <div className="text-2xl font-semibold text-emerald-400">
                  +${simulationReport.proposedAction.expected30DayProfitUsd}
                </div>
              </div>
              <div className="rounded-2xl bg-black/40 p-4">
                <div className="text-zinc-400 text-xs">Gas Cost (live)</div>
                <div className="text-2xl font-semibold text-amber-400">${simulationReport.proposedAction.estimatedGasUsd}</div>
              </div>
              <div className="rounded-2xl bg-black/40 p-4">
                <div className="text-zinc-400 text-xs">Net Benefit</div>
                <div className="text-2xl font-semibold text-emerald-400">{simulationReport.proposedAction.netBenefitRatio}×</div>
              </div>
              <div className="rounded-2xl bg-black/40 p-4">
                <div className="text-zinc-400 text-xs">Final Verdict</div>
                <div className={`text-2xl font-semibold ${simulationReport.finalRecommendation === 'EXECUTE' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {simulationReport.finalRecommendation}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-sm font-medium mb-2 text-white/80">Proposed Allocation Changes</div>
              <div className="space-y-2 text-sm">
                {simulationReport.allocationChanges.map((change: any, i: number) => (
                  <div key={i} className="flex justify-between bg-black/30 px-4 py-2 rounded-xl">
                    <span>{change.strategy}</span>
                    <span className={change.delta > 0 ? 'text-emerald-400' : 'text-amber-400'}>
                      {change.current}% → {change.proposed}% ({change.delta > 0 ? '+' : ''}{change.delta}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 text-sm bg-black/40 p-4 rounded-2xl">
              <div className="font-medium mb-1">Keeper Rationale</div>
              <div className="text-zinc-300">{simulationReport.rationale}</div>
            </div>

            {simulationReport.safetyGates && (
              <div className="mt-4 text-xs flex flex-wrap gap-x-4 gap-y-1">
                {Object.entries(simulationReport.safetyGates).map(([key, val]) => (
                  <div key={key} className={val ? 'text-emerald-400' : 'text-red-400'}>
                    {val ? '✓' : '✗'} {key.replace(/([A-Z])/g, ' $1')}
                  </div>
                ))}
              </div>
            )}

            {simulationReport.warnings?.length > 0 && (
              <div className="mt-3 text-xs text-amber-400">
                {simulationReport.warnings.map((w: string, i: number) => (
                  <div key={i}>⚠ {w}</div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowSimModal(false)}
              className="mt-8 w-full py-3 rounded-2xl border border-white/20 hover:bg-white/5 active:bg-white/10"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
