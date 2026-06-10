import { parseEther, parseUnits, isAddress, formatEther } from "viem";
import { publicClient, walletClient } from "../account";
import { config } from "../env";
import { MANTLE_TOKENS } from "../tools";
import { parseAbi } from "viem";

const WALLET_ABI = parseAbi([
  "function transferMNT(address payable to, uint256 amount) external",
  "function transferToken(address token, address to, uint256 amount) external",
  "function whitelist(address) external view returns (bool)",
  "function getDailyRemaining(address token) external view returns (uint256)",
]);

export interface TransferParams {
  token: "MNT" | "METH" | "USDY";
  to: string;
  amount: string;
}

export interface TransferResult {
  success: boolean;
  txHash?: `0x${string}`;
  error?: string;
  amount: string;
  token: string;
  to: string;
}

/**
 * Transfer MNT, mETH, or USDY from the agent wallet
 * Validates whitelist and spending limits before executing
 */
export async function executeTransfer(params: TransferParams): Promise<TransferResult> {
  const { token, to, amount } = params;

  if (!isAddress(to)) {
    return { success: false, error: "Invalid recipient address", amount, token, to };
  }

  // Check whitelist
  const isWhitelisted = await publicClient.readContract({
    address: config.AGENT_CONTRACT_ADDRESS,
    abi: WALLET_ABI,
    functionName: "whitelist",
    args: [to as `0x${string}`],
  });

  if (!isWhitelisted) {
    return {
      success: false,
      error: `Address ${to} is not whitelisted. Contact guardian to whitelist.`,
      amount,
      token,
      to,
    };
  }

  // Check daily remaining
  const tokenAddr =
    token === "MNT"
      ? ("0x0000000000000000000000000000000000000000" as `0x${string}`)
      : token === "METH"
      ? MANTLE_TOKENS.METH
      : MANTLE_TOKENS.USDY;

  const remaining = await publicClient.readContract({
    address: config.AGENT_CONTRACT_ADDRESS,
    abi: WALLET_ABI,
    functionName: "getDailyRemaining",
    args: [tokenAddr],
  });

  const amountWei = parseEther(amount);
  if (amountWei > remaining) {
    return {
      success: false,
      error: `Daily limit exceeded. Remaining: ${formatEther(remaining)} ${token}`,
      amount,
      token,
      to,
    };
  }

  // Execute transfer
  let txHash: `0x${string}`;

  if (token === "MNT") {
    txHash = await walletClient.writeContract({
      address: config.AGENT_CONTRACT_ADDRESS,
      abi: WALLET_ABI,
      functionName: "transferMNT",
      args: [to as `0x${string}`, amountWei],
    });
  } else {
    const decimals = token === "USDY" ? 18 : 18;
    const amountUnits = parseUnits(amount, decimals);
    txHash = await walletClient.writeContract({
      address: config.AGENT_CONTRACT_ADDRESS,
      abi: WALLET_ABI,
      functionName: "transferToken",
      args: [tokenAddr, to as `0x${string}`, amountUnits],
    });
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    success: receipt.status === "success",
    txHash,
    amount,
    token,
    to,
    error: receipt.status !== "success" ? "Transaction reverted" : undefined,
  };
}
