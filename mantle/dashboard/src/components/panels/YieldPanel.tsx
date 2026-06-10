"use client";

import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Layers } from "lucide-react";
import { useState, useEffect } from "react";

const FALLBACK_APY = 4.5;

interface MethStats {
  apy: number;
  totalStaked?: number;
  exchangeRate?: number;
}

// Historical mock (on-chain stats are not yet public API)
const YIELD_HISTORY = [
  { date: "Jan", apy: 4.1 },
  { date: "Feb", apy: 4.2 },
  { date: "Mar", apy: 4.3 },
  { date: "Apr", apy: 4.35 },
  { date: "May", apy: 4.4 },
  { date: "Jun", apy: 4.48 },
];

export function YieldPanel() {
  const [stats, setStats] = useState<MethStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEstimate, setIsEstimate] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("https://meth.mantle.xyz/api/v1/stats", {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Mantle LSP API shape varies; attempt common field names
        const apy =
          data.apy ??
          data.apr ??
          data.currentApy ??
          data.stakingApy ??
          FALLBACK_APY;
        setStats({
          apy: typeof apy === "number" ? apy : parseFloat(apy) || FALLBACK_APY,
          totalStaked: data.totalStaked ?? data.totalMNTStaked,
          exchangeRate: data.exchangeRate ?? data.mETHToMNT,
        });
        setIsEstimate(false);
      } catch {
        // Fallback — clearly labeled as estimate
        setStats({ apy: FALLBACK_APY });
        setIsEstimate(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const currentApy = stats?.apy ?? FALLBACK_APY;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-[var(--color-green)]" />
          mETH Yield
        </h2>
        <a
          href="https://meth.mantle.xyz"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-green)] transition-colors"
        >
          Mantle LSP ↗
        </a>
      </div>

      {/* APY Hero */}
      <div
        className="p-4 rounded-2xl mb-4 text-center relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(0,212,170,0.1) 0%, rgba(124,58,237,0.08) 100%)",
          border: "1px solid rgba(0,212,170,0.2)",
        }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background: "radial-gradient(ellipse at 50% 0%, rgba(0,212,170,0.4), transparent 70%)",
          }}
        />
        <div className="relative">
          <div className="text-xs text-[var(--color-text-muted)] mb-1 flex items-center justify-center gap-1">
            Current APY
            {isEstimate && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}
              >
                estimate
              </span>
            )}
          </div>
          {isLoading ? (
            <div className="loading-shimmer rounded h-12 w-24 mx-auto mb-1" />
          ) : (
            <motion.div
              className="text-5xl font-black mb-1"
              style={{ color: "var(--color-green)" }}
              animate={{
                textShadow: [
                  "0 0 20px rgba(0,212,170,0.4)",
                  "0 0 40px rgba(0,212,170,0.8)",
                  "0 0 20px rgba(0,212,170,0.4)",
                ],
              }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              {currentApy.toFixed(2)}%
            </motion.div>
          )}
          <div className="text-xs text-[var(--color-text-secondary)]">Mantle Liquid Staking Protocol</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Total Staked</div>
          {isLoading ? (
            <div className="loading-shimmer rounded h-4 w-20" />
          ) : stats?.totalStaked ? (
            <div className="font-bold text-white">
              {parseFloat(String(stats.totalStaked)).toLocaleString(undefined, { maximumFractionDigits: 0 })} MNT
            </div>
          ) : (
            <div className="font-bold text-[var(--color-text-muted)]">—</div>
          )}
        </div>
        <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Exchange Rate</div>
          {isLoading ? (
            <div className="loading-shimmer rounded h-4 w-20" />
          ) : stats?.exchangeRate ? (
            <div className="font-bold text-white">
              1 mETH = {parseFloat(String(stats.exchangeRate)).toFixed(4)} MNT
            </div>
          ) : (
            <div className="font-bold text-[var(--color-text-muted)]">—</div>
          )}
        </div>
        <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Est. Daily (1 MNT)</div>
          <div className="font-bold text-[var(--color-green)]">
            +{((currentApy / 100) / 365).toFixed(6)} MNT
          </div>
        </div>
        <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Est. Monthly (1 MNT)</div>
          <div className="font-bold text-white">
            +{((currentApy / 100) / 12).toFixed(4)} MNT
          </div>
        </div>
      </div>

      {/* APY Chart — historical mock */}
      <div>
        <div className="text-xs text-[var(--color-text-muted)] mb-2">APY History (mock)</div>
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={YIELD_HISTORY} margin={{ top: 2, right: 2, bottom: 0, left: -30 }}>
            <defs>
              <linearGradient id="apyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis domain={[4, 4.6]} hide />
            <Tooltip
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{ color: "var(--color-text-secondary)" }}
              formatter={(v: number) => [`${v}%`, "APY"]}
            />
            <Area type="monotone" dataKey="apy" stroke="#00d4aa" strokeWidth={2} fill="url(#apyGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
