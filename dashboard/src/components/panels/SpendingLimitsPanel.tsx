'use client';

import { Panel, Stat, ProgressBar, Countdown, Badge } from '@/components/shared';
import { useContractState } from '@/hooks/useContractState';

export function SpendingLimitsPanel() {
  const { data, loading, error } = useContractState();

  const spentPercent = data?.dailySpentPercent ?? 0;
  const panelStatus = spentPercent >= 90 ? 'error' : spentPercent >= 70 ? 'warn' : 'ok';

  return (
    <Panel
      title="Spending Limits"
      subtitle="STT per-tx and daily caps"
      status={loading ? 'ok' : panelStatus}
      loading={loading}
    >
      <div className="p-4 space-y-5">
        {error && (
          <div className="text-red text-xs font-mono">Error loading limits</div>
        )}

        {/* Current limits */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-bg-elevated rounded p-3 border border-border">
            <p className="text-text-muted text-xs font-mono uppercase tracking-wider mb-1">Per-TX Limit</p>
            <p className="text-text-primary font-mono text-sm font-bold">
              {data ? parseFloat(data.ethTxLimitFormatted).toFixed(6) : '—'}
            </p>
            <p className="text-text-muted font-mono text-xs">STT max/tx</p>
          </div>
          <div className="bg-bg-elevated rounded p-3 border border-border">
            <p className="text-text-muted text-xs font-mono uppercase tracking-wider mb-1">Daily Limit</p>
            <p className="text-text-primary font-mono text-sm font-bold">
              {data ? parseFloat(data.ethDailyLimitFormatted).toFixed(6) : '—'}
            </p>
            <p className="text-text-muted font-mono text-xs">STT/day</p>
          </div>
        </div>

        {/* Daily spend progress */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-text-muted text-xs font-mono uppercase tracking-wider">Daily Spent</p>
            <div className="flex items-center gap-2">
              <span className="text-text-secondary text-xs font-mono">
                {data ? parseFloat(data.ethDailySpentFormatted).toFixed(6) : '0.000000'}
                {' / '}
                {data ? parseFloat(data.ethDailyLimitFormatted).toFixed(6) : '0.000000'} STT
              </span>
            </div>
          </div>
          <ProgressBar value={spentPercent} warn={70} danger={90} />
          {spentPercent >= 90 && (
            <div className="text-red text-xs font-mono flex items-center gap-1">
              <span className="animate-blink">▲</span> DAILY LIMIT CRITICAL
            </div>
          )}
          {spentPercent >= 70 && spentPercent < 90 && (
            <div className="text-orange text-xs font-mono flex items-center gap-1">
              <span>▲</span> LIMIT APPROACHING
            </div>
          )}
        </div>

        {/* Pending limit change */}
        {data?.pendingLimitChange && (
          <div className="border border-orange/40 bg-orange/5 rounded p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="orange">⏳ Pending Limit Change</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <p className="text-text-muted text-xs font-mono">New Per-TX</p>
                <p className="text-orange font-mono text-xs font-bold">
                  {parseFloat(data.pendingLimitChange.txLimitFormatted).toFixed(6)} STT
                </p>
              </div>
              <div>
                <p className="text-text-muted text-xs font-mono">New Daily</p>
                <p className="text-orange font-mono text-xs font-bold">
                  {parseFloat(data.pendingLimitChange.dailyLimitFormatted).toFixed(6)} STT
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-orange/20">
              <span className="text-text-muted text-xs font-mono">Unlocks in:</span>
              <Countdown unlockTimeMs={data.pendingLimitChange.unlockTimeMs} />
            </div>
          </div>
        )}

        {!data?.pendingLimitChange && (
          <div className="text-text-muted text-xs font-mono flex items-center gap-2">
            <span className="text-green">✓</span> No pending limit changes
          </div>
        )}
      </div>
    </Panel>
  );
}
