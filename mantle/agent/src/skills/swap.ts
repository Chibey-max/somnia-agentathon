import { parseAbi, encodeFunctionData, parseEther } from "viem";
import { publicClient, walletClient } from "../account";
import { config } from "../env";
import { MANTLE_TOKENS } from "../tools";

// Merchant Moe Router interface (Joe V2.1 compatible on Mantle)
const MERCHANT_MOE_ROUTER = "0xeaEE7EE68874218c3558b40063c42B82D3E7232a";

const ROUTER_ABI = parseAbi([
  "function swapExactNATIVEForTokens(uint256 amountOutMin, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address to, uint256 deadline) external payable returns (uint256[] memory amountsOut)",
  "function swapExactTokensForNATIVE(uint256 amountIn, uint256 amountOutMinNATIVE, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address payable to, uint256 deadline) external returns (uint256[] memory amountsOut)",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address to, uint256 deadline) external returns (uint256[] memory amountsOut)",
]);

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
]);

export interface SwapParams {
  tokenIn: "MNT" | "METH" | "USDY" | `0x${string}`;
  tokenOut: "MNT" | "METH" | "USDY" | `0x${string}`;
  amountIn: string;
  slippageBps?: number; // default 50 = 0.5%
}

export interface SwapResult {
  success: boolean;
  txHash?: `0x${string}`;
  amountIn: string;
  estimatedOut?: string;
  error?: string;
}

function resolveTokenAddress(token: string): `0x${string}` {
  if (token === "METH") return MANTLE_TOKENS.METH;
  if (token === "USDY") return MANTLE_TOKENS.USDY;
  if (token === "MNT") return "0x0000000000000000000000000000000000000000";
  return token as `0x${string}`;
}

/**
 * Execute a swap on Merchant Moe DEX on Mantle
 */
export async function swapOnMerchantMoe(params: SwapParams): Promise<SwapResult> {
  const { tokenIn, tokenOut, amountIn, slippageBps = 50 } = params;

  const tokenInAddr = resolveTokenAddress(tokenIn);
  const tokenOutAddr = resolveTokenAddress(tokenOut);
  const amountInWei = parseEther(amountIn);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 min

  // Simplified path — direct pair
  const path = {
    pairBinSteps: [15n], // 15 basis points bin step for volatile pairs
    versions: [2], // Joe V2.1
    tokenPath: [tokenInAddr, tokenOutAddr],
  };

  try {
    // Native MNT -> Token
    if (tokenIn === "MNT") {
      const amountOutMin = (amountInWei * BigInt(10000 - slippageBps)) / 10000n;

      const txHash = await walletClient.writeContract({
        address: MERCHANT_MOE_ROUTER,
        abi: ROUTER_ABI,
        functionName: "swapExactNATIVEForTokens",
        args: [amountOutMin, path, config.AGENT_CONTRACT_ADDRESS, deadline],
        value: amountInWei,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      return {
        success: receipt.status === "success",
        txHash,
        amountIn,
        error: receipt.status !== "success" ? "Swap reverted" : undefined,
      };
    }

    // Approve if needed
    const allowance = await publicClient.readContract({
      address: tokenInAddr,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [config.AGENT_CONTRACT_ADDRESS, MERCHANT_MOE_ROUTER],
    });

    if (allowance < amountInWei) {
      const approveTx = await walletClient.writeContract({
        address: tokenInAddr,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [MERCHANT_MOE_ROUTER, amountInWei * 10n], // Approve 10x for efficiency
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
    }

    // Token -> Native MNT
    if (tokenOut === "MNT") {
      const amountOutMin = (amountInWei * BigInt(10000 - slippageBps)) / 10000n;
      const txHash = await walletClient.writeContract({
        address: MERCHANT_MOE_ROUTER,
        abi: ROUTER_ABI,
        functionName: "swapExactTokensForNATIVE",
        args: [amountInWei, amountOutMin, path, config.AGENT_CONTRACT_ADDRESS, deadline],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      return { success: receipt.status === "success", txHash, amountIn };
    }

    // Token -> Token
    const amountOutMin = (amountInWei * BigInt(10000 - slippageBps)) / 10000n;
    const txHash = await walletClient.writeContract({
      address: MERCHANT_MOE_ROUTER,
      abi: ROUTER_ABI,
      functionName: "swapExactTokensForTokens",
      args: [amountInWei, amountOutMin, path, config.AGENT_CONTRACT_ADDRESS, deadline],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    return { success: receipt.status === "success", txHash, amountIn };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, amountIn, error: message };
  }
}
