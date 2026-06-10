"use client";

import { motion } from "framer-motion";
import { Sliders, Clock, Edit2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useSpendingLimits, MANTLE_TOKENS } from "@/hooks/useContractState";
import { getContractAddresses } from "@/lib/config";

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const trackColor = pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : color;
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(pct, 100)}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="h-full rounded-full"
        style={{
          background: trackColor,
          boxShadow: `0 0 8px ${trackColor}60`,
        }}
      />
    </div>
  );
}

interface TokenLimitRowProps {
  token: string;
  color: string;
  tokenAddress: `0x${string}`;
  walletAddress?: `0x${string}`;
  isEditing: boolean;
  onEditToggle: () => void;
}

function TokenLimitRow({ token, color, tokenAddress, walletAddress, isEditing, onEditToggle }: TokenLimitRowProps) {
  const { perTxLimit, dailyLimit, dailySpent, isLoading } = useSpendingLimits(walletAddress, tokenAddress);
  const spentPct = dailyLimit > 0 ? (dailySpent / dailyLimit) * 100 : 0;
  const textColor = spentPct > 80 ? "#ef4444" : spentPct > 50 ? "#f59e0b" : color;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
          <span className="text-sm font-semibold text-white">{token}</span>
        </div>
        <button
          onClick={onEditToggle}
          className="p-1 rounded hover:bg-white/5 transition-colors"
          style={{ color: "var(--color-text-muted)" }}
        >
          <Edit2 className="w-3 h-3" />
        </button>
      </div>

      {isLoading ? (
        <div className="loading-shimmer rounded h-2 w-full mb-1.5" />
      ) : (
        <ProgressBar pct={spentPct} color={color} />
      )}

      <div className="flex justify-between mt-1.5 text-xs">
        {isLoading ? (
          <div className="loading-shimmer rounded h-3 w-24" />
        ) : (
          <span style={{ color: textColor }}>
            {dailySpent.toFixed(4)} / {dailyLimit.toFixed(4)} {token} daily
          </span>
        )}
        {!isLoading && (
          <span style={{ color: "var(--color-text-muted)" }}>
            {perTxLimit.toFixed(4)} {token} / tx
          </span>
        )}
      </div>

      {isEditing && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-3 p-3 rounded-xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="text-xs text-[var(--color-text-muted)] mb-2">
            Updating limits requires a 2-day timelock via guardian.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-[var(--color-text-secondary)] block mb-1">Per TX</label>
              <input
                type="number"
                defaultValue={perTxLimit}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-mono text-white"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-secondary)] block mb-1">Daily</label>
              <input
                type="number"
                defaultValue={dailyLimit}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-mono text-white"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
            </div>
          </div>
          <button
            className="mt-2 w-full py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: "rgba(0,212,170,0.15)", color: "var(--color-green)", border: "1px solid rgba(0,212,170,0.3)" }}
          >
            Schedule Update (2-day timelock)
          </button>
        </motion.div>
      )}
    </div>
  );
}

export function SpendingLimitsPanel() {
  const [editingToken, setEditingToken] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<`0x${string}` | undefined>(undefined);

  useEffect(() => {
    const addrs = getContractAddresses();
    if (addrs?.walletAddress && addrs.walletAddress.startsWith("0x")) {
      setWalletAddress(addrs.walletAddress as `0x${string}`);
    }
  }, []);

  const tokens = [
    { token: "MNT", color: "#00d4aa", address: MANTLE_TOKENS.MNT },
    { token: "mETH", color: "#7c3aed", address: MANTLE_TOKENS.METH },
    { token: "USDY", color: "#f59e0b", address: MANTLE_TOKENS.USDY },
  ];

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-bold text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[var(--color-green)]" />
          Spending Limits
        </h2>
        <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
          <Clock className="w-3 h-3" /> 2-day timelock
        </span>
      </div>

      {!walletAddress && (
        <div className="text-xs text-[var(--color-text-muted)] text-center py-4">
          Configure contract address to see live limits
        </div>
      )}

      <div className="space-y-5">
        {tokens.map(({ token, color, address }) => (
          <TokenLimitRow
            key={token}
            token={token}
            color={color}
            tokenAddress={address}
            walletAddress={walletAddress}
            isEditing={editingToken === token}
            onEditToggle={() => setEditingToken(editingToken === token ? null : token)}
          />
        ))}
      </div>
    </div>
  );
}
