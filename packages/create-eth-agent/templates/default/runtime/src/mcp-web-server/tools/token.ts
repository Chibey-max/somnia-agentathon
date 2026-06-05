import { type Address } from "../types"
import { AGENT_WALLET_ABI, AGENT_WALLET_ADDRESS, walletReadClient } from "./shared"

export async function getTokenPolicy(tokenAddress: Address): Promise<{ enabled: boolean; dailyLimit: bigint; dailySpent: bigint; remaining: bigint; lastReset: bigint }> {
  try {
    const policy = await walletReadClient.readContract({
      address: AGENT_WALLET_ADDRESS,
      abi: AGENT_WALLET_ABI,
      functionName: "tokenPolicy",
      args: [tokenAddress]
    })
    const dailyLimit = policy[0]
    const dailySpent = policy[1]
    return {
      enabled: policy[3],
      dailyLimit,
      dailySpent,
      remaining: dailyLimit > dailySpent ? dailyLimit - dailySpent : 0n,
      lastReset: policy[2]
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to read token policy: ${message}`)
  }
}
