"use client";

import { motion } from "framer-motion";
import { FileText, ExternalLink, Filter, Download, CheckCircle, XCircle, Repeat, ArrowUpRight, TrendingUp, Layers } from "lucide-react";
import { useState } from "react";

type ActionType = "all" | "transfer" | "trade" | "stake" | "identity" | "error";

interface AuditEntry {
  id: string;
  timestamp: string;
  actionType: Exclude<ActionType, "all">;
  description: string;
  txHash: string;
  success: boolean;
  gasUsed?: string;
}

const AUDIT_LOG: AuditEntry[] = [
  { id: "1", timestamp: "2026-06-10 11:02", actionType: "trade", description: "BUY 0.82 MNT @ $0.416 — RSI:42.3 bullish EMA9/EMA21 crossover", txHash: "0xabc...123f", success: true, gasUsed: "0.0002" },
  { id: "2", timestamp: "2026-06-10 10:45", actionType: "identity", description: "Recorded on-chain action #312 via ERC-8004 identity #1", txHash: "0xdef...456a", success: true, gasUsed: "0.0001" },
  { id: "3", timestamp: "2026-06-10 09:30", actionType: "transfer", description: "Transferred 12.5 USDY to 0x8f4a...3c2b (whitelist verified)", txHash: "0xghi...789b", success: true, gasUsed: "0.0003" },
  { id: "4", timestamp: "2026-06-10 08:15", actionType: "trade", description: "SELL 0.95 MNT @ $0.418 — take profit signal", txHash: "0xjkl...012c", success: true, gasUsed: "0.0002" },
  { id: "5", timestamp: "2026-06-10 07:00", actionType: "error", description: "Strategy execution failed — vault daily loss limit hit", txHash: "0xmno...345d", success: false, gasUsed: "0.0001" },
  { id: "6", timestamp: "2026-06-10 06:30", actionType: "stake", description: "Staked 5 MNT → 4.995 mETH via Mantle LSP", txHash: "0xpqr...678e", success: true, gasUsed: "0.0004" },
  { id: "7", timestamp: "2026-06-10 05:00", actionType: "trade", description: "BUY 0.71 MNT @ $0.393 — RSI oversold bounce", txHash: "0xstu...901f", success: true, gasUsed: "0.0002" },
];

const actionIcons: Record<Exclude<ActionType, "all">, React.ReactNode> = {
  transfer: <ArrowUpRight className="w-3.5 h-3.5" />,
  trade: <TrendingUp className="w-3.5 h-3.5" />,
  stake: <Layers className="w-3.5 h-3.5" />,
  identity: <FileText className="w-3.5 h-3.5" />,
  error: <XCircle className="w-3.5 h-3.5" />,
};

const actionColors: Record<Exclude<ActionType, "all">, string> = {
  transfer: "#00d4aa",
  trade: "#7c3aed",
  stake: "#f59e0b",
  identity: "#06b6d4",
  error: "#ef4444",
};

export function AuditTrailPanel() {
  const [filter, setFilter] = useState<ActionType>("all");

  const filtered = filter === "all" ? AUDIT_LOG : AUDIT_LOG.filter((e) => e.actionType === filter);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-[var(--color-green)]" />
          Audit Trail
        </h2>
        <button
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
          style={{ color: "var(--color-text-muted)", background: "rgba(255,255,255,0.04)" }}
        >
          <Download className="w-3 h-3" />
          CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {(["all", "transfer", "trade", "stake", "identity", "error"] as ActionType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-all"
            style={{
              background: filter === f ? (f === "all" ? "rgba(0,212,170,0.15)" : `${actionColors[f as Exclude<ActionType, "all">]}15`) : "rgba(255,255,255,0.04)",
              border: `1px solid ${filter === f ? (f === "all" ? "rgba(0,212,170,0.3)" : `${actionColors[f as Exclude<ActionType, "all">]}30`) : "rgba(255,255,255,0.06)"}`,
              color: filter === f ? (f === "all" ? "var(--color-green)" : actionColors[f as Exclude<ActionType, "all">]) : "var(--color-text-muted)",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="space-y-2 relative">
        <div
          className="absolute left-[17px] top-0 bottom-0 w-px"
          style={{ background: "linear-gradient(to bottom, rgba(0,212,170,0.3), transparent)" }}
        />
        {filtered.map((entry, i) => {
          const color = entry.success ? actionColors[entry.actionType] : "#ef4444";
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex gap-3 relative pl-1"
            >
              {/* Timeline dot */}
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 relative z-10"
                style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
              >
                {entry.success ? actionIcons[entry.actionType] : <XCircle className="w-3 h-3" />}
              </div>

              <div
                className="flex-1 p-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="text-xs text-[var(--color-text-secondary)] leading-snug flex-1">
                    {entry.description}
                  </div>
                  {entry.success ? (
                    <CheckCircle className="w-3 h-3 text-[var(--color-green)] flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-[var(--color-text-muted)]">{entry.timestamp}</span>
                  <a
                    href={`https://explorer.mantle.xyz/tx/${entry.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-0.5 font-mono hover:text-[var(--color-green)] transition-colors"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {entry.txHash} <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  {entry.gasUsed && (
                    <span className="text-[var(--color-text-muted)]">{entry.gasUsed} MNT gas</span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
