import { readState } from "./read"

export async function checkLimits(value: bigint): Promise<{ ok: boolean; reason?: string; remainingDaily: bigint }> {
  try {
    const state = await readState()
    if (value > state.ethTxLimit) {
      return { ok: false, reason: "Exceeds ETH tx limit", remainingDaily: state.ethDailyLimit - state.ethDailySpent }
    }
    const remaining = state.ethDailyLimit - state.ethDailySpent
    if (value > remaining) {
      return { ok: false, reason: "ETH daily limit exceeded", remainingDaily: remaining }
    }
    return { ok: true, remainingDaily: remaining }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to check limits: ${message}`)
  }
}
