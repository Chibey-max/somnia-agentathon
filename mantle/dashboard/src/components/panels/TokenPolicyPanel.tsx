"use client";

import { motion } from "framer-motion";
import { Coins, CheckCircle, XCircle } from "lucide-react";

const TOKENS = [
  {
    symbol: "MNT",
    name: "Mantle Token",
    address: "0x78c1...f4cb8",
    color: "#00d4aa",
    icon: "M",
    enabled: true,
    perTx: "1.0 MNT",
    daily: "10 MNT",
  },
  {
    symbol: "mETH",
    name: "Mantle LSP",
    address: "0xcDA8...b0bb0",
    color: "#7c3aed",
    icon: "E",
    enabled: true,
    perTx: "0.01 mETH",
    daily: "0.1 mETH",
  },
  {
    symbol: "USDY",
    name: "Yield Stablecoin",
    address: "0x5bE2...57c5A9",
    color: "#f59e0b",
    icon: "U",
    enabled: true,
    perTx: "100 USDY",
    daily: "1000 USDY",
  },
];

export function TokenPolicyPanel() {
  return (
    <div className="card p-5">
      <h2 className="font-bold text-white flex items-center gap-2 mb-5">
        <Coins className="w-4 h-4 text-[var(--color-green)]" />
        Token Policies
      </h2>
      <div className="space-y-3">
        {TOKENS.map((token, i) => (
          <motion.div
            key={token.symbol}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-3 rounded-xl"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${token.color}20`,
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${token.color}20, ${token.color}40)`,
                  color: token.color,
                  border: `1px solid ${token.color}40`,
                }}
              >
                {token.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-white">{token.symbol}</span>
                  <div className="flex items-center gap-1 text-xs" style={{ color: token.enabled ? "#00d4aa" : "#ef4444" }}>
                    {token.enabled ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {token.enabled ? "Active" : "Disabled"}
                  </div>
                </div>
                <div className="text-xs text-[var(--color-text-muted)] font-mono truncate mb-2">{token.address}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-[10px] rounded-lg px-2 py-1" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="text-[var(--color-text-muted)] mb-0.5">Per TX</div>
                    <div className="font-mono font-semibold" style={{ color: token.color }}>{token.perTx}</div>
                  </div>
                  <div className="text-[10px] rounded-lg px-2 py-1" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="text-[var(--color-text-muted)] mb-0.5">Daily</div>
                    <div className="font-mono font-semibold" style={{ color: token.color }}>{token.daily}</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
