import { z } from "zod"
import { isAddress, parseEther, type Hex } from "viem"
import { execute, transferEth } from "./execute"
import { readState, serializeWalletState } from "./read"
import { runPreflight, extractSelector } from "../guard/preflight"
import { getHistory } from "./history"
import { getTokenPolicy } from "./token"
import { isWhitelisted } from "./whitelist"

const addressSchema = z.string().refine((v) => isAddress(v), "Invalid address")
const hexSchema = z.string().regex(/^0x[0-9a-fA-F]*$/, "Must be hex string")

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  schema: z.ZodTypeAny
  run: (input: unknown, emitProgress: (data: unknown) => void) => Promise<unknown>
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "get_wallet_state",
    description: "Returns AgentWallet live state and limits",
    inputSchema: { type: "object", properties: {}, required: [] },
    schema: z.object({}).strict(),
    run: async (_input: unknown) => serializeWalletState(await readState())
  },
  {
    name: "check_preflight",
    description: "Mirror AgentWallet execute() checks without sending a tx",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string" },
        value: { type: "string", description: "ETH in wei" },
        selector: { type: "string", description: "bytes4 selector" }
      },
      required: ["target", "value", "selector"]
    },
    schema: z.object({ target: addressSchema, value: z.string(), selector: z.string() }).strict(),
    run: async (rawInput: unknown) => {
      const input = rawInput as { target: string; value: string; selector: string }
      const selector = extractSelector(input.selector)
      const valueWei = BigInt(input.value)
      const result = await runPreflight({ target: input.target as `0x${string}`, value: valueWei, calldata: selector === "0x00000000" ? "0x" : (selector as Hex) })
      return { ...result, remainingDaily: result.remainingDaily.toString() }
    }
  },
  {
    name: "execute_call",
    description: "Execute arbitrary call via AgentWallet.execute after preflight checks",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string" },
        value: { type: "string", description: "ETH in wei" },
        calldata: { type: "string", description: "Hex calldata" }
      },
      required: ["target", "value", "calldata"]
    },
    schema: z.object({ target: addressSchema, value: z.string(), calldata: hexSchema }).strict(),
    run: async (rawInput: unknown, emitProgress: (data: unknown) => void) => {
      const input = rawInput as { target: string; value: string; calldata: string }
      return execute(input.target as `0x${string}`, BigInt(input.value), input.calldata as Hex, emitProgress as any)
    }
  },
  {
    name: "transfer_eth",
    description: "Transfer ETH via AgentWallet.execute to a whitelisted recipient",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string" },
        amount: { type: "string", description: "Amount in ETH" }
      },
      required: ["to", "amount"]
    },
    schema: z.object({ to: addressSchema, amount: z.string() }).strict(),
    run: async (rawInput: unknown, emitProgress: (data: unknown) => void) => {
      const input = rawInput as { to: string; amount: string }
      parseEther(input.amount)
      return transferEth(input.to as `0x${string}`, input.amount, emitProgress as any)
    }
  },
  {
    name: "get_transaction_history",
    description: "Get recent AgentWallet Executed events",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", default: 20 },
        fromBlock: { type: "string" }
      },
      required: []
    },
    schema: z.object({ limit: z.number().min(1).max(100).optional(), fromBlock: z.string().optional() }).strict(),
    run: async (rawInput: unknown) => {
      const input = rawInput as { limit?: number; fromBlock?: string }
      return getHistory(input.limit ?? 20, input.fromBlock ? BigInt(input.fromBlock) : undefined)
    }
  },
  {
    name: "get_token_policy",
    description: "Get token policy details for a token address",
    inputSchema: {
      type: "object",
      properties: { tokenAddress: { type: "string" } },
      required: ["tokenAddress"]
    },
    schema: z.object({ tokenAddress: addressSchema }).strict(),
    run: async (rawInput: unknown) => {
      const input = rawInput as { tokenAddress: string }
      const policy = await getTokenPolicy(input.tokenAddress as `0x${string}`)
      return {
        enabled: policy.enabled,
        dailyLimit: policy.dailyLimit.toString(),
        dailySpent: policy.dailySpent.toString(),
        remaining: policy.remaining.toString(),
        lastReset: policy.lastReset.toString()
      }
    }
  },
  {
    name: "check_whitelist",
    description: "Check local mirrored whitelist policy for target + selector",
    inputSchema: {
      type: "object",
      properties: { target: { type: "string" }, selector: { type: "string" } },
      required: ["target", "selector"]
    },
    schema: z.object({ target: addressSchema, selector: z.string() }).strict(),
    run: async (rawInput: unknown) => {
      const input = rawInput as { target: string; selector: string }
      const selector = extractSelector(input.selector)
      const policy = await isWhitelisted(input.target as `0x${string}`, selector)
      return {
        allowed: policy.allowed,
        checkRecipient: policy.checkRecipient,
        checkAmount: policy.checkAmount,
        maxAmount: policy.maxAmount.toString()
      }
    }
  },
  {
    name: "get_pending_actions",
    description: "Get pending call/limit changes with countdown timers",
    inputSchema: { type: "object", properties: {}, required: [] },
    schema: z.object({}).strict(),
    run: async (_input: unknown) => {
      const state = await readState()
      const now = Math.floor(Date.now() / 1000)
      const pendingCallSeconds = state.pendingCall.queued ? Math.max(Number(state.pendingCall.unlockTime) - now, 0) : 0
      const pendingLimitSeconds = state.pendingLimitChange.queued ? Math.max(Number(state.pendingLimitChange.unlockTime) - now, 0) : 0

      return {
        pendingCall: {
          ...state.pendingCall,
          maxAmount: state.pendingCall.maxAmount.toString(),
          unlockTime: state.pendingCall.unlockTime.toString(),
          secondsUntilUnlock: pendingCallSeconds
        },
        pendingLimitChange: {
          ...state.pendingLimitChange,
          txLimit: state.pendingLimitChange.txLimit.toString(),
          dailyLimit: state.pendingLimitChange.dailyLimit.toString(),
          unlockTime: state.pendingLimitChange.unlockTime.toString(),
          secondsUntilUnlock: pendingLimitSeconds
        }
      }
    }
  }
]

export const toolMap = new Map<string, ToolDefinition>(toolDefinitions.map((t) => [t.name, t]))
