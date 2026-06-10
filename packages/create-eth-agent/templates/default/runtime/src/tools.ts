import { z } from "zod"
import { isAddress } from "viem"

const addressSchema = z.string().refine((v) => isAddress(v), "Invalid Somnia address")
const hexSchema = z.string().regex(/^0x[0-9a-fA-F]*$/, "Must be a hex string")

export type ToolName =
  | "get_wallet_state"
  | "transfer_eth"
  | "transfer_token"
  | "get_tx_status"
  | "check_limits"
  | "check_whitelist"
  | "get_pending_actions"
  | "get_transaction_history"

export interface RuntimeToolDefinition<TInput = unknown> {
  name: ToolName
  description: string
  inputSchema: Record<string, unknown>
  schema: z.ZodType<TInput>
}

export const runtimeTools: RuntimeToolDefinition[] = [
  {
    name: "get_wallet_state",
    description:
      "Read the current AgentWallet state: STT balance, pause status, agent role address, guardian role address, per-transaction native limit, daily native limit, and native amount spent today.",
    inputSchema: { type: "object", properties: {}, required: [] },
    schema: z.object({}).strict()
  },
  {
    name: "transfer_eth",
    description:
      "Send STT from AgentWallet to a recipient. Use this only when user explicitly asks to transfer STT. Enforces on-chain policy checks including pause state, per-tx limit, daily limit, and whitelist.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient address (0x...)" },
        amount: { type: "string", description: "Amount in STT as decimal string, e.g. '0.001'" }
      },
      required: ["to", "amount"]
    },
    schema: z.object({ to: addressSchema, amount: z.string().min(1) }).strict()
  },
  {
    name: "transfer_token",
    description:
      "Transfer ERC-20 tokens via AgentWallet.execute(token.transfer). Use when user asks to send a token. Enforces on-chain policy checks including whitelist and token daily policy.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "ERC-20 token contract address" },
        to: { type: "string", description: "Recipient address" },
        amount: { type: "string", description: "Human amount (e.g. '10.5')" },
        decimals: { type: "number", description: "Token decimals (e.g. 6 for USDC, 18 for most tokens)" }
      },
      required: ["token", "to", "amount", "decimals"]
    },
    schema: z
      .object({
        token: addressSchema,
        to: addressSchema,
        amount: z.string().min(1),
        decimals: z.number().int().min(0).max(36)
      })
      .strict()
  },
  {
    name: "get_tx_status",
    description:
      "Get on-chain transaction status by hash. Returns status, block number, and explorer URL if mined.",
    inputSchema: {
      type: "object",
      properties: {
        txHash: { type: "string", description: "Transaction hash (0x...)" }
      },
      required: ["txHash"]
    },
    schema: z.object({ txHash: hexSchema.regex(/^0x[0-9a-fA-F]{64}$/, "Invalid tx hash") }).strict()
  },
  {
    name: "check_limits",
    description:
      "Read STT spending guardrails and remaining allowance from AgentWallet: per-tx native limit, daily native limit, spent today, and remaining daily allowance.",
    inputSchema: { type: "object", properties: {}, required: [] },
    schema: z.object({}).strict()
  },
  {
    name: "check_whitelist",
    description:
      "Preflight whether a target + function selector appears executable under current policy. Optionally include recipient and amount to test recipient/amount checks too.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", description: "Target contract or recipient address" },
        selector: { type: "string", description: "4-byte selector hex, e.g. 0xa9059cbb. Use 0x00000000 for raw STT transfer." },
        recipient: { type: "string", description: "Optional recipient to validate recipient policy where applicable" },
        amount: { type: "string", description: "Optional amount in wei to validate amount policy where applicable" }
      },
      required: ["target", "selector"]
    },
    schema: z
      .object({
        target: addressSchema,
        selector: z.string().regex(/^0x[0-9a-fA-F]{8}$/, "selector must be 4-byte hex (0x + 8 chars)"),
        recipient: addressSchema.optional(),
        amount: z.string().regex(/^\d+$/, "amount must be a decimal string in wei").optional()
      })
      .strict()
  },
  {
    name: "get_pending_actions",
    description:
      "Read pending queued wallet actions that are timelocked: pending call policy changes and pending native-token limit changes, including unlock countdown.",
    inputSchema: { type: "object", properties: {}, required: [] },
    schema: z.object({}).strict()
  },
  {
    name: "get_transaction_history",
    description:
      "Read recent AgentWallet Executed events to show transaction history. Optional block filter and result limit.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of most recent events to return (1-100). Default 20." },
        fromBlock: { type: "string", description: "Optional starting block number (as string)." }
      },
      required: []
    },
    schema: z
      .object({
        limit: z.number().int().min(1).max(100).optional(),
        fromBlock: z.string().regex(/^\d+$/, "fromBlock must be a decimal string").optional()
      })
      .strict()
  }
]

export const toolMap = new Map(runtimeTools.map((tool) => [tool.name, tool]))

export const agentTools = runtimeTools.map((tool) => ({
  type: "function" as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema
  }
}))
