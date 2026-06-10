import { privateKeyToAccount } from "viem/accounts"
import { createPublicClient, createWalletClient, fallback, http } from "viem"
import { somniaTestnet } from "./chain"
import { getChainId, getRpcUrl, requirePrivateKey } from "./env"

const chainId = getChainId()
if (chainId !== somniaTestnet.id) {
  throw new Error(`Unsupported CHAIN_ID=${chainId}. Expected Somnia Testnet (${somniaTestnet.id}).`)
}

const PRIMARY_RPC = getRpcUrl()
const FALLBACK_RPCS = [
  "https://dream-rpc.somnia.network",
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
  chain: somniaTestnet,
  transport
})

export const agentAccount = privateKeyToAccount(requirePrivateKey("AGENT_PRIVATE_KEY"))

export const walletClient = createWalletClient({
  account: agentAccount,
  chain: somniaTestnet,
  transport
})

export function getExplorerTxUrl(txHash: `0x${string}`): string {
  return `https://shannon-explorer.somnia.network/tx/${txHash}`
}
