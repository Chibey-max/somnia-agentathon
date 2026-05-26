import { publicClient } from "./account"

export async function simulateBeforeSend(to: string, value: bigint, data?: `0x${string}`) {
  try {
    await publicClient.call({ to: to as `0x${string}`, value, data: data || "0x" })
    return { safe: true }
  } catch (err: any) {
    return { safe: false, reason: err.shortMessage || err.message }
  }
}