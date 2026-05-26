import { createWalletClient, http } from "viem"
import { sepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import { requireAddress, requireEnv, requirePrivateKey } from "./env"

const CONTRACT = requireAddress("AGENT_CONTRACT_ADDRESS")
const ABI = [{
  "inputs": [], "name": "applyCall",
  "type": "function", "stateMutability": "nonpayable", "outputs": []
}] as const

async function applySetup() {
  const guardian = privateKeyToAccount(requirePrivateKey("GUARDIAN_PRIVATE_KEY"))
  const client = createWalletClient({ account: guardian, chain: sepolia, transport: http(requireEnv("ALCHEMY_RPC_URL")) })
  const tx = await client.writeContract({ address: CONTRACT, abi: ABI, functionName: "applyCall", args: [] })
  console.error("✅ Call whitelist applied — tx:", tx)
}

applySetup().catch(console.error)
