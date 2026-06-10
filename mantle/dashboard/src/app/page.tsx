"use client";

import { motion } from "framer-motion";
import { Activity, TrendingUp, Shield, Zap, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import { OverviewPanel } from "@/components/panels/OverviewPanel";
import { SpendingLimitsPanel } from "@/components/panels/SpendingLimitsPanel";
import { TokenPolicyPanel } from "@/components/panels/TokenPolicyPanel";
import { TradingPanel } from "@/components/panels/TradingPanel";
import { IdentityPanel } from "@/components/panels/IdentityPanel";
import { SkillsPanel } from "@/components/panels/SkillsPanel";
import { YieldPanel } from "@/components/panels/YieldPanel";
import { AuditTrailPanel } from "@/components/panels/AuditTrailPanel";
import { GuardianControlPanel } from "@/components/panels/GuardianControlPanel";
import { AgentChatPanel } from "@/components/panels/AgentChatPanel";
import { ConnectWalletBanner } from "@/components/shared/ConnectWalletBanner";
import { ContractConfigPanel } from "@/components/shared/ContractConfigPanel";
import { useWalletState, useAgentIdentity, useSpendingLimits, MANTLE_TOKENS } from "@/hooks/useContractState";
import { getContractAddresses } from "@/lib/config";

function MiniSparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 28;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="opacity-70">
      <polyline
        points={points}
        fill="none"
        stroke="#00d4aa"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

function LiveStatsBar() {
  const { address: connectedAddress } = useAccount();
  const [walletAddr, setWalletAddr] = useState<`0x${string}` | undefined>(undefined);
  const [identityAddr, setIdentityAddr] = useState<`0x${string}` | undefined>(undefined);

  useEffect(() => {
    const addrs = getContractAddresses();
    if (addrs?.walletAddress?.startsWith("0x")) {
      setWalletAddr(addrs.walletAddress as `0x${string}`);
    }
    if (addrs?.identityAddress?.startsWith("0x")) {
      setIdentityAddr(addrs.identityAddress as `0x${string}`);
    }
  }, []);

  // Use connected wallet address for balance if no contract configured
  const balanceTarget = walletAddr || connectedAddress;
  const { mntBalance, isLoading: walletLoading } = useWalletState(balanceTarget);
  const { dailyRemaining, dailyLimit, isLoading: limitsLoading } = useSpendingLimits(
    walletAddr,
    MANTLE_TOKENS.MNT
  );
  const { reputation, isLoading: idLoading } = useAgentIdentity(identityAddr, walletAddr);

  const remainingPct = dailyLimit > 0 ? ((dailyRemaining / dailyLimit) * 100).toFixed(0) : "—";

  const stats = [
    {
      label: "MNT Balance",
      value: walletLoading ? "..." : mntBalance,
      unit: "MNT",
      change: connectedAddress ? "live" : "connect wallet",
      positive: true,
      icon: <Zap className="w-4 h-4" />,
      sparkData: [40, 45, 42, 50, 55, 52, 60, 58, 65, parseFloat(mntBalance) || 0],
    },
    {
      label: "Daily Limit",
      value: limitsLoading ? "..." : dailyRemaining.toFixed(2),
      unit: "MNT left",
      change: remainingPct !== "—" ? `${remainingPct}% remaining` : "not configured",
      positive: true,
      icon: <Shield className="w-4 h-4" />,
      sparkData: [10, 10, 9.5, 9, 8.5, 8, 7.8, 7.5, 7.3, dailyRemaining || 7.2],
    },
    {
      label: "Active Positions",
      value: "3",
      unit: "positions",
      change: "+1 today",
      positive: true,
      icon: <TrendingUp className="w-4 h-4" />,
      sparkData: [0, 1, 1, 2, 2, 2, 3, 3, 3, 3],
    },
    {
      label: "Reputation",
      value: idLoading ? "..." : reputation > 0 ? String(reputation) : "—",
      unit: "/ 1000",
      change: reputation > 0 ? "on-chain" : "no identity",
      positive: reputation > 0,
      icon: <Activity className="w-4 h-4" />,
      sparkData: [700, 720, 735, 750, 770, 790, 810, 825, 838, reputation || 847],
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
    >
      {stats.map((stat) => (
        <motion.div key={stat.label} variants={itemVariants}>
          <div className="card p-4 hover:glow-green transition-all duration-300">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider mb-1">
                  {stat.label}
                </div>
                <div className="text-2xl font-black text-white tracking-tight">
                  {stat.value}
                  <span className="text-sm font-normal text-[var(--color-text-secondary)] ml-1">
                    {stat.unit}
                  </span>
                </div>
              </div>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(0,212,170,0.1)", color: "var(--color-green)" }}
              >
                {stat.icon}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs">
                {stat.positive ? (
                  <ArrowUpRight className="w-3 h-3 text-[var(--color-green)]" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 text-red-400" />
                )}
                <span className={stat.positive ? "text-[var(--color-green)]" : "text-red-400"}>
                  {stat.change}
                </span>
              </div>
              <MiniSparkline data={stat.sparkData} />
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

function HeroIdentityChip() {
  const [walletAddr, setWalletAddr] = useState<`0x${string}` | undefined>(undefined);
  const [identityAddr, setIdentityAddr] = useState<`0x${string}` | undefined>(undefined);

  useEffect(() => {
    const addrs = getContractAddresses();
    if (addrs?.walletAddress?.startsWith("0x")) setWalletAddr(addrs.walletAddress as `0x${string}`);
    if (addrs?.identityAddress?.startsWith("0x")) setIdentityAddr(addrs.identityAddress as `0x${string}`);
  }, []);

  const { tokenId, name, reputation } = useAgentIdentity(identityAddr, walletAddr);
  const displayName = name || "Mantle AI Agent";
  const displayTokenId = tokenId > 0 ? tokenId : 1;
  const displayRep = reputation > 0 ? reputation : "—";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3 }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border"
      style={{
        background: "rgba(124,58,237,0.08)",
        borderColor: "rgba(124,58,237,0.3)",
      }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
        style={{ background: "linear-gradient(135deg, #7c3aed, #00d4aa)" }}
      >
        M
      </div>
      <div>
        <div className="text-xs text-[var(--color-text-muted)] font-medium">ERC-8004 Identity</div>
        <div className="text-sm font-bold text-white">
          Token #{displayTokenId} · {displayName}
        </div>
      </div>
      <div className="ml-2 text-xs font-mono text-[var(--color-green)]">
        Rep: {displayRep}
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen px-4 pb-12 max-w-[1600px] mx-auto">
      {/* ─── Connect Wallet Banner ───────────────────────────────────────────── */}
      <div className="pt-4">
        <ConnectWalletBanner />
      </div>

      {/* ─── Hero Header ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="pt-4 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight gradient-text">
              Mantle AI Agent
            </h1>
            <span className="status-badge live">
              <span className="live-dot" />
              LIVE ON MANTLE
            </span>
          </div>
          <p className="text-[var(--color-text-secondary)] text-sm max-w-xl">
            Autonomous, policy-enforced agentic wallet with ERC-8004 on-chain identity.
            Every decision is verifiable, every action is recorded.
          </p>
        </div>

        <HeroIdentityChip />
      </motion.div>

      {/* ─── Contract Config Panel ────────────────────────────────────────────── */}
      <ContractConfigPanel />

      {/* ─── Stats Bar ───────────────────────────────────────────────────────── */}
      <LiveStatsBar />

      {/* ─── Main Panel Grid ──────────────────────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Column 1 */}
        <div className="space-y-6">
          <motion.div variants={itemVariants}>
            <OverviewPanel />
          </motion.div>
          <motion.div variants={itemVariants}>
            <SpendingLimitsPanel />
          </motion.div>
          <motion.div variants={itemVariants}>
            <GuardianControlPanel />
          </motion.div>
        </div>

        {/* Column 2 */}
        <div className="space-y-6">
          <motion.div variants={itemVariants}>
            <TradingPanel />
          </motion.div>
          <motion.div variants={itemVariants}>
            <YieldPanel />
          </motion.div>
          <motion.div variants={itemVariants}>
            <TokenPolicyPanel />
          </motion.div>
        </div>

        {/* Column 3 */}
        <div className="space-y-6">
          <motion.div variants={itemVariants}>
            <IdentityPanel />
          </motion.div>
          <motion.div variants={itemVariants}>
            <SkillsPanel />
          </motion.div>
          <motion.div variants={itemVariants}>
            <AuditTrailPanel />
          </motion.div>
        </div>
      </motion.div>

      {/* ─── Agent Chat — Full Width ──────────────────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        className="mt-6"
      >
        <AgentChatPanel />
      </motion.div>
    </div>
  );
}
