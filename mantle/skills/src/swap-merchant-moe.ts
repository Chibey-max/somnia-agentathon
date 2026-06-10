export interface SwapMerchantMoeInput {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippageBps?: number;
}

export interface SwapMerchantMoeOutput {
  success: boolean;
  txHash?: string;
  amountIn: string;
  tokenIn: string;
  tokenOut: string;
  error?: string;
}

export const skill = {
  name: "swap-merchant-moe",
  description: "Swap tokens on Merchant Moe DEX (Joe V2.1 liquidity bins) on Mantle",
  parameters: {
    tokenIn: { type: "string", required: true, description: "Input token" },
    tokenOut: { type: "string", required: true, description: "Output token" },
    amountIn: { type: "string", required: true, description: "Input amount" },
    slippageBps: { type: "number", required: false, description: "Slippage bps (default: 50)" },
  },
  async execute(input: SwapMerchantMoeInput): Promise<SwapMerchantMoeOutput> {
    const { swapOnMerchantMoe } = await import("../../agent/src/skills/swap");
    const result = await swapOnMerchantMoe({
      tokenIn: input.tokenIn as "MNT" | "METH" | "USDY",
      tokenOut: input.tokenOut as "MNT" | "METH" | "USDY",
      amountIn: input.amountIn,
      slippageBps: input.slippageBps,
    });
    return {
      success: result.success,
      txHash: result.txHash,
      amountIn: result.amountIn,
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut,
      error: result.error,
    };
  },
};
