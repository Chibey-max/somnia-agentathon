'use client';

import { RefreshCw } from 'lucide-react';
import { Panel, Stat, Badge, AddressDisplay, Button } from '@/components/shared';
import { useContractState } from '@/hooks/useContractState';
import { CONTRACT_ADDRESS } from '@/lib/contract';

export function OverviewPanel() {
  const { data, loading, error, refetch, lastUpdated } = useContractState();

  return (
    <Panel
      title="Overview"
      subtitle={`Contract: ${CONTRACT_ADDRESS.slice(0, 6)}...${CONTRACT_ADDRESS.slice(-4)}`}
      status={data?.paused ? 'error' : error ? 'warn' : 'ok'}
      loading={loading}
      actions={
        <button onClick={refetch} className="text-text-muted hover:text-green transition-colors p-1">
          <RefreshCw size={12} />
        </button>
      }
    >
      <div className="p-4 space-y-5">
        {error && (
          <div className="bg-red/10 border border-red/30 rounded px-3 py-2 text-red text-xs font-mono">
            RPC ERROR: {error}
          </div>
        )}

        {/* Status badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {data?.paused ? (
            <Badge variant="red" pulse>⚠ PAUSED</Badge>
          ) : (
            <Badge variant="green" pulse>● ACTIVE</Badge>
          )}
          <Badge variant="blue">Sepolia</Badge>
          {lastUpdated && (
            <span className="text-text-muted text-xs font-mono">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Grid of stats */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-text-muted text-xs font-mono uppercase tracking-wider mb-1">ETH Balance</p>
            <p className="text-green font-mono text-lg font-bold">
              {data ? parseFloat(data.balanceFormatted).toFixed(6) : '—'}
            </p>
            <p className="text-text-muted font-mono text-xs">ETH</p>
          </div>
          <div>
            <p className="text-text-muted text-xs font-mono uppercase tracking-wider mb-1">Network</p>
            <p className="text-text-primary font-mono text-sm font-bold">Ethereum</p>
            <p className="text-text-muted font-mono text-xs">Sepolia Testnet</p>
          </div>
        </div>

        {/* Addresses */}
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-text-muted text-xs font-mono uppercase tracking-wider mb-2">Roles</p>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between bg-bg-elevated rounded px-3 py-2">
              <span className="text-text-muted text-xs font-mono">CONTRACT</span>
              <AddressDisplay address={CONTRACT_ADDRESS} />
            </div>
            <div className="flex items-center justify-between bg-bg-elevated rounded px-3 py-2">
              <span className="text-text-muted text-xs font-mono">AGENT</span>
              {data ? <AddressDisplay address={data.agent} /> : <span className="text-text-muted text-xs font-mono">—</span>}
            </div>
            <div className="flex items-center justify-between bg-bg-elevated rounded px-3 py-2">
              <span className="text-text-muted text-xs font-mono">GUARDIAN</span>
              {data ? <AddressDisplay address={data.guardian} /> : <span className="text-text-muted text-xs font-mono">—</span>}
            </div>
            {data?.pendingAgent && data.pendingAgent !== '0x0000000000000000000000000000000000000000' && (
              <div className="flex items-center justify-between bg-orange/5 border border-orange/20 rounded px-3 py-2">
                <span className="text-orange text-xs font-mono">PENDING AGENT</span>
                <AddressDisplay address={data.pendingAgent} />
              </div>
            )}
          </div>
        </div>

        {/* Chain ID */}
        <div className="flex justify-between items-center text-xs font-mono text-text-muted pt-1 border-t border-border">
          <span>CHAIN ID</span>
          <span className="text-text-secondary">11155111</span>
        </div>
      </div>
    </Panel>
  );
}
