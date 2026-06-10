export interface SkillConfig {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description: string; required?: boolean }>;
    required?: string[];
  };
  handlerPath: string;
  icon: string;
  category: "transfer" | "defi" | "trading" | "identity";
}

export const skillsManifest: SkillConfig[] = [
  {
    name: "transfer-mnt",
    description: "Transfer native MNT tokens from the agent wallet to a whitelisted address. Respects daily spending limits.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient wallet address (must be whitelisted)" },
        amount: { type: "string", description: "Amount of MNT to transfer (e.g., '1.5')" },
      },
      required: ["to", "amount"],
    },
    handlerPath: "./src/transfer-mnt",
    icon: "arrow-up-right",
    category: "transfer",
  },
  {
    name: "stake-meth",
    description: "Stake MNT to receive mETH via Mantle LSP. Earn ~4.5% APY with liquid staking.",
    inputSchema: {
      type: "object",
      properties: {
        amount: { type: "string", description: "Amount of MNT to stake (e.g., '10.0')" },
      },
      required: ["amount"],
    },
    handlerPath: "./src/stake-meth",
    icon: "layers",
    category: "defi",
  },
  {
    name: "swap-agni",
    description: "Swap tokens on Agni Finance DEX on Mantle. Supports MNT/mETH/USDY pairs.",
    inputSchema: {
      type: "object",
      properties: {
        tokenIn: { type: "string", description: "Input token (MNT, METH, or USDY)" },
        tokenOut: { type: "string", description: "Output token (MNT, METH, or USDY)" },
        amountIn: { type: "string", description: "Input amount" },
        slippageBps: { type: "number", description: "Slippage tolerance in basis points (default: 50 = 0.5%)" },
      },
      required: ["tokenIn", "tokenOut", "amountIn"],
    },
    handlerPath: "./src/swap-agni",
    icon: "repeat",
    category: "defi",
  },
  {
    name: "swap-merchant-moe",
    description: "Swap tokens on Merchant Moe DEX on Mantle. Uses Joe V2.1 liquidity bins.",
    inputSchema: {
      type: "object",
      properties: {
        tokenIn: { type: "string", description: "Input token (MNT, METH, or USDY)" },
        tokenOut: { type: "string", description: "Output token (MNT, METH, or USDY)" },
        amountIn: { type: "string", description: "Input amount" },
        slippageBps: { type: "number", description: "Slippage tolerance in basis points (default: 50)" },
      },
      required: ["tokenIn", "tokenOut", "amountIn"],
    },
    handlerPath: "./src/swap-merchant-moe",
    icon: "shuffle",
    category: "defi",
  },
  {
    name: "execute-trade",
    description: "Execute a Bybit-informed trading signal on-chain via TradingVault. Runs full risk management checks.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Trading pair (e.g., MNTUSDT, ETHUSDT)" },
        action: { type: "string", description: "Trade action: BUY or SELL" },
        amount: { type: "string", description: "Amount in MNT to allocate (optional — auto-sized by risk manager if omitted)" },
      },
      required: ["symbol", "action"],
    },
    handlerPath: "./src/execute-trade",
    icon: "trending-up",
    category: "trading",
  },
  {
    name: "get-agent-identity",
    description: "Read the ERC-8004 on-chain agent identity. Returns name, type, reputation, action count, and recent actions.",
    inputSchema: {
      type: "object",
      properties: {
        tokenId: { type: "number", description: "Identity token ID (optional — uses agent's own if omitted)" },
      },
    },
    handlerPath: "./src/get-agent-identity",
    icon: "fingerprint",
    category: "identity",
  },
];

export default skillsManifest;
