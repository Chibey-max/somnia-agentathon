export interface ExecuteTradeInput {
  symbol: string;
  action?: string;
  amount?: string;
}

export interface ExecuteTradeOutput {
  success: boolean;
  signal?: string;
  confidence?: number;
  reason?: string;
  executionResult?: {
    executed: boolean;
    positionId?: string;
    txHash?: string;
    reason: string;
    size: number;
  };
  error?: string;
}

export const skill = {
  name: "execute-trade",
  description: "Run AI quant analysis on a symbol and execute on-chain via TradingVault",
  parameters: {
    symbol: { type: "string", required: true, description: "Trading pair symbol (e.g. MNTUSDT)" },
    action: { type: "string", required: false, description: "Override action: BUY or SELL" },
    amount: { type: "string", required: false, description: "MNT amount (auto-sized if omitted)" },
  },
  async execute(input: ExecuteTradeInput): Promise<ExecuteTradeOutput> {
    try {
      const { runTradingCycle } = await import("../../agent/src/trading/macro-contract");
      const { MANTLE_TOKENS } = await import("../../agent/src/tools");

      const { decision, execution } = await runTradingCycle(
        input.symbol,
        MANTLE_TOKENS.METH
      );

      return {
        success: execution.executed,
        signal: decision.signal,
        confidence: decision.confidence,
        reason: decision.reason,
        executionResult: execution,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
