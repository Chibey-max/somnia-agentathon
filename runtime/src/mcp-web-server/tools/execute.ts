import { parseEther, type Hex } from "viem"
import type { Address, MpcProgressEvent } from "../types"
import { runPreflight } from "../guard/preflight"
import { AGENT_WALLET_ABI, AGENT_WALLET_ADDRESS, walletReadClient, walletWriteClient } from "./shared"

type ProgressEmitter = (event: MpcProgressEvent) => void

export async function execute(target: Address, value: bigint, data: Hex, emit: ProgressEmitter) {
  try {
    emit({ type: "progress", step: "preflight_check", status: "running" })
    const preflight = await runPreflight({ target, value, calldata: data })
    if (!preflight.allowed) {
      emit({ type: "progress", step: "preflight_check", status: "failed", message: preflight.reason })
      return {
        success: false,
        preflight,
        error: preflight.reason ?? "Preflight rejected"
      }
    }
    emit({ type: "progress", step: "preflight_check", status: "passed" })

    emit({ type: "progress", step: "signing_tx", status: "running" })
    const txHash = await walletWriteClient.writeContract({
      address: AGENT_WALLET_ADDRESS,
      abi: AGENT_WALLET_ABI,
      functionName: "execute",
      args: [target, value, data]
    })

    emit({ type: "progress", step: "broadcasting", status: "running", txHash })
    const receipt = await walletReadClient.waitForTransactionReceipt({ hash: txHash })

    const logs = await walletReadClient.getContractEvents({
      address: AGENT_WALLET_ADDRESS,
      abi: AGENT_WALLET_ABI,
      eventName: "Executed",
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber
    })
    const executedEvent = logs.find((log) => log.transactionHash?.toLowerCase() === txHash.toLowerCase())

    emit({ type: "progress", step: "confirmed", status: "done", txHash })
    return {
      success: receipt.status === "success",
      txHash,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
      executedEvent: executedEvent
        ? {
            target: executedEvent.args.target,
            value: (executedEvent.args.value ?? 0n).toString(),
            selector: executedEvent.args.selector,
            blockNumber: (executedEvent.blockNumber ?? 0n).toString(),
            transactionHash: executedEvent.transactionHash
          }
        : null
    }
  } catch (error) {
    emit({ type: "progress", step: "execute", status: "failed", message: error instanceof Error ? error.message : String(error) })
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function transferEth(to: Address, amountEth: string, emit: ProgressEmitter) {
  const value = parseEther(amountEth)
  return execute(to, value, "0x", emit)
}
