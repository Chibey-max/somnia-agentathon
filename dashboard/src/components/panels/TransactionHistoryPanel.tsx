'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { Panel, Badge } from '@/components/shared';
import { useEvents } from '@/hooks/useEvents';
import { formatAddress, formatETH, formatSelector, getExplorerLink } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export function TransactionHistoryPanel() {
  const { events, loading, error, refetch } = useEvents(50, 60000);
  const [filter, setFilter] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filtered = filter
    ? events.filter(
        (e) =>
          e.target.toLowerCase().includes(filter.toLowerCase()) ||
          e.selector.toLowerCase().includes(filter.toLowerCase()) ||
          e.action.toLowerCase().includes(filter.toLowerCase()) ||
          e.txHash.toLowerCase().includes(filter.toLowerCase())
      )
    : events;

  return (
    <Panel
      title="Transaction History"
      subtitle="On-chain wallet events"
      status={error ? 'warn' : 'ok'}
      loading={loading}
      actions={
        <button onClick={refetch} className="text-text-muted hover:text-green transition-colors p-1">
          <RefreshCw size={12} />
        </button>
      }
    >
      <div className="flex flex-col h-full">
        {/* Filter bar */}
        <div className="px-4 py-2 border-b border-border">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by target, action, selector, or tx hash..."
            className="w-full bg-bg-elevated border border-border rounded px-3 py-1.5 text-xs font-mono text-text-primary placeholder-text-muted focus:outline-none focus:border-green/50 transition-colors"
          />
        </div>

        {error && (
          <div className="px-4 py-2 text-red text-xs font-mono border-b border-border">
            Error: {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-text-muted text-xs font-mono">
              {loading ? 'Loading...' : 'No transactions found'}
            </div>
          ) : (
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-text-muted uppercase tracking-wider font-normal">Time</th>
                  <th className="text-left px-4 py-2 text-text-muted uppercase tracking-wider font-normal">Target</th>
                  <th className="text-left px-4 py-2 text-text-muted uppercase tracking-wider font-normal">Value</th>
                  <th className="text-left px-4 py-2 text-text-muted uppercase tracking-wider font-normal">Action</th>
                  <th className="text-left px-4 py-2 text-text-muted uppercase tracking-wider font-normal">Tx</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((event, i) => (
                  <tr
                    key={`${event.txHash}-${event.logIndex}`}
                    className="border-b border-border/50 hover:bg-bg-elevated transition-colors animate-fade-in"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <td className="px-4 py-2 text-text-muted whitespace-nowrap" suppressHydrationWarning>
                      {mounted && event.timestamp
                        ? formatDistanceToNow(new Date(event.timestamp * 1000), { addSuffix: true })
                        : `#${event.blockNumber}`}
                    </td>
                    <td className="px-4 py-2 text-text-primary whitespace-nowrap">
                      <a
                        href={getExplorerLink(event.target, 'address')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-bright transition-colors flex items-center gap-1 group"
                      >
                        {formatAddress(event.target)}
                        <ExternalLink size={9} className="opacity-0 group-hover:opacity-100" />
                      </a>
                    </td>
                    <td className="px-4 py-2">
                      {event.value !== '0' ? (
                        <span className="text-green">{formatETH(BigInt(event.value))} ETH</span>
                      ) : (
                        <span className="text-text-muted">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {event.action === 'Executed' ? (
                        event.selector === '0x00000000' ? (
                          <Badge variant="blue">ETH Transfer</Badge>
                        ) : (
                          <span className="text-text-secondary">{formatSelector(event.selector)}</span>
                        )
                      ) : (
                        <Badge variant="green">{event.action}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {event.txHash ? (
                        <a
                          href={getExplorerLink(event.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-bright hover:underline flex items-center gap-1 group"
                        >
                          {event.txHash.slice(0, 8)}...
                          <ExternalLink size={9} className="opacity-0 group-hover:opacity-100" />
                        </a>
                      ) : (
                        <span className="text-text-muted">pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-4 py-2 border-t border-border text-text-muted text-xs font-mono flex justify-between">
          <span>{filtered.length} events</span>
          <span>Auto-refresh: 60s</span>
        </div>
      </div>
    </Panel>
  );
}
