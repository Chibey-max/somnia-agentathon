import { privateKeyToAccount } from "viem/accounts"
import { createPublicClient, createWalletClient, fallback, http } from "viem"
import { sepolia } from "viem/chains"
import { getChainId, getRpcUrl, requirePrivateKey } from "./env"

const chainId = getChainId()
if (chainId !== sepolia.id) {
  throw new Error(`Unsupported CHAIN_ID=${chainId}. This runtime currently supports Sepolia only (${sepolia.id}).`)
}

const PRIMARY_RPC = getRpcUrl()
const FALLBACK_RPCS = [
  "https://rpc.ankr.com/eth_sepolia",
  "https://sepolia.drpc.org"
]

function uniqueRpcUrls(urls: string[]): string[] {
  return [...new Set(urls.map((u) => u.trim()).filter(Boolean))]
}

export const rpcUrls = uniqueRpcUrls([PRIMARY_RPC, ...FALLBACK_RPCS])

const transport = fallback(
  rpcUrls.map((url) =>
    http(url, {
      timeout: 15_000,
      retryCount: 2,
      retryDelay: 250
    })
  )
)

export const publicClient = createPublicClient({
  chain: sepolia,
  transport
})

export const agentAccount = privateKeyToAccount(requirePrivateKey("AGENT_PRIVATE_KEY"))

export const walletClient = createWalletClient({
  account: agentAccount,
  chain: sepolia,
  transport
})

export function getExplorerTxUrl(txHash: `0x${string}`): string {
  return `https://sepolia.etherscan.io/tx/${txHash}`
}
