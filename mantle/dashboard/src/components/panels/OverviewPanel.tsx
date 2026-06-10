"use client";

import { motion } from "framer-motion";
import { Shield, Pause, Play } from "lucide-react";
import { useState, useEffect } from "react";
import { useWalletState, useSpendingLimits, MANTLE_TOKENS } from "@/hooks/useContractState";
import { getContractAddresses } from "@/lib/config";

interface TokenRow {
  symbol: string;
  amount: string;
  icon: string;
  color: string;
}

export function OverviewPanel() {
  const [walletAddress, setWalletAddress] = useState<`0x${string}` | undefined>(undefined);

  useEffect(() => {
    const addrs = getContractAddresses();
    if (addrs?.walletAddress && addrs.walletAddress.startsWith("0x")) {
      setWalletAddress(addrs.walletAddress as `0x${string}`);
    }
  }, []);

  const { mntBalance, methBalance, usdyBalance, isPaused, guardianAddress, isLoading } =
    useWalletState(walletAddress);

  const { dailySpent, dailyLimit, isLoading: limitsLoading } = useSpendingLimits(
    walletAddress,
    MANTLE_TOKENS.MNT
  );

  const paused = isPaused === true;
  const dailyPct = dailyLimit > 0 ? (dailySpent / dailyLimit) * 100 : 0;
  const gaugeColor = dailyPct > 80 ? "#ef4444" : dailyPct > 50 ? "#f59e0b" : "#00d4aa";
  const circumference = 2 * Math.PI * 56;

  const tokens: TokenRow[] = [
    { symbol: "MNT", amount: mntBalance, icon: "M", color: "#00d4aa" },
    { symbol: "mETH", amount: methBalance, icon: "E", color: "#7c3aed" },
    { symbol: "USDY", amount: usdyBalance, icon: "U", color: "#f59e0b" },
  ];

  const shimmer = "loading-shimmer rounded-lg";

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-bold text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-[var(--color-green)]" />
          Agent Overview
        </h2>
        <div className="flex items-center gap-2">
          <span className={`status-badge ${paused ? "warning" : "live"}`}>
            <span className={paused ? "" : "live-dot"} />
            {isLoading ? "..." : paused ? "PAUSED" : "ACTIVE"}
          </span>
        </div>
      </div>

      {/* Circular Gauge — Daily Limit */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r="56" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
            <circle
              cx="70" cy="70" r="56"
              fill="none"
              stroke={gaugeColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={`${circumference * (1 - dailyPct / 100)}`}
              transform="rotate(-90 70 70)"
              style={{ transition: "stroke-dashoffset 1s ease, stroke 0.3s ease" }}
            />
            <circle
              cx="70" cy="70" r="56"
              fill="none"
              stroke="rgba(0,212,170,0.15)"
              strokeWidth="18"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={`${circumference * (1 - dailyPct / 100)}`}
              transform="rotate(-90 70 70)"
              style={{ filter: "blur(4px)" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {limitsLoading ? (
              <div className={`${shimmer} w-12 h-6 mb-1`} />
            ) : (
              <>
                <div className="text-2xl font-black text-white">{dailyPct.toFixed(0)}%</div>
                <div className="text-xs text-[var(--color-text-secondary)]">daily used</div>
                <div className="text-xs font-mono text-[var(--color-green)]">
                  {dailySpent.toFixed(2)}/{dailyLimit.toFixed(2)} MNT
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Token Balances */}
      <div className="space-y-3 mb-5">
        {tokens.map((token) => (
          <motion.div
            key={token.symbol}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-[var(--color-bg)]"
              style={{ background: token.color }}
            >
              {token.icon}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">{token.symbol}</div>
            </div>
            <div className="text-right">
              {isLoading ? (
                <div className={`${shimmer} w-16 h-4`} />
              ) : (
                <div className="text-sm font-bold text-white">{token.amount}</div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Guardian Status */}
      <div
        className="flex items-center justify-between p-3 rounded-xl mb-3"
        style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}
      >
        <div className="flex items-center gap-2 text-xs">
          <Shield className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[var(--color-text-secondary)]">Guardian</span>
          {isLoading ? (
            <div className={`${shimmer} w-20 h-3`} />
          ) : guardianAddress ? (
            <span className="font-mono text-purple-300 text-[10px]">
              {guardianAddress.slice(0, 6)}...{guardianAddress.slice(-4)}
            </span>
          ) : (
            <span className="font-mono text-[var(--color-text-muted)] text-[10px]">not set</span>
          )}
        </div>
        <span
          className="status-badge"
          style={{
            background: "rgba(124,58,237,0.1)",
            border: "1px solid rgba(124,58,237,0.3)",
            color: "#a78bfa",
            fontSize: "0.65rem",
          }}
        >
          {paused ? "PAUSED" : "ACTIVE"}
        </span>
      </div>

      {/* Status note — no local pause button since contract requires guardian tx */}
      <div
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold ${
          paused
            ? "bg-yellow-500/10 border border-yellow-500/30 text-yellow-400"
            : "bg-[var(--color-green)]/10 border border-[var(--color-green)]/20 text-[var(--color-green)]"
        }`}
      >
        {paused ? (
          <>
            <Pause className="w-4 h-4" /> Agent is Paused (guardian action required)
          </>
        ) : (
          <>
            <Play className="w-4 h-4" /> Agent Active — policy enforced
          </>
        )}
      </div>
    </div>
  );
}
