import { erc20Abi, decodeFunctionData, isAddress, type Hex } from "viem"
import type { Address, WhitelistPolicyResult } from "../types"

// Mirror known policy shape in TS for fail-fast checks. On-chain simulation remains source of truth.
const ZERO_SELECTOR = "0x00000000" as Hex
const ERC20_TRANSFER_SELECTOR = "0xa9059cbb" as Hex
const ERC20_APPROVE_SELECTOR = "0x095ea7b3" as Hex
const ERC20_TRANSFER_FROM_SELECTOR = "0x23b872dd" as Hex

const trustedRecipient = (process.env.TRUSTED_RECIPIENT ?? "").toLowerCase()

interface StaticPolicy {
  allowed: boolean
  checkRecipient: boolean
  checkAmount: boolean
  maxAmount: bigint
  allowedRecipients: Set<string>
}

const staticPolicies = new Map<string, StaticPolicy>()

function key(target: Address, selector: Hex): string {
  return `${target.toLowerCase()}:${selector.toLowerCase()}`
}

export function registerDefaultPolicies(): void {
  const contractAddress = (process.env.AGENT_CONTRACT_ADDRESS ?? "") as Address
  if (isAddress(contractAddress) && isAddress(trustedRecipient)) {
    staticPolicies.set(key(contractAddress, ZERO_SELECTOR), {
      allowed: true,
      checkRecipient: true,
      checkAmount: true,
      maxAmount: BigInt(process.env.DEFAULT_ETH_POLICY_MAX_WEI ?? "0"),
      allowedRecipients: new Set([trustedRecipient])
    })
  }
}

export function getStaticPolicy(target: Address, selector: Hex): WhitelistPolicyResult {
  const existing = staticPolicies.get(key(target, selector))
  if (!existing) {
    return { allowed: false, checkRecipient: false, checkAmount: false, maxAmount: 0n }
  }
  return {
    allowed: existing.allowed,
    checkRecipient: existing.checkRecipient,
    checkAmount: existing.checkAmount,
    maxAmount: existing.maxAmount
  }
}

export function parseCalldataFields(selector: Hex, calldata: Hex): { recipient?: Address; amount?: bigint } {
  try {
    if (selector === ERC20_TRANSFER_SELECTOR || selector === ERC20_APPROVE_SELECTOR) {
      const decoded = decodeFunctionData({ abi: erc20Abi, data: calldata })
      const args = decoded.args as readonly [Address, bigint]
      return { recipient: args[0], amount: args[1] }
    }
    if (selector === ERC20_TRANSFER_FROM_SELECTOR) {
      const decoded = decodeFunctionData({ abi: erc20Abi, data: calldata })
      const args = decoded.args as readonly [Address, Address, bigint]
      return { recipient: args[1], amount: args[2] }
    }
  } catch {
    return {}
  }
  return {}
}

export const SELECTORS = {
  ZERO_SELECTOR,
  ERC20_TRANSFER_SELECTOR,
  ERC20_APPROVE_SELECTOR,
  ERC20_TRANSFER_FROM_SELECTOR
}
