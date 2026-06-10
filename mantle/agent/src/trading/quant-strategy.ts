import { Kline } from "./bybit-client";

export type Signal = "BUY" | "SELL" | "HOLD";

export interface TradeDecision {
  signal: Signal;
  confidence: number; // 0-100
  reason: string;
  rsi: number;
  ema9: number;
  ema21: number;
  emaCrossover: "bullish" | "bearish" | "none";
  currentPrice: number;
}

export interface MarketData {
  symbol: string;
  klines: Kline[];
  currentPrice: number;
}

export interface WalletState {
  mntBalance: number;
  totalValueUsd: number;
}

// ─── Technical Indicators ─────────────────────────────────────────────────────

/**
 * Calculate RSI(14)
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50; // Neutral if not enough data

  let gains = 0;
  let losses = 0;

  // Initial average
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Smoothed RSI using Wilder's method
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Calculate EMA (Exponential Moving Average)
 */
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;

  const multiplier = 2 / (period + 1);

  // Start with SMA for the initial period
  let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period;

  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }

  return ema;
}

/**
 * Analyze market signals using RSI + EMA crossover strategy
 */
export function analyzeSignals(
  symbol: string,
  klines: Kline[]
): { rsi: number; ema9: number; ema21: number; signal: Signal; reason: string } {
  const closes = klines.map((k) => k.closePrice);

  if (closes.length < 21) {
    return {
      rsi: 50,
      ema9: closes[closes.length - 1] || 0,
      ema21: closes[closes.length - 1] || 0,
      signal: "HOLD",
      reason: "Insufficient data for analysis",
    };
  }

  const rsi = calculateRSI(closes);
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);

  // Check EMA crossover using last two periods
  const prevCloses = closes.slice(0, -1);
  const prevEma9 = calculateEMA(prevCloses, 9);
  const prevEma21 = calculateEMA(prevCloses, 21);

  const wasBullish = prevEma9 > prevEma21;
  const isBullish = ema9 > ema21;
  const crossedUp = !wasBullish && isBullish;
  const crossedDown = wasBullish && !isBullish;

  const reasons: string[] = [];
  let bullishScore = 0;
  let bearishScore = 0;

  // RSI analysis
  if (rsi < 30) {
    bullishScore += 40;
    reasons.push(`RSI oversold (${rsi.toFixed(1)})`);
  } else if (rsi > 70) {
    bearishScore += 40;
    reasons.push(`RSI overbought (${rsi.toFixed(1)})`);
  } else {
    reasons.push(`RSI neutral (${rsi.toFixed(1)})`);
  }

  // EMA crossover
  if (crossedUp) {
    bullishScore += 50;
    reasons.push("Bullish EMA9/EMA21 crossover");
  } else if (crossedDown) {
    bearishScore += 50;
    reasons.push("Bearish EMA9/EMA21 crossover");
  } else if (ema9 > ema21) {
    bullishScore += 20;
    reasons.push("EMA9 above EMA21 (uptrend)");
  } else {
    bearishScore += 20;
    reasons.push("EMA9 below EMA21 (downtrend)");
  }

  let signal: Signal = "HOLD";
  if (bullishScore >= 50 && bullishScore > bearishScore) signal = "BUY";
  else if (bearishScore >= 50 && bearishScore > bullishScore) signal = "SELL";

  return {
    rsi,
    ema9,
    ema21,
    signal,
    reason: reasons.join(" | "),
  };
}

/**
 * Generate a full trade decision combining technical analysis with wallet state
 */
export function generateTradeDecision(
  marketData: MarketData,
  walletState: WalletState
): TradeDecision {
  const analysis = analyzeSignals(marketData.symbol, marketData.klines);

  const prevCloses = marketData.klines.slice(0, -1).map((k) => k.closePrice);
  const prevEma9 = calculateEMA(prevCloses, 9);
  const prevEma21 = calculateEMA(prevCloses, 21);

  let emaCrossover: "bullish" | "bearish" | "none" = "none";
  if (!( prevEma9 > prevEma21) && analysis.ema9 > analysis.ema21) emaCrossover = "bullish";
  else if ((prevEma9 > prevEma21) && !(analysis.ema9 > analysis.ema21)) emaCrossover = "bearish";

  // Confidence scoring
  let confidence = 50;
  if (analysis.signal === "BUY") {
    confidence = analysis.rsi < 30 ? 80 : emaCrossover === "bullish" ? 75 : 60;
  } else if (analysis.signal === "SELL") {
    confidence = analysis.rsi > 70 ? 80 : emaCrossover === "bearish" ? 75 : 60;
  }

  // Reduce confidence if wallet balance is low
  if (walletState.mntBalance < 1) {
    confidence = Math.min(confidence, 40);
  }

  return {
    signal: analysis.signal,
    confidence,
    reason: analysis.reason,
    rsi: analysis.rsi,
    ema9: analysis.ema9,
    ema21: analysis.ema21,
    emaCrossover,
    currentPrice: marketData.currentPrice,
  };
}
