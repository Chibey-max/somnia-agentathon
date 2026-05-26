import { createWalletClient, http } from "viem"
import { sepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import { requireAddress, requireEnv, requirePrivateKey } from "./env"

const AGENT_WALLET_ABI = [{
  name: "execute",
  type: "function",
  stateMutability: "nonpayable",
  inputs: [
    { name: "target", type: "address" },
    { name: "value", type: "uint256" },
    { name: "data", type: "bytes" }
  ],
  outputs: [{ name: "", type: "bytes" }]
}] as const

const AGENT_WALLET_ADDRESS = requireAddress("AGENT_CONTRACT_ADDRESS")

type SignerMode = "local" | "proxy"

function getSignerMode(): SignerMode {
  const mode = process.env.SIGNER_MODE?.trim().toLowerCase()
  return mode === "proxy" ? "proxy" : "local"
}

async function executeViaLocalSigner(input: { target: `0x${string}`; value: bigint; data: `0x${string}` }) {
  const agent = privateKeyToAccount(requirePrivateKey("AGENT_PRIVATE_KEY"))
  const walletClient = createWalletClient({
    account: agent,
    chain: sepolia,
    transport: http(requireEnv("ALCHEMY_RPC_URL"))
  })

  const txHash = await walletClient.writeContract({
    address: AGENT_WALLET_ADDRESS,
    abi: AGENT_WALLET_ABI,
    functionName: "execute",
    args: [input.target, input.value, input.data]
  })

  return { txHash }
}

async function executeViaProxySigner(input: { target: `0x${string}`; value: bigint; data: `0x${string}` }) {
  const proxyUrl = requireEnv("SIGNER_PROXY_URL")
  const token = process.env.SIGNER_PROXY_TOKEN?.trim()

  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      action: "agent_wallet_execute",
      chainId: sepolia.id,
      contractAddress: AGENT_WALLET_ADDRESS,
      target: input.target,
      value: input.value.toString(),
      data: input.data
    })
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Signer proxy request failed: HTTP ${response.status} ${body}`)
  }

  const json = (await response.json()) as { txHash?: string; error?: string }
  if (!json.txHash) {
    throw new Error(json.error || "Signer proxy did not return txHash")
  }

  return { txHash: json.txHash as `0x${string}` }
}

export async function executeAgentWalletCall(input: { target: `0x${string}`; value: bigint; data?: `0x${string}` }) {
  const normalized = {
    target: input.target,
    value: input.value,
    data: input.data || "0x"
  }

  const mode = getSignerMode()
  return mode === "proxy" ? executeViaProxySigner(normalized) : executeViaLocalSigner(normalized)
}
