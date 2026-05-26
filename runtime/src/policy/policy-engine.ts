import { formatEther } from "viem"
import { publicClient } from "../account"
import { requireAddress } from "../env"
import type { PolicyDecision, PolicyViolation } from "./types"

const AGENT_WALLET_ADDRESS = requireAddress("AGENT_CONTRACT_ADDRESS")

const POLICY_READ_ABI = [
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "ethTxLimit", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "ethDailyLimit", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "ethDailySpent", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }
] as const

export async function evaluateEthTransferPolicy(amountWei: bigint): Promise<PolicyDecision> {
  const violations: PolicyViolation[] = []

  const [walletBalance, paused, ethTxLimit, ethDailyLimit, ethDailySpent] = await Promise.all([
    publicClient.getBalance({ address: AGENT_WALLET_ADDRESS }),
    publicClient.readContract({ address: AGENT_WALLET_ADDRESS, abi: POLICY_READ_ABI, functionName: "paused" }),
    publicClient.readContract({ address: AGENT_WALLET_ADDRESS, abi: POLICY_READ_ABI, functionName: "ethTxLimit" }),
    publicClient.readContract({ address: AGENT_WALLET_ADDRESS, abi: POLICY_READ_ABI, functionName: "ethDailyLimit" }),
    publicClient.readContract({ address: AGENT_WALLET_ADDRESS, abi: POLICY_READ_ABI, functionName: "ethDailySpent" })
  ])

  if (paused) {
    violations.push({
      code: "CONTRACT_PAUSED",
      message: "Agent wallet is paused. Guardian must unpause before transfers are allowed."
    })
  }

  if (walletBalance < amountWei) {
    violations.push({
      code: "INSUFFICIENT_BALANCE",
      message: `Insufficient ETH balance. Wallet has ${formatEther(walletBalance)} ETH.`,
      details: {
        requestedEth: formatEther(amountWei),
        walletBalanceEth: formatEther(walletBalance)
      }
    })
  }

  if (amountWei > ethTxLimit) {
    violations.push({
      code: "PER_TX_LIMIT_EXCEEDED",
      message: `Amount exceeds per-transaction limit (${formatEther(ethTxLimit)} ETH).`,
      details: {
        requestedEth: formatEther(amountWei),
        txLimitEth: formatEther(ethTxLimit)
      }
    })
  }

  const remainingDaily = ethDailyLimit > ethDailySpent ? ethDailyLimit - ethDailySpent : 0n
  if (amountWei > remainingDaily) {
    violations.push({
      code: "DAILY_LIMIT_EXCEEDED",
      message: `Amount exceeds remaining daily allowance (${formatEther(remainingDaily)} ETH).`,
      details: {
        requestedEth: formatEther(amountWei),
        remainingDailyEth: formatEther(remainingDaily),
        dailyLimitEth: formatEther(ethDailyLimit),
        dailySpentEth: formatEther(ethDailySpent)
      }
    })
  }

  return {
    allow: violations.length === 0,
    violations,
    context: {
      requestedEth: formatEther(amountWei),
      walletBalanceEth: formatEther(walletBalance),
      txLimitEth: formatEther(ethTxLimit),
      dailyLimitEth: formatEther(ethDailyLimit),
      dailySpentEth: formatEther(ethDailySpent),
      remainingDailyEth: formatEther(remainingDaily)
    }
  }
}
