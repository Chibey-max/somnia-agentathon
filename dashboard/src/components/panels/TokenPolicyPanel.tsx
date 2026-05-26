'use client';

import { useState } from 'react';
import { Panel, Badge, ProgressBar, Button, Input } from '@/components/shared';
import { useAccount, useWriteContract } from 'wagmi';
import { CONTRACT_ADDRESS, AGENT_WALLET_ABI } from '@/lib/contract';
import { useContractState } from '@/hooks/useContractState';
import { parseEther, createPublicClient, fallback, http } from 'viem';
import { sepolia } from 'viem/chains';
import { RPC_URLS } from '@/lib/contract';
import { formatAddress } from '@/lib/utils';

interface TokenPolicyEntry {
  token: string;
  dailyLimit: string;
  dailySpent: string;
  lastReset: string;
  enabled: boolean;
  symbol?: string;
}

export function TokenPolicyPanel() {
  const { data: contractData, loading } = useContractState();
  const { address: walletAddress } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [policies, setPolicies] = useState<TokenPolicyEntry[]>([]);
  const [newToken, setNewToken] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [lookupToken, setLookupToken] = useState('');
  const [lookupResult, setLookupResult] = useState<TokenPolicyEntry | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const isGuardian = walletAddress?.toLowerCase() === contractData?.guardian?.toLowerCase();

  const handleLookup = async () => {
    if (!lookupToken) return;
    setLookupLoading(true);
    try {
      const client = createPublicClient({
        chain: sepolia,
        transport: fallback(RPC_URLS.map((url) => http(url))),
      });
      const result = await client.readContract({
        address: CONTRACT_ADDRESS,
        abi: AGENT_WALLET_ABI,
        functionName: 'tokenPolicy',
        args: [lookupToken as `0x${string}`],
      }) as [bigint, bigint, bigint, boolean];
      const [dailyLimit, dailySpent, lastReset, enabled] = result;
      setLookupResult({
        token: lookupToken,
        dailyLimit: dailyLimit.toString(),
        dailySpent: dailySpent.toString(),
        lastReset: lastReset.toString(),
        enabled,
      });
      if (enabled && !policies.find(p => p.token.toLowerCase() === lookupToken.toLowerCase())) {
        setPolicies(prev => [...prev, {
          token: lookupToken,
          dailyLimit: dailyLimit.toString(),
          dailySpent: dailySpent.toString(),
          lastReset: lastReset.toString(),
          enabled,
        }]);
      }
    } catch (err) {
      setTxStatus(`Lookup error: ${String(err).slice(0, 60)}`);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSetPolicy = async () => {
    if (!newToken || !newLimit) return;
    try {
      setTxStatus('Setting policy...');
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: AGENT_WALLET_ABI,
        functionName: 'setTokenPolicy',
        args: [newToken as `0x${string}`, parseEther(newLimit)],
      });
      setTxStatus('✓ Token policy set.');
      setNewToken('');
      setNewLimit('');
    } catch (err) {
      setTxStatus(`Error: ${String(err).slice(0, 80)}`);
    }
  };

  const handleRevoke = async (token: string) => {
    try {
      setTxStatus('Revoking...');
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: AGENT_WALLET_ABI,
        functionName: 'revokeTokenPolicy',
        args: [token as `0x${string}`],
      });
      setTxStatus('✓ Policy revoked.');
      setPolicies(prev => prev.filter(p => p.token !== token));
    } catch (err) {
      setTxStatus(`Error: ${String(err).slice(0, 80)}`);
    }
  };

  return (
    <Panel
      title="Token Policy"
      subtitle="ERC-20 daily spend limits"
      loading={loading}
    >
      <div className="p-4 space-y-4">
        {/* Lookup section */}
        <div className="space-y-2">
          <p className="text-text-muted text-xs font-mono uppercase tracking-wider">Lookup Token Policy</p>
          <div className="flex gap-2">
            <input
              value={lookupToken}
              onChange={(e) => setLookupToken(e.target.value)}
              placeholder="Token contract address (0x...)"
              className="flex-1 bg-bg-elevated border border-border rounded px-3 py-1.5 text-xs font-mono text-text-primary placeholder-text-muted focus:outline-none focus:border-green/50"
            />
            <Button variant="ghost" size="sm" onClick={handleLookup} loading={lookupLoading}>
              Lookup
            </Button>
          </div>
        </div>

        {/* Lookup result */}
        {lookupResult && (
          <div className={`border rounded p-3 space-y-2 ${lookupResult.enabled ? 'border-green/30 bg-green/5' : 'border-border bg-bg-elevated'}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono text-text-muted">{formatAddress(lookupResult.token)}</p>
              <Badge variant={lookupResult.enabled ? 'green' : 'gray'}>
                {lookupResult.enabled ? 'ACTIVE' : 'INACTIVE'}
              </Badge>
            </div>
            {lookupResult.enabled && (
              <>
                <ProgressBar
                  value={
                    BigInt(lookupResult.dailyLimit) > 0n
                      ? Number((BigInt(lookupResult.dailySpent) * 10000n) / BigInt(lookupResult.dailyLimit)) / 100
                      : 0
                  }
                  label="Daily spend"
                />
                <div className="text-xs font-mono text-text-muted">
                  {lookupResult.dailySpent} / {lookupResult.dailyLimit} wei
                </div>
              </>
            )}
            {isGuardian && lookupResult.enabled && (
              <Button variant="danger" size="sm" onClick={() => handleRevoke(lookupResult.token)} loading={isPending}>
                Revoke Policy
              </Button>
            )}
          </div>
        )}

        {/* Tracked policies */}
        {policies.length > 0 && (
          <div className="space-y-2">
            <p className="text-text-muted text-xs font-mono uppercase tracking-wider">Active Policies</p>
            {policies.filter(p => p.enabled).map((policy) => (
              <div key={policy.token} className="border border-green/20 bg-green/5 rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-text-primary">{formatAddress(policy.token)}</span>
                  <Badge variant="green">Active</Badge>
                </div>
                <ProgressBar
                  value={
                    BigInt(policy.dailyLimit) > 0n
                      ? Number((BigInt(policy.dailySpent) * 10000n) / BigInt(policy.dailyLimit)) / 100
                      : 0
                  }
                />
                {isGuardian && (
                  <Button variant="danger" size="sm" onClick={() => handleRevoke(policy.token)} loading={isPending}>
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Guardian: set new policy */}
        {isGuardian && (
          <div className="border border-border rounded p-3 space-y-3">
            <p className="text-text-secondary text-xs font-mono uppercase tracking-wider">Set Token Policy</p>
            <Input
              label="Token Address"
              value={newToken}
              onChange={setNewToken}
              placeholder="0x..."
            />
            <Input
              label="Daily Limit (ETH units)"
              value={newLimit}
              onChange={setNewLimit}
              placeholder="100.0"
              type="number"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleSetPolicy}
              disabled={!newToken || !newLimit || isPending}
              loading={isPending}
            >
              Set Policy
            </Button>
          </div>
        )}

        {txStatus && (
          <div className={`text-xs font-mono rounded px-3 py-2 border ${
            txStatus.startsWith('✓') ? 'text-green border-green/30 bg-green/5' : 'text-orange border-orange/30 bg-orange/5'
          }`}>
            {txStatus}
          </div>
        )}
      </div>
    </Panel>
  );
}
