import { z } from "zod";

// ─── Token Addresses ───────────────────────────────────────────────────────────
export const MANTLE_TOKENS = {
  MNT: "0x0000000000000000000000000000000000000000" as const, // native
  METH: "0xcDA86A272531e8640cD7F1a92c01839911B90bb0" as const,
  USDY: "0x5bE26527e817998A7206475496fDE1E68957c5A9" as const,
} as const;

export type TokenSymbol = keyof typeof MANTLE_TOKENS;

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const tools = {
  get_wallet_state: {
    name: "get_wallet_state",
    description:
      "Get the current state of the Mantle agent wallet: MNT/mETH/USDY balances, spending limits, guardian status, pause state.",
    inputSchema: z.object({}),
  },

  transfer_mnt: {
    name: "transfer_mnt",
    description:
      "Transfer native MNT from the agent wallet to a whitelisted address.",
    inputSchema: z.object({
      to: z.string().describe("Recipient address (must be whitelisted)"),
      amount: z.string().describe("Amount in MNT (e.g., '1.5')"),
    }),
  },

  transfer_token: {
    name: "transfer_token",
    description:
      "Transfer an ERC20 token (mETH, USDY, or any ERC20) from the agent wallet.",
    inputSchema: z.object({
      token: z
        .enum(["METH", "USDY"])
        .or(z.string().regex(/^0x[0-9a-fA-F]{40}$/))
        .describe("Token symbol (METH/USDY) or contract address"),
      to: z.string().describe("Recipient address (must be whitelisted)"),
      amount: z.string().describe("Amount in token units (e.g., '100.0')"),
    }),
  },

  get_tx_status: {
    name: "get_tx_status",
    description:
      "Check the status of a transaction on Mantle by hash. Returns confirmation count, success, and gas used.",
    inputSchema: z.object({
      txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).describe("Transaction hash"),
    }),
  },

  check_limits: {
    name: "check_limits",
    description:
      "Check current spending limits for MNT, mETH, and USDY: per-tx limit, daily limit, and how much has been spent today.",
    inputSchema: z.object({
      token: z
        .enum(["MNT", "METH", "USDY"])
        .optional()
        .describe("Token to check (omit for all tokens)"),
    }),
  },

  check_whitelist: {
    name: "check_whitelist",
    description:
      "Check if an address is whitelisted on the agent wallet for sending/executing.",
    inputSchema: z.object({
      address: z.string().describe("Address to check"),
    }),
  },

  get_agent_identity: {
    name: "get_agent_identity",
    description:
      "Read the ERC-8004 on-chain agent identity NFT: name, type, reputation score, action count, recent actions.",
    inputSchema: z.object({
      tokenId: z.number().optional().describe("Token ID (omit to use agent's own identity)"),
    }),
  },

  record_action: {
    name: "record_action",
    description:
      "Record an agent decision on-chain via ERC-8004 identity. Use this to log important decisions immutably.",
    inputSchema: z.object({
      action: z.string().describe("Human-readable description of the action taken"),
      txHash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .optional()
        .describe("Associated transaction hash (optional)"),
    }),
  },

  execute_trade: {
    name: "execute_trade",
    description:
      "Execute a trading strategy via the TradingVault on Mantle. Opens/closes positions with agent authorization.",
    inputSchema: z.object({
      strategyName: z.string().describe("Name of the strategy being executed"),
      target: z.string().describe("DEX router or protocol contract address"),
      calldata: z.string().describe("Hex-encoded calldata for the strategy"),
      amountMnt: z.string().optional().describe("MNT amount to send with the call"),
    }),
  },

  get_trading_positions: {
    name: "get_trading_positions",
    description:
      "Get all open trading positions from the TradingVault: token, size, entry price, PnL estimate.",
    inputSchema: z.object({}),
  },

  get_yield_rate: {
    name: "get_yield_rate",
    description:
      "Get the current mETH staking APY and yield data from Mantle LSP (Liquid Staking Protocol).",
    inputSchema: z.object({}),
  },

  get_transaction_history: {
    name: "get_transaction_history",
    description:
      "Get recent transaction history for the agent wallet on Mantle network.",
    inputSchema: z.object({
      limit: z.number().min(1).max(50).optional().default(10).describe("Number of transactions to return"),
    }),
  },
} as const;

export type ToolName = keyof typeof tools;

// Convert to MCP-compatible tool list format
export function toMcpTools() {
  return Object.values(tools).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.inputSchema),
  }));
}

// Simple Zod to JSON Schema converter for MCP
function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const shape = (schema as z.ZodObject<z.ZodRawShape>)._def?.shape?.();
  if (!shape) {
    return { type: "object", properties: {} };
  }

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodField = value as z.ZodTypeAny;
    const def = zodField._def;

    // Unwrap optional
    const isOptional = def.typeName === "ZodOptional";
    const innerDef = isOptional ? def.innerType._def : def;

    let fieldSchema: Record<string, unknown> = {};
    const description = innerDef.description || def.description;

    switch (innerDef.typeName) {
      case "ZodString":
        fieldSchema = { type: "string" };
        break;
      case "ZodNumber":
        fieldSchema = { type: "number" };
        break;
      case "ZodBoolean":
        fieldSchema = { type: "boolean" };
        break;
      case "ZodEnum":
        fieldSchema = { type: "string", enum: innerDef.values };
        break;
      default:
        fieldSchema = { type: "string" };
    }

    if (description) fieldSchema.description = description;
    properties[key] = fieldSchema;

    if (!isOptional) required.push(key);
  }

  return {
    type: "object",
    properties,
    required: required.length > 0 ? required : undefined,
  };
}
