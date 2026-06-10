"use client";

import { motion } from "framer-motion";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart,
} from "recharts";
import { TrendingUp, TrendingDown, Activity, Target, AlertTriangle } from "lucide-react";

const PRICE_DATA = Array.from({ length: 48 }, (_, i) => {
  const base = 0.40;
  const trend = Math.sin(i / 8) * 0.02;
  const noise = (Math.random() - 0.5) * 0.01;
  const close = base + trend + noise;
  return {
    time: `${String(i % 24).padStart(2, "0")}:00`,
    open: close - 0.002,
    high: close + 0.004,
    low: close - 0.003,
    close,
    volume: 800 + Math.random() * 2000,
    ema9: base + trend * 0.9,
    ema21: base + trend * 0.7,
  };
});

const RSI_DATA = PRICE_DATA.map((d, i) => ({
  time: d.time,
  rsi: 50 + Math.sin(i / 5) * 25 + (Math.random() - 0.5) * 10,
}));

const POSITIONS = [
  { id: "0xabc", symbol: "MNT/USDT", side: "LONG", size: "0.82 MNT", entryPrice: "$0.393", markPrice: "$0.416", pnl: "+$0.019", pnlPct: "+4.83%", positive: true },
  { id: "0xdef", symbol: "MNT/USDT", side: "LONG", size: "0.71 MNT", entryPrice: "$0.388", markPrice: "$0.416", pnl: "+$0.020", pnlPct: "+7.22%", positive: true },
  { id: "0xghi", symbol: "mETH/USDT", side: "LONG", size: "0.01 mETH", entryPrice: "$3,380", markPrice: "$3,401", pnl: "+$0.21", pnlPct: "+0.62%", positive: true },
];

export default function TradingPage() {
  return (
    <div className="min-h-screen px-4 pb-12 max-w-[1600px] mx-auto pt-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-3xl font-black text-white mb-1">AI Trading Desk</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Quant strategy: RSI(14) + EMA(9/21) crossover · Risk-managed via TradingVault
        </p>
      </motion.div>

      {/* Signal Banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-4 p-4 rounded-2xl mb-6"
        style={{
          background: "linear-gradient(135deg, rgba(0,212,170,0.1), rgba(0,212,170,0.05))",
          border: "1px solid rgba(0,212,170,0.25)",
          boxShadow: "0 0 30px rgba(0,212,170,0.08)",
        }}
      >
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,212,170,0.2)" }}>
          <TrendingUp className="w-6 h-6 text-[var(--color-green)]" />
        </div>
        <div className="flex-1">
          <div className="text-lg font-black text-[var(--color-green)]">BUY SIGNAL — 78% Confidence</div>
          <div className="text-sm text-[var(--color-text-secondary)]">RSI oversold (42.3) + Bullish EMA9/EMA21 crossover detected on MNTUSDT 1H</div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-[var(--color-text-muted)]">RSI</div>
            <div className="font-bold text-[var(--color-green)]">42.3</div>
          </div>
          <div>
            <div className="text-xs text-[var(--color-text-muted)]">EMA9</div>
            <div className="font-bold text-white">$0.409</div>
          </div>
          <div>
            <div className="text-xs text-[var(--color-text-muted)]">EMA21</div>
            <div className="font-bold text-purple-400">$0.399</div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="xl:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-white">MNT/USDT</h2>
              <div className="text-2xl font-black text-[var(--color-green)]">$0.416 <span className="text-sm text-[var(--color-green)] font-medium">+5.08%</span></div>
            </div>
            <div className="flex gap-2">
              {["15m", "1H", "4H", "1D"].map((t) => (
                <button key={t} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${t === "1H" ? "bg-[var(--color-green)] text-[var(--color-bg)]" : "text-[var(--color-text-muted)] hover:bg-white/5"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={PRICE_DATA.slice(-24)} margin={{ top: 4, right: 4, bottom: 4, left: -15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="time" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} interval={3} />
              <YAxis domain={["auto", "auto"]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v.toFixed(3)}`} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="close" fill="#00d4aa" opacity={0.5} radius={[2, 2, 0, 0]} />
              <Line type="monotone" dataKey="ema9" stroke="#00d4aa" strokeWidth={2} dot={false} name="EMA9" />
              <Line type="monotone" dataKey="ema21" stroke="#7c3aed" strokeWidth={2} dot={false} strokeDasharray="4 2" name="EMA21" />
            </ComposedChart>
          </ResponsiveContainer>

          {/* RSI Chart */}
          <div className="mt-3">
            <div className="text-xs text-[var(--color-text-muted)] mb-1">RSI (14)</div>
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={RSI_DATA.slice(-24)} margin={{ top: 0, right: 4, bottom: 0, left: -15 }}>
                <defs>
                  <linearGradient id="rsiGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 8 }} axisLine={false} tickLine={false} interval={3} />
                <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 8 }} axisLine={false} tickLine={false} ticks={[30, 50, 70]} />
                <Line type="monotone" dataKey="rsi" stroke="#7c3aed" strokeWidth={1.5} dot={false} />
                <Area type="monotone" dataKey="rsi" fill="url(#rsiGrad)" stroke="none" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-1">
              <span className="text-red-400">Overbought &gt;70</span>
              <span>Neutral 50</span>
              <span className="text-[var(--color-green)]">Oversold &lt;30</span>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Risk Manager */}
          <div className="card p-4">
            <h3 className="font-bold text-white flex items-center gap-2 mb-3 text-sm">
              <AlertTriangle className="w-4 h-4 text-[var(--color-green)]" />
              Risk Manager
            </h3>
            <div className="space-y-2 text-xs">
              {[
                { label: "Max Position Size", value: "10% of balance", ok: true },
                { label: "Daily Loss Limit", value: "5% threshold", ok: true },
                { label: "Min Confidence", value: "65% required", ok: true },
                { label: "Current Daily PnL", value: "+$0.068", ok: true },
                { label: "Trading Status", value: "ACTIVE", ok: true },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center py-1.5 px-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <span className="text-[var(--color-text-secondary)]">{item.label}</span>
                  <span className={`font-semibold font-mono ${item.ok ? "text-[var(--color-green)]" : "text-red-400"}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Positions */}
          <div className="card p-4">
            <h3 className="font-bold text-white flex items-center gap-2 mb-3 text-sm">
              <Target className="w-4 h-4 text-[var(--color-green)]" />
              Open Positions
            </h3>
            <div className="space-y-2">
              {POSITIONS.map((pos) => (
                <div key={pos.id} className="p-2.5 rounded-xl" style={{ background: "rgba(0,212,170,0.04)", border: "1px solid rgba(0,212,170,0.1)" }}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-semibold text-white">{pos.symbol}</span>
                    <span className="text-xs font-bold" style={{ color: pos.positive ? "var(--color-green)" : "#ef4444" }}>
                      {pos.pnlPct}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)]">
                    <span>{pos.side} · {pos.size}</span>
                    <span className="font-mono">{pos.pnl}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
