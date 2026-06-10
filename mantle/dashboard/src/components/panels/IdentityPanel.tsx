"use client";

import { motion } from "framer-motion";
import { Fingerprint, Activity, ExternalLink, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { useAgentIdentity } from "@/hooks/useContractState";
import { getContractAddresses } from "@/lib/config";

interface RecentAction {
  actionType: string;
  description: string;
  txHash: string;
  timestamp: number;
  success: boolean;
}

function ReputationBar({ score }: { score: number }) {
  const pct = (score / 1000) * 100;
  const color = score >= 800 ? "#00d4aa" : score >= 500 ? "#f59e0b" : "#ef4444";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[var(--color-text-muted)]">Reputation</span>
        <span style={{ color }} className="font-bold font-mono">{score}/1000</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}99)`, boxShadow: `0 0 8px ${color}60` }}
        />
      </div>
    </div>
  );
}

function timeAgo(timestamp: number): string {
  if (!timestamp) return "unknown";
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function IdentityPanel() {
  const [identityAddress, setIdentityAddress] = useState<`0x${string}` | undefined>(undefined);
  const [agentAddress, setAgentAddress] = useState<`0x${string}` | undefined>(undefined);
  const [apiActions, setApiActions] = useState<RecentAction[]>([]);

  useEffect(() => {
    const addrs = getContractAddresses();
    if (addrs?.identityAddress && addrs.identityAddress.startsWith("0x")) {
      setIdentityAddress(addrs.identityAddress as `0x${string}`);
    }
    if (addrs?.walletAddress && addrs.walletAddress.startsWith("0x")) {
      // We'll get agent from wallet; for now use walletAddress as proxy
      setAgentAddress(addrs.walletAddress as `0x${string}`);
    }
  }, []);

  const { tokenId, name, agentType, reputation, actionCount, lastActive, isLoading } =
    useAgentIdentity(identityAddress, agentAddress);

  // Fetch recent actions from API
  useEffect(() => {
    if (!identityAddress || !agentAddress) return;
    fetch(`/api/identity?contract=${identityAddress}&agent=${agentAddress}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.actions && Array.isArray(d.actions)) {
          setApiActions(d.actions);
        }
      })
      .catch(() => {});
  }, [identityAddress, agentAddress]);

  const hasIdentity = tokenId > 0;

  const daysActive = lastActive
    ? Math.floor((Date.now() / 1000 - lastActive) / 86400)
    : 0;

  return (
    <div className="card overflow-hidden">
      <div
        className="p-5"
        style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(0,212,170,0.08) 100%)",
          borderBottom: "1px solid rgba(0,212,170,0.1)",
        }}
      >
        {isLoading ? (
          <div className="space-y-3">
            <div className="loading-shimmer rounded-xl h-16 w-full" />
            <div className="loading-shimmer rounded h-4 w-3/4" />
          </div>
        ) : !hasIdentity && identityAddress ? (
          /* No identity — show mint CTA */
          <div className="text-center py-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)" }}
            >
              <Fingerprint className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="font-bold text-white mb-1">No Identity Found</h3>
            <p className="text-xs text-[var(--color-text-secondary)] mb-3">
              Mint an ERC-8004 identity NFT to establish your agent&apos;s on-chain reputation.
            </p>
            <button
              className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.4)", color: "#a78bfa" }}
            >
              <Sparkles className="w-4 h-4" />
              Mint Identity
            </button>
          </div>
        ) : !identityAddress ? (
          <div className="text-center py-4 text-xs text-[var(--color-text-muted)]">
            Configure Identity Contract Address to see live identity data
          </div>
        ) : (
          <>
            <div className="flex items-start gap-4">
              <motion.div
                animate={{ rotate: [0, 2, -2, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="relative w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, #7c3aed 0%, #00d4aa 100%)",
                  boxShadow: "0 0 30px rgba(0,212,170,0.3), 0 0 60px rgba(124,58,237,0.2)",
                }}
              >
                <Fingerprint className="w-8 h-8 text-white" />
                <div
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
                  style={{ background: "#00d4aa", color: "#0a0a0f" }}
                >
                  #{tokenId}
                </div>
              </motion.div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-black text-white text-base">{name || "Unnamed Agent"}</h3>
                  <span className="status-badge live text-[10px] px-1.5 py-0.5">ACTIVE</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] mb-2">
                  <span
                    className="px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "rgba(124,58,237,0.2)", color: "#a78bfa" }}
                  >
                    {agentType || "agent"}
                  </span>
                  {agentAddress && (
                    <span className="font-mono text-[var(--color-text-muted)] truncate">
                      {agentAddress.slice(0, 8)}...{agentAddress.slice(-4)}
                    </span>
                  )}
                </div>
                <ReputationBar score={reputation} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="text-center p-2 rounded-xl" style={{ background: "rgba(0,0,0,0.2)" }}>
                <div className="text-lg font-black text-white">{actionCount}</div>
                <div className="text-[10px] text-[var(--color-text-muted)]">Actions</div>
              </div>
              <div className="text-center p-2 rounded-xl" style={{ background: "rgba(0,0,0,0.2)" }}>
                <div className="text-lg font-black text-[var(--color-green)]">{reputation}</div>
                <div className="text-[10px] text-[var(--color-text-muted)]">Rep Score</div>
              </div>
              <div className="text-center p-2 rounded-xl" style={{ background: "rgba(0,0,0,0.2)" }}>
                <div className="text-lg font-black text-purple-400">{daysActive}</div>
                <div className="text-[10px] text-[var(--color-text-muted)]">Days Active</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recent Actions */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-[var(--color-green)]" />
            On-Chain Actions
          </h3>
          <span className="text-xs text-[var(--color-text-muted)]">via ERC-8004</span>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="loading-shimmer rounded-lg h-10 w-full" />
            ))}
          </div>
        ) : apiActions.length > 0 ? (
          <div className="space-y-2">
            {apiActions.map((action, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-start gap-2 text-xs py-2 px-2 rounded-lg"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0"
                  style={{
                    background: action.success ? "var(--color-green)" : "#ef4444",
                    boxShadow: `0 0 4px ${action.success ? "var(--color-green)" : "#ef4444"}`,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[var(--color-text-secondary)] truncate">{action.description || action.actionType}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[var(--color-text-muted)] font-mono">
                      {action.txHash ? `${action.txHash.slice(0, 10)}...` : "no hash"}
                    </span>
                    {action.txHash && (
                      <a
                        href={`https://explorer.sepolia.mantle.xyz/tx/${action.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-2.5 h-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-green)] transition-colors" />
                      </a>
                    )}
                  </div>
                </div>
                <span className="text-[var(--color-text-muted)] flex-shrink-0">{timeAgo(action.timestamp)}</span>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-[var(--color-text-muted)] text-center py-4">
            {identityAddress ? "No on-chain actions recorded yet" : "Configure contracts to see actions"}
          </div>
        )}
      </div>
    </div>
  );
}
