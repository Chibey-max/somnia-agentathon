// Agni Finance Router on Mantle (Uniswap V3 fork)
const AGNI_ROUTER = "0x319B69888b0d11cEC22caA5034e25FfFBDc88421";

export interface SwapAgniInput {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippageBps?: number;
}

export interface SwapAgniOutput {
  success: boolean;
  txHash?: string;
  amountIn: string;
  tokenIn: string;
  tokenOut: string;
  error?: string;
}

export const skill = {
  name: "swap-agni",
  description: "Swap tokens on Agni Finance (Uniswap V3 fork) on Mantle",
  parameters: {
    tokenIn: { type: "string", required: true, description: "Input token (MNT/METH/USDY)" },
    tokenOut: { type: "string", required: true, description: "Output token (MNT/METH/USDY)" },
    amountIn: { type: "string", required: true, description: "Input amount" },
    slippageBps: { type: "number", required: false, description: "Slippage in bps (default: 50)" },
  },
  async execute(input: SwapAgniInput): Promise<SwapAgniOutput> {
    // Agni uses Uniswap V3 exactInputSingle interface
    // For hackathon: route through the standard V3 swap path
    const { publicClient, walletClient } = await import("../../agent/src/account");
    const { parseAbi, parseEther } = await import("viem");
    const { MANTLE_TOKENS } = await import("../../agent/src/tools");
    const { config } = await import("../../agent/src/env");

    const AGNI_ABI = parseAbi([
      "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)",
    ]);

    const resolveAddr = (sym: string) =>
      sym === "METH" ? MANTLE_TOKENS.METH : sym === "USDY" ? MANTLE_TOKENS.USDY : ("0x0000000000000000000000000000000000000000" as `0x${string}`);

    const amountWei = parseEther(input.amountIn);
    const slippage = input.slippageBps ?? 50;
    const amountOutMin = (amountWei * BigInt(10000 - slippage)) / 10000n;

    try {
      const txHash = await walletClient.writeContract({
        address: AGNI_ROUTER as `0x${string}`,
        abi: AGNI_ABI,
        functionName: "exactInputSingle",
        args: [{
          tokenIn: resolveAddr(input.tokenIn),
          tokenOut: resolveAddr(input.tokenOut),
          fee: 3000,
          recipient: config.AGENT_CONTRACT_ADDRESS,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 300),
          amountIn: amountWei,
          amountOutMinimum: amountOutMin,
          sqrtPriceLimitX96: 0n,
        }],
        value: input.tokenIn === "MNT" ? amountWei : 0n,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      return {
        success: receipt.status === "success",
        txHash,
        amountIn: input.amountIn,
        tokenIn: input.tokenIn,
        tokenOut: input.tokenOut,
      };
    } catch (err) {
      return {
        success: false,
        amountIn: input.amountIn,
        tokenIn: input.tokenIn,
        tokenOut: input.tokenOut,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
