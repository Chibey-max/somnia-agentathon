import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val || val === "0x" || val === "") {
    throw new Error(
      `[env] Missing required environment variable: ${key}\n` +
        `  → Copy .env.example to .env and fill in all values\n` +
        `  → See mantle/agent/.env.example for reference`
    );
  }
  return val;
}

function optionalEnv(key: string, fallback: string = ""): string {
  return process.env[key] || fallback;
}

export interface AgentConfig {
  // Contract addresses
  AGENT_CONTRACT_ADDRESS: `0x${string}`;
  IDENTITY_CONTRACT_ADDRESS: `0x${string}`;
  TRADING_VAULT_ADDRESS: `0x${string}`;
  GUARDIAN_ADDRESS: `0x${string}`;

  // Keys
  AGENT_PRIVATE_KEY: `0x${string}`;

  // RPC
  MANTLE_RPC_URL: string;
  CHAIN_ID: number;

  // LLM API Keys (at least one required)
  GROQ_API_KEY: string;
  OPENROUTER_API_KEY: string;
  GOOGLE_API_KEY: string;

  // Trading
  BYBIT_API_KEY: string;
  BYBIT_API_SECRET: string;
}

function loadConfig(): AgentConfig {
  // These are strictly required for the wallet to function
  const privateKey = requireEnv("AGENT_PRIVATE_KEY");
  const agentContract = requireEnv("AGENT_CONTRACT_ADDRESS");

  // These can be zero addresses initially (set after first deploy)
  const identityContract = optionalEnv("IDENTITY_CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000000");
  const tradingVault = optionalEnv("TRADING_VAULT_ADDRESS", "0x0000000000000000000000000000000000000000");
  const guardianAddress = optionalEnv("GUARDIAN_ADDRESS", "0x0000000000000000000000000000000000000000");

  // At least one LLM key must be present
  const groqKey = optionalEnv("GROQ_API_KEY");
  const openrouterKey = optionalEnv("OPENROUTER_API_KEY");
  const googleKey = optionalEnv("GOOGLE_API_KEY");

  if (!groqKey && !openrouterKey && !googleKey) {
    console.warn(
      "[env] Warning: No LLM API keys found (GROQ_API_KEY, OPENROUTER_API_KEY, GOOGLE_API_KEY).\n" +
        "  The agent will not be able to make decisions."
    );
  }

  return {
    AGENT_CONTRACT_ADDRESS: agentContract as `0x${string}`,
    IDENTITY_CONTRACT_ADDRESS: identityContract as `0x${string}`,
    TRADING_VAULT_ADDRESS: tradingVault as `0x${string}`,
    GUARDIAN_ADDRESS: guardianAddress as `0x${string}`,
    AGENT_PRIVATE_KEY: privateKey as `0x${string}`,
    MANTLE_RPC_URL: optionalEnv("MANTLE_RPC_URL", "https://rpc.mantle.xyz"),
    CHAIN_ID: parseInt(optionalEnv("CHAIN_ID", "5000"), 10),
    GROQ_API_KEY: groqKey,
    OPENROUTER_API_KEY: openrouterKey,
    GOOGLE_API_KEY: googleKey,
    BYBIT_API_KEY: optionalEnv("BYBIT_API_KEY"),
    BYBIT_API_SECRET: optionalEnv("BYBIT_API_SECRET"),
  };
}

export const config = loadConfig();
