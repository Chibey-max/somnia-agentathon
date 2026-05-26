import { type Hex } from "viem"
import { AGENT_WALLET_ABI, AGENT_WALLET_ADDRESS, walletReadClient } from "./shared"
import type { SerializedExecutedEvent } from "../types"

export async function getHistory(limit = 20, fromBlock?: bigint): Promise<SerializedExecutedEvent[]> {
  try {
    const logs = await walletReadClient.getContractEvents({
      address: AGENT_WALLET_ADDRESS,
      abi: AGENT_WALLET_ABI,
      eventName: "Executed",
      fromBlock
    })

    const sliced = logs.slice(Math.max(logs.length - limit, 0)).reverse()
    return sliced.map((log) => ({
      target: (log.args.target ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      value: (log.args.value ?? 0n).toString(),
      selector: (log.args.selector ?? "0x00000000") as Hex,
      blockNumber: (log.blockNumber ?? 0n).toString(),
      transactionHash: (log.transactionHash ?? "0x") as Hex
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to get transaction history: ${message}`)
  }
}
