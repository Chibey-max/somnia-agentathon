import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./env";

/**
 * Mantle Sepolia Testnet chain definition for viem
 * Chain ID: 5003
 */
export const mantle = defineChain({
  id: 5003,
  name: "Mantle Sepolia",
  network: "mantle-sepolia",
  nativeCurrency: {
    name: "MNT",
    symbol: "MNT",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.sepolia.mantle.xyz"],
    },
    public: {
      http: ["https://rpc.sepolia.mantle.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Mantle Sepolia Explorer",
      url: "https://explorer.sepolia.mantle.xyz",
    },
  },
});

/**
 * Public client for reading chain state
 */
export const publicClient = createPublicClient({
  chain: mantle,
  transport: http(config.MANTLE_RPC_URL, {
    retryCount: 3,
    retryDelay: 1000,
  }),
});

/**
 * Agent account derived from private key
 */
export const agentAccount = privateKeyToAccount(
  config.AGENT_PRIVATE_KEY as `0x${string}`
);

/**
 * Wallet client for sending transactions
 */
export const walletClient = createWalletClient({
  account: agentAccount,
  chain: mantle,
  transport: http(config.MANTLE_RPC_URL, {
    retryCount: 3,
    retryDelay: 1000,
  }),
});

export type MantlePublicClient = typeof publicClient;
export type MantleWalletClient = typeof walletClient;
