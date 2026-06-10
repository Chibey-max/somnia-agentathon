import { TradeDecision } from "./quant-strategy";

export interface PositionSizeCheck {
  allowed: boolean;
  maxAllowed: number;
  reason?: string;
}

export interface DailyLossCheck {
  trading: boolean;
  reason: string;
  todayPnl: number;
  threshold: number;
}

// ─── Risk Parameters ─────────────────────────────────────────────────────────

const MAX_POSITION_PCT = 0.10; // 10% of balance per trade
const DAILY_LOSS_LIMIT_PCT = 0.05; // Stop if 5% daily loss
const MIN_CONFIDENCE = 65; // Minimum confidence to execute a trade
const MIN_BALANCE_MNT = 0.1; // Minimum MNT balance to trade

/**
 * Check if a position size is within risk parameters
 */
export function checkPositionSize(
  amount: number,
  balance: number
): PositionSizeCheck {
  if (balance <= 0) {
    return { allowed: false, maxAllowed: 0, reason: "Zero balance" };
  }

  const maxAllowed = balance * MAX_POSITION_PCT;

  if (amount > maxAllowed) {
    return {
      allowed: false,
      maxAllowed,
      reason: `Amount ${amount.toFixed(4)} exceeds 10% position limit (max: ${maxAllowed.toFixed(4)})`,
    };
  }

  if (balance < MIN_BALANCE_MNT) {
    return {
      allowed: false,
      maxAllowed,
      reason: `Balance ${balance.toFixed(4)} MNT below minimum threshold ${MIN_BALANCE_MNT}`,
    };
  }

  return { allowed: true, maxAllowed };
}

/**
 * Check if daily loss limit has been hit
 */
export function checkDailyLoss(
  todayPnl: number,
  balance: number
): DailyLossCheck {
  const threshold = balance * DAILY_LOSS_LIMIT_PCT;

  if (todayPnl < -threshold) {
    return {
      trading: false,
      reason: `Daily loss limit hit: ${todayPnl.toFixed(4)} MNT (threshold: -${threshold.toFixed(4)} MNT)`,
      todayPnl,
      threshold,
    };
  }

  return {
    trading: true,
    reason: `Daily PnL ${todayPnl >= 0 ? "+" : ""}${todayPnl.toFixed(4)} MNT within limits`,
    todayPnl,
    threshold,
  };
}

/**
 * Get recommended position size using simplified Kelly Criterion
 * Kelly% = (p*b - q) / b
 * where p = win probability, b = avg win/loss ratio, q = 1 - p
 */
export function getRecommendedSize(
  signal: TradeDecision,
  balance: number
): number {
  if (signal.signal === "HOLD") return 0;
  if (balance <= 0) return 0;

  // Convert confidence (0-100) to probability estimate
  const winProbability = signal.confidence / 100;
  const lossProbability = 1 - winProbability;

  // Assume 1.5:1 reward:risk ratio
  const rewardRiskRatio = 1.5;

  // Kelly formula
  const kellyFraction =
    (winProbability * rewardRiskRatio - lossProbability) / rewardRiskRatio;

  // Apply half-Kelly for safety
  const halfKelly = Math.max(0, kellyFraction / 2);

  // Cap at MAX_POSITION_PCT
  const cappedFraction = Math.min(halfKelly, MAX_POSITION_PCT);

  // Only trade if confidence meets minimum threshold
  if (signal.confidence < MIN_CONFIDENCE) {
    return 0;
  }

  return balance * cappedFraction;
}

/**
 * Full risk assessment for a potential trade
 */
export function assessRisk(
  signal: TradeDecision,
  balance: number,
  todayPnl: number
): {
  approved: boolean;
  recommendedSize: number;
  checks: {
    confidence: boolean;
    dailyLoss: DailyLossCheck;
    positionSize: PositionSizeCheck;
  };
  summary: string;
} {
  const confidenceOk = signal.confidence >= MIN_CONFIDENCE;
  const dailyLossCheck = checkDailyLoss(todayPnl, balance);
  const recommendedSize = getRecommendedSize(signal, balance);
  const positionCheck = checkPositionSize(recommendedSize, balance);

  const approved =
    confidenceOk &&
    dailyLossCheck.trading &&
    positionCheck.allowed &&
    signal.signal !== "HOLD";

  const summaryParts = [
    `Signal: ${signal.signal} (${signal.confidence}% confidence)`,
    `Recommended size: ${recommendedSize.toFixed(4)} MNT`,
    dailyLossCheck.reason,
  ];

  if (!confidenceOk) summaryParts.push(`Confidence ${signal.confidence}% below minimum ${MIN_CONFIDENCE}%`);

  return {
    approved,
    recommendedSize,
    checks: {
      confidence: confidenceOk,
      dailyLoss: dailyLossCheck,
      positionSize: positionCheck,
    },
    summary: summaryParts.join(" | "),
  };
}
