import { createPublicClient, createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"
import { requireAddress, requireEnv, requirePrivateKey } from "../../env"

export const AGENT_WALLET_ADDRESS = requireAddress("AGENT_CONTRACT_ADDRESS")
export const AGENT_ACCOUNT = privateKeyToAccount(requirePrivateKey("AGENT_PRIVATE_KEY"))

export const walletReadClient = createPublicClient({
  chain: sepolia,
  transport: http(requireEnv("ALCHEMY_RPC_URL"))
})

export const walletWriteClient = createWalletClient({
  account: AGENT_ACCOUNT,
  chain: sepolia,
  transport: http(requireEnv("ALCHEMY_RPC_URL"))
})

export const AGENT_WALLET_ABI = [
  { name: "agent", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "guardian", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "ethTxLimit", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "ethDailyLimit", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "ethDailySpent", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "tokenPolicy", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "dailyLimit", type: "uint256" }, { name: "dailySpent", type: "uint256" }, { name: "lastReset", type: "uint256" }, { name: "enabled", type: "bool" }] },
  { name: "pendingLimitChange", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "txLimit", type: "uint256" }, { name: "dailyLimit", type: "uint256" }, { name: "unlockTime", type: "uint256" }, { name: "queued", type: "bool" }] },
  { name: "pendingCall", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "target", type: "address" }, { name: "selector", type: "bytes4" }, { name: "checkRecipient", type: "bool" }, { name: "checkAmount", type: "bool" }, { name: "maxAmount", type: "uint256" }, { name: "unlockTime", type: "uint256" }, { name: "queued", type: "bool" }] },
  { name: "isRecipientAllowed", type: "function", stateMutability: "view", inputs: [{ name: "target", type: "address" }, { name: "sel", type: "bytes4" }, { name: "recipient", type: "address" }], outputs: [{ type: "bool" }] },
  { name: "execute", type: "function", stateMutability: "nonpayable", inputs: [{ name: "target", type: "address" }, { name: "value", type: "uint256" }, { name: "data", type: "bytes" }], outputs: [{ type: "bytes" }] },
  { type: "event", name: "Executed", inputs: [{ indexed: true, name: "target", type: "address" }, { indexed: false, name: "value", type: "uint256" }, { indexed: false, name: "selector", type: "bytes4" }] }
] as const
