import { parseAbi, parseEther, formatEther } from "viem";
import { publicClient, walletClient } from "../account";
import { config } from "../env";
import { MANTLE_TOKENS } from "../tools";

// Mantle LSP Staking contract
const MANTLE_LSP_STAKING = "0xe3cBd06D7dadB3F4e6557bAb7EdD924CD1489E8f";

const LSP_ABI = parseAbi([
  "function stake() external payable",
  "function unstake(uint256 mETHAmount) external",
  "function mETHToETH(uint256 mETHAmount) external view returns (uint256)",
  "function ethToMETH(uint256 ethAmount) external view returns (uint256)",
  "function totalControlled() external view returns (uint256)",
  "function totalMETHSupply() external view returns (uint256)",
  "function exchangeAdjustmentRate() external view returns (uint256)",
]);

const ERC20_ABI = parseAbi([
  "function balanceOf(address) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
]);

export interface YieldStats {
  currentApy: string;
  totalStaked: string;
  mEthPrice: string;
  walletMEthBalance: string;
}

export interface StakeResult {
  success: boolean;
  txHash?: `0x${string}`;
  mEthReceived?: string;
  error?: string;
}

/**
 * Get current mETH yield stats from Mantle LSP
 */
export async function getYieldStats(): Promise<YieldStats> {
  try {
    const [totalControlled, totalMEth, walletMEth] = await Promise.all([
      publicClient.readContract({
        address: MANTLE_LSP_STAKING,
        abi: LSP_ABI,
        functionName: "totalControlled",
        args: [],
      }),
      publicClient.readContract({
        address: MANTLE_LSP_STAKING,
        abi: LSP_ABI,
        functionName: "totalMETHSupply",
        args: [],
      }),
      publicClient.readContract({
        address: MANTLE_TOKENS.METH,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [config.AGENT_CONTRACT_ADDRESS],
      }),
    ]);

    // Exchange rate: ETH per mETH
    const mEthPrice =
      totalMEth > 0n
        ? (Number(formatEther(totalControlled)) / Number(formatEther(totalMEth))).toFixed(6)
        : "1.000000";

    // APY approximation based on exchange rate drift (simplified)
    const aprRate = parseFloat(mEthPrice) > 1 ? ((parseFloat(mEthPrice) - 1) * 365 * 100) / 365 : 4.5;

    return {
      currentApy: `${aprRate.toFixed(2)}%`,
      totalStaked: `${Number(formatEther(totalControlled)).toFixed(4)} MNT`,
      mEthPrice,
      walletMEthBalance: formatEther(walletMEth),
    };
  } catch {
    return {
      currentApy: "~4.5%",
      totalStaked: "N/A",
      mEthPrice: "1.000000",
      walletMEthBalance: "0",
    };
  }
}

/**
 * Stake MNT to receive mETH via Mantle LSP
 */
export async function stakeMNTForMETH(amountMnt: string): Promise<StakeResult> {
  const amountWei = parseEther(amountMnt);

  try {
    // Estimate mETH to receive
    const mEthAmount = await publicClient.readContract({
      address: MANTLE_LSP_STAKING,
      abi: LSP_ABI,
      functionName: "ethToMETH",
      args: [amountWei],
    });

    const txHash = await walletClient.writeContract({
      address: MANTLE_LSP_STAKING,
      abi: LSP_ABI,
      functionName: "stake",
      args: [],
      value: amountWei,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    return {
      success: receipt.status === "success",
      txHash,
      mEthReceived: formatEther(mEthAmount),
      error: receipt.status !== "success" ? "Staking failed" : undefined,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Unstake mETH back to MNT
 */
export async function unstakeMETH(amountMEth: string): Promise<StakeResult> {
  const amountWei = parseEther(amountMEth);

  try {
    // Approve LSP to spend mETH
    const approveTx = await walletClient.writeContract({
      address: MANTLE_TOKENS.METH,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [MANTLE_LSP_STAKING, amountWei],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });

    const txHash = await walletClient.writeContract({
      address: MANTLE_LSP_STAKING,
      abi: LSP_ABI,
      functionName: "unstake",
      args: [amountWei],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    return {
      success: receipt.status === "success",
      txHash,
      error: receipt.status !== "success" ? "Unstaking failed" : undefined,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
