'use client';

import { useAccount, useBalance } from 'wagmi';
import { ShieldCheck, Timer } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { CONTRACT_ADDRESS } from '@/lib/contract';
import { formatEther } from 'viem';

export function Navbar() {
  const { address } = useAccount();
  const { data: balance } = useBalance({ address });
  const { data: contractBalance } = useBalance({ address: CONTRACT_ADDRESS });

  return (
    <header className="sticky top-0 z-50 bg-bg/95 backdrop-blur border-b border-border">
      <div className="max-w-[1600px] mx-auto px-4 h-12 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green animate-pulse" />
            <span className="font-mono text-xs font-bold text-green tracking-widest uppercase">ETH Agent</span>
          </div>
          <span className="text-border-bright text-xs">|</span>
          <span className="font-mono text-xs text-text-muted">Sepolia Testnet</span>
        </div>

        {/* Center: contract balance */}
        {contractBalance && (
          <div className="hidden md:flex items-center gap-2 font-mono text-xs">
            <span className="text-text-muted">Vault Balance:</span>
            <span className="text-green font-bold">
              {parseFloat(formatEther(contractBalance.value)).toFixed(6)} ETH
            </span>
          </div>
        )}

        {/* Wallet */}
        <div className="flex items-center gap-2">
          {balance && (
            <span className="font-mono text-xs text-text-muted hidden sm:block">
              {parseFloat(formatEther(balance.value)).toFixed(4)} ETH
            </span>
          )}
          <ConnectButton chainStatus="icon" showBalance={false} accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }} />
        </div>
      </div>

      {/* Network status bar */}
      <div className="border-t border-border/50 bg-bg px-4 py-1.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green" />
          <span className="font-mono text-xs text-text-muted">
            {CONTRACT_ADDRESS.slice(0, 6)}...{CONTRACT_ADDRESS.slice(-4)}
          </span>
        </div>

        <div className="flex items-center gap-4 text-text-muted text-xs font-mono">
          <span>CHAIN:11155111</span>
          <span className="text-border-bright">|</span>
          <span className="inline-flex items-center gap-1"><Timer size={12} /> TIMELOCK:10MIN</span>
          <span className="text-border-bright">|</span>
          <span className="inline-flex items-center gap-1"><ShieldCheck size={12} /> REENTRANCY:GUARDED</span>
        </div>
      </div>
    </header>
  );
}
