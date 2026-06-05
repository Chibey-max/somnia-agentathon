import { isAddress, type Hex } from "viem"
import { AGENT_ACCOUNT, AGENT_WALLET_ABI, AGENT_WALLET_ADDRESS, walletReadClient } from "../tools/shared"
import { readState } from "../tools/read"
import { checkLimits } from "../tools/limits"
import { parseCalldataFields, SELECTORS } from "./policy"
import type { PreflightInput, PreflightResult } from "../types"

function selectorFromCalldata(calldata: Hex): Hex {
  if (calldata === "0x" || calldata.length < 10) return SELECTORS.ZERO_SELECTOR
  return `0x${calldata.slice(2, 10)}` as Hex
}

async function fail(reason: string, rule: string, remainingDaily: bigint, selector: Hex): Promise<PreflightResult> {
  console.warn(`[preflight:failed] ${new Date().toISOString()} reason=${reason} rule=${rule}`)
  return { allowed: false, reason, rule, remainingDaily, selector }
}

export async function runPreflight(input: PreflightInput): Promise<PreflightResult> {
  try {
    const { target, value, calldata } = input
    const selector = selectorFromCalldata(calldata)

    if (!isAddress(target)) {
      return fail("Invalid target address", "execute(target)", 0n, selector)
    }

    const state = await readState()
    const remainingDaily = state.ethDailyLimit > state.ethDailySpent ? state.ethDailyLimit - state.ethDailySpent : 0n

    if (state.paused) return fail("Contract is paused", "paused()", remainingDaily, selector)

    if (AGENT_ACCOUNT.address.toLowerCase() !== state.agent.toLowerCase()) {
      return fail("Signer is not the configured on-chain agent", "agent()", remainingDaily, selector)
    }

    const limitResult = await checkLimits(value)
    if (!limitResult.ok) {
      return fail(limitResult.reason ?? "ETH limit check failed", "ethTxLimit()/ethDailyLimit()", limitResult.remainingDaily, selector)
    }

    const fields = parseCalldataFields(selector, calldata)
    if (fields.recipient) {
      const allowedRecipient = await walletReadClient.readContract({
        address: AGENT_WALLET_ADDRESS,
        abi: AGENT_WALLET_ABI,
        functionName: "isRecipientAllowed",
        args: [target, selector as `0x${string}`, fields.recipient]
      })
      if (!allowedRecipient) {
        return fail("Recipient not allowed", "isRecipientAllowed()", limitResult.remainingDaily, selector)
      }
    }

    if (fields.amount && selector !== SELECTORS.ZERO_SELECTOR) {
      const tokenPolicy = await walletReadClient.readContract({
        address: AGENT_WALLET_ADDRESS,
        abi: AGENT_WALLET_ABI,
        functionName: "tokenPolicy",
        args: [target]
      })
      const enabled = tokenPolicy[3]
      if (enabled) {
        const dailyLimit = tokenPolicy[0]
        const dailySpent = tokenPolicy[1]
        if (dailySpent + fields.amount > dailyLimit) {
          return fail("Token daily limit exceeded", "tokenPolicy()", limitResult.remainingDaily, selector)
        }
      }
    }

    try {
      await walletReadClient.simulateContract({
        account: AGENT_ACCOUNT,
        address: AGENT_WALLET_ADDRESS,
        abi: AGENT_WALLET_ABI,
        functionName: "execute",
        args: [target, value, calldata]
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return fail(message, "execute() simulation", limitResult.remainingDaily, selector)
    }

    return { allowed: true, remainingDaily: limitResult.remainingDaily, selector }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      allowed: false,
      reason: `Preflight error: ${message}`,
      rule: "preflight",
      remainingDaily: 0n,
      selector: "0x00000000"
    }
  }
}

export function extractSelector(selectorOrCalldata: string): Hex {
  const value = selectorOrCalldata.startsWith("0x") ? selectorOrCalldata : `0x${selectorOrCalldata}`
  if (value.length === 10) return value as Hex
  if (value.length >= 10) return `0x${value.slice(2, 10)}` as Hex
  return "0x00000000"
}
