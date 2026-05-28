'use client';

import { X, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';

interface SimulationReport {
  timestamp: number;
  vaultAddress: string;
  currentState: {
    tvlUsd: number;
    blendedAPY: number;
    portfolioRisk: number;
  };
  proposedAction: {
    newBlendedAPY: number;
    newPortfolioRisk: number;
    expected7DayProfitUsd: number;
    estimatedGasUsd: number;
    netBenefitRatio: number;
  };
  allocationChanges: Array<{
    strategy: string;
    current: number;
    proposed: number;
    delta: number;
  }>;
  safetyGates: Record<string, boolean>;
  finalRecommendation: 'EXECUTE' | 'BLOCKED';
  rationale: string;
  warnings: string[];
}

interface SimulationModalProps {
  report: SimulationReport | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SimulationModal({ report, isOpen, onClose }: SimulationModalProps) {
  if (!isOpen || !report) return null;

  const isExecute = report.finalRecommendation === 'EXECUTE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div 
        className="w-full max-w-4xl rounded-3xl border border-white/10 bg-zinc-900 text-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2 ${isExecute ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
              {isExecute ? (
                <CheckCircle className="h-5 w-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              )}
            </div>
            <div>
              <div className="text-sm text-zinc-400">KEEPER SIMULATION</div>
              <div className="text-xl font-semibold tracking-tight">Rebalance Preflight Report</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-zinc-950 p-4 border border-white/5">
              <div className="text-xs text-zinc-400">Expected 7-Day Profit</div>
              <div className="mt-1 text-3xl font-semibold text-emerald-400">
                +${report.proposedAction.expected7DayProfitUsd.toLocaleString()}
              </div>
            </div>
            <div className="rounded-2xl bg-zinc-950 p-4 border border-white/5">
              <div className="text-xs text-zinc-400">Gas Cost (est.)</div>
              <div className="mt-1 text-3xl font-semibold text-amber-400">
                ${report.proposedAction.estimatedGasUsd}
              </div>
            </div>
            <div className="rounded-2xl bg-zinc-950 p-4 border border-white/5">
              <div className="text-xs text-zinc-400">Net Benefit Ratio</div>
              <div className="mt-1 text-3xl font-semibold text-emerald-400">
                {report.proposedAction.netBenefitRatio}x
              </div>
            </div>
            <div className="rounded-2xl bg-zinc-950 p-4 border border-white/5">
              <div className="text-xs text-zinc-400">Verdict</div>
              <div className={`mt-1 text-3xl font-semibold ${isExecute ? 'text-emerald-400' : 'text-amber-400'}`}>
                {report.finalRecommendation}
              </div>
            </div>
          </div>

          {/* Allocation Changes */}
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white/80">
              <TrendingUp className="h-4 w-4" /> Proposed Allocation Changes
            </div>
            <div className="space-y-2">
              {report.allocationChanges.map((change, index) => (
                <div key={index} className="flex items-center justify-between rounded-2xl bg-zinc-950 px-4 py-3 text-sm border border-white/5">
                  <div className="font-medium">{change.strategy}</div>
                  <div className="flex items-center gap-4 text-right">
                    <div className="text-zinc-400">
                      {change.current}% → <span className="text-white">{change.proposed}%</span>
                    </div>
                    <div className={`font-medium ${change.delta >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {change.delta >= 0 ? '+' : ''}{change.delta}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Safety Gates */}
          <div>
            <div className="mb-3 text-sm font-medium text-white/80">Safety Gates</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {Object.entries(report.safetyGates).map(([key, passed]) => (
                <div 
                  key={key} 
                  className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 ${passed ? 'bg-emerald-950/40 text-emerald-400' : 'bg-red-950/40 text-red-400'}`}
                >
                  {passed ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rationale */}
          <div className="rounded-2xl bg-zinc-950 p-5 border border-white/5">
            <div className="mb-2 text-sm font-medium text-white/70">Keeper Rationale</div>
            <p className="text-sm leading-relaxed text-zinc-300">{report.rationale}</p>
          </div>

          {report.warnings.length > 0 && (
            <div className="text-xs text-amber-400">
              Warnings: {report.warnings.join(', ')}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 px-6 py-4 flex justify-end">
          <button 
            onClick={onClose}
            className="rounded-2xl border border-white/20 px-6 py-2.5 text-sm hover:bg-white/5 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
