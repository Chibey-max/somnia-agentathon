"use client";

import { motion } from "framer-motion";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Activity, RefreshCw } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

interface Kline {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Ticker {
  symbol: string;
  lastPrice: string;
  priceChange24h: string;
  volume24h: string;
  highPrice24h: string;
  lowPrice24h: string;
}

interface ChartPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema9: number;
  ema21: number;
}

function calcEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  data.forEach((v, i) => {
    if (i === 0) {
      ema.push(v);
    } else {
      ema.push(v * k + ema[i - 1] * (1 - k));
    }
  });
  return ema;
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(1));
}

const SYMBOLS = ["MNTUSDT", "ETHUSDT", "BTCUSDT"];

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className="p-2 rounded-lg text-xs"
      style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}
    >
      <div className="font-semibold text-white mb-1">{label}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[var(--color-text-secondary)]">
        <span>O: <span className="text-white">{d.open.toFixed(4)}</span></span>
        <span>H: <span className="text-[var(--color-green)]">{d.high.toFixed(4)}</span></span>
        <span>C: <span className="text-white">{d.close.toFixed(4)}</span></span>
        <span>L: <span className="text-red-400">{d.low.toFixed(4)}</span></span>
      </div>
    </div>
  );
};

export function TradingPanel() {
  const [symbol, setSymbol] = useState("MNTUSDT");
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trading?symbol=${symbol}&interval=15`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const klines: Kline[] = data.klines || [];
      const closes = klines.map((k) => k.close);
      const ema9s = calcEMA(closes, 9);
      const ema21s = calcEMA(closes, 21);

      const points: ChartPoint[] = klines.map((k, i) => {
        const d = new Date(k.timestamp);
        const h = d.getHours().toString().padStart(2, "0");
        const m = d.getMinutes().toString().padStart(2, "0");
        return {
          time: `${h}:${m}`,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
          volume: k.volume,
          ema9: parseFloat(ema9s[i].toFixed(5)),
          ema21: parseFloat(ema21s[i].toFixed(5)),
        };
      });

      setChartData(points.slice(-24));
      setTicker(data.ticker || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const closes = chartData.map((d) => d.close);
  const rsi = calcRSI(closes);
  const lastEma9 = chartData.length > 1 ? chartData[chartData.length - 1].ema9 : 0;
  const lastEma21 = chartData.length > 1 ? chartData[chartData.length - 1].ema21 : 0;
  const emaBull = lastEma9 > lastEma21;
  const lastClose = closes.length > 0 ? closes[closes.length - 1] : 0;
  const prevClose = closes.length > 1 ? closes[closes.length - 2] : lastClose;
  const signalType = rsi < 35 && emaBull ? "BUY" : rsi > 65 && !emaBull ? "SELL" : "HOLD";
  const signalColor = signalType === "BUY" ? "#00d4aa" : signalType === "SELL" ? "#ef4444" : "#f59e0b";
  const SignalIcon = signalType === "BUY" ? TrendingUp : signalType === "SELL" ? TrendingDown : Minus;
  const priceChange = lastClose && prevClose ? (((lastClose - prevClose) / prevClose) * 100).toFixed(2) : "0";

  const currentPrice = ticker?.lastPrice
    ? parseFloat(ticker.lastPrice).toFixed(symbol === "BTCUSDT" ? 1 : symbol === "ETHUSDT" ? 2 : 5)
    : lastClose.toFixed(5);

  const change24h = ticker?.priceChange24h ? parseFloat(ticker.priceChange24h).toFixed(2) : priceChange;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-[var(--color-green)]" />
          AI Trading
        </h2>
        <div className="flex items-center gap-2">
          {/* Symbol selector */}
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="text-xs rounded-lg px-2 py-1 font-mono outline-none"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "var(--color-text-secondary)",
            }}
          >
            {SYMBOLS.map((s) => (
              <option key={s} value={s} style={{ background: "#0a0a0f" }}>
                {s.replace("USDT", "/USDT")}
              </option>
            ))}
          </select>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-1 rounded transition-colors hover:bg-white/5"
            style={{ color: "var(--color-text-muted)" }}
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <span
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
            style={{ background: `${signalColor}15`, color: signalColor, border: `1px solid ${signalColor}30` }}
          >
            <SignalIcon className="w-3 h-3" />
            {signalType}
          </span>
        </div>
      </div>

      {/* Price ticker */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-black text-white">${currentPrice}</span>
        <span
          className="text-xs font-semibold"
          style={{ color: parseFloat(change24h) >= 0 ? "var(--color-green)" : "#ef4444" }}
        >
          {parseFloat(change24h) >= 0 ? "+" : ""}{change24h}% 24h
        </span>
        {isLoading && <span className="text-xs text-[var(--color-text-muted)]">updating...</span>}
      </div>

      {error && (
        <div className="mb-3 text-xs text-red-400 px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error} — showing cached data
        </div>
      )}

      {/* Price Chart */}
      <div className="mb-4 rounded-xl overflow-hidden" style={{ background: "rgba(0,0,0,0.2)" }}>
        {isLoading && chartData.length === 0 ? (
          <div className="h-40 flex items-center justify-center">
            <div className="loading-shimmer rounded w-full h-full" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
              <XAxis
                dataKey="time"
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                interval={Math.floor(chartData.length / 6)}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v.toFixed(symbol === "BTCUSDT" ? 0 : symbol === "ETHUSDT" ? 1 : 4)}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="close" fill="#00d4aa" opacity={0.7} radius={[2, 2, 0, 0]} />
              <Line type="monotone" dataKey="ema9" stroke="#00d4aa" strokeWidth={1.5} dot={false} />
              <Line
                type="monotone"
                dataKey="ema21"
                stroke="#7c3aed"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="3 2"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Indicators Row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="p-2 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className="text-[10px] text-[var(--color-text-muted)] mb-1">RSI(14)</div>
          <div
            className="text-lg font-black"
            style={{ color: rsi < 30 ? "#00d4aa" : rsi > 70 ? "#ef4444" : "#f59e0b" }}
          >
            {rsi}
          </div>
          <div className="text-[9px] text-[var(--color-text-muted)]">
            {rsi < 30 ? "OVERSOLD" : rsi > 70 ? "OVERBOUGHT" : "NEUTRAL"}
          </div>
        </div>
        <div className="p-2 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className="text-[10px] text-[var(--color-text-muted)] mb-1">EMA Cross</div>
          <div className="text-sm font-bold" style={{ color: emaBull ? "#00d4aa" : "#ef4444" }}>
            {emaBull ? "BULL" : "BEAR"}
          </div>
          <div className="text-[9px] text-[var(--color-text-muted)]">
            {emaBull ? "9 > 21" : "9 < 21"}
          </div>
        </div>
        <div className="p-2 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className="text-[10px] text-[var(--color-text-muted)] mb-1">24h Vol</div>
          <div className="text-sm font-bold text-white">
            {ticker?.volume24h
              ? parseFloat(ticker.volume24h).toLocaleString(undefined, { maximumFractionDigits: 0 })
              : "—"}
          </div>
          <div className="text-[9px] text-[var(--color-text-muted)]">USDT</div>
        </div>
      </div>

      {/* Recent Candles */}
      <div>
        <div className="text-xs text-[var(--color-text-muted)] mb-2 font-medium">Recent Candles (15m)</div>
        <div className="space-y-1.5">
          {chartData.slice(-5).reverse().map((candle, i) => {
            const bullish = candle.close >= candle.open;
            const chg = candle.open > 0 ? (((candle.close - candle.open) / candle.open) * 100).toFixed(2) : "0";
            return (
              <div
                key={i}
                className="flex items-center gap-2 text-xs py-1 px-2 rounded-lg"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <span className="text-[var(--color-text-muted)] font-mono w-10">{candle.time}</span>
                <span
                  className="w-8 font-bold"
                  style={{ color: bullish ? "#00d4aa" : "#ef4444" }}
                >
                  {bullish ? "▲" : "▼"}
                </span>
                <span className="text-[var(--color-text-secondary)] flex-1">
                  O:{candle.open.toFixed(4)} H:{candle.high.toFixed(4)}
                </span>
                <span className="text-white font-mono">${candle.close.toFixed(4)}</span>
                <span className={`font-mono font-bold ${bullish ? "text-[var(--color-green)]" : "text-red-400"}`}>
                  {bullish ? "+" : ""}{chg}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
