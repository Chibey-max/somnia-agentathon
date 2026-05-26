import { formatEther } from "viem"
import { walletReadClient, AGENT_WALLET_ABI, AGENT_WALLET_ADDRESS } from "./shared"
import type { WalletState } from "../types"

export async function readState(): Promise<WalletState> {
  try {
    const [balanceWei, agent, guardian, paused, ethTxLimit, ethDailyLimit, ethDailySpent, pendingLimitChange, pendingCall] = await Promise.all([
      walletReadClient.getBalance({ address: AGENT_WALLET_ADDRESS }),
      walletReadClient.readContract({ address: AGENT_WALLET_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "agent" }),
      walletReadClient.readContract({ address: AGENT_WALLET_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "guardian" }),
      walletReadClient.readContract({ address: AGENT_WALLET_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "paused" }),
      walletReadClient.readContract({ address: AGENT_WALLET_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "ethTxLimit" }),
      walletReadClient.readContract({ address: AGENT_WALLET_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "ethDailyLimit" }),
      walletReadClient.readContract({ address: AGENT_WALLET_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "ethDailySpent" }),
      walletReadClient.readContract({ address: AGENT_WALLET_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "pendingLimitChange" }),
      walletReadClient.readContract({ address: AGENT_WALLET_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "pendingCall" })
    ])

    return {
      contractAddress: AGENT_WALLET_ADDRESS,
      chainId: 11155111,
      balanceWei,
      agent,
      guardian,
      paused,
      ethTxLimit,
      ethDailyLimit,
      ethDailySpent,
      pendingLimitChange: {
        txLimit: pendingLimitChange[0],
        dailyLimit: pendingLimitChange[1],
        unlockTime: pendingLimitChange[2],
        queued: pendingLimitChange[3]
      },
      pendingCall: {
        target: pendingCall[0],
        selector: pendingCall[1],
        checkRecipient: pendingCall[2],
        checkAmount: pendingCall[3],
        maxAmount: pendingCall[4],
        unlockTime: pendingCall[5],
        queued: pendingCall[6]
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to read wallet state: ${message}`)
  }
}

export function serializeWalletState(state: WalletState): Record<string, unknown> {
  return {
    ...state,
    balanceWei: state.balanceWei.toString(),
    balanceEth: formatEther(state.balanceWei),
    ethTxLimit: state.ethTxLimit.toString(),
    ethDailyLimit: state.ethDailyLimit.toString(),
    ethDailySpent: state.ethDailySpent.toString(),
    pendingLimitChange: {
      ...state.pendingLimitChange,
      txLimit: state.pendingLimitChange.txLimit.toString(),
      dailyLimit: state.pendingLimitChange.dailyLimit.toString(),
      unlockTime: state.pendingLimitChange.unlockTime.toString()
    },
    pendingCall: {
      ...state.pendingCall,
      maxAmount: state.pendingCall.maxAmount.toString(),
      unlockTime: state.pendingCall.unlockTime.toString()
    }
  }
}
