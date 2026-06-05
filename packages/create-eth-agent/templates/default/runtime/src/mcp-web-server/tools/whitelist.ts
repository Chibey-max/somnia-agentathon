import { isAddress, type Hex } from "viem"
import type { Address, WhitelistPolicyResult } from "../types"
import { getStaticPolicy } from "../guard/policy"

export async function isWhitelisted(target: Address, selector: Hex): Promise<WhitelistPolicyResult> {
  try {
    if (!isAddress(target)) {
      return { allowed: false, checkRecipient: false, checkAmount: false, maxAmount: 0n }
    }
    return getStaticPolicy(target, selector)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to evaluate whitelist policy: ${message}`)
  }
}
