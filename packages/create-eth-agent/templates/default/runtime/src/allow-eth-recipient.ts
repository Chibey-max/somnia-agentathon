import { createPublicClient, createWalletClient, http, isAddress } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { requireAddress, requireEnv, requirePrivateKey } from "./env"
import { somniaTestnet } from "./chain"
import { describeSelector, formatUnlockTime } from "./pending-format"

const CONTRACT = requireAddress("AGENT_CONTRACT_ADDRESS")
const ZERO_SELECTOR = "0x00000000" as const

const ABI = [
  {
    inputs: [
      { internalType: "address", name: "target", type: "address" },
      { internalType: "bytes4", name: "selector", type: "bytes4" },
      { internalType: "bool", name: "checkRecipient", type: "bool" },
      { internalType: "bool", name: "checkAmount", type: "bool" },
      { internalType: "uint256", name: "maxAmount", type: "uint256" }
    ],
    name: "queueCall",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "guardian",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "pendingCall",
    outputs: [
      { internalType: "address", name: "target", type: "address" },
      { internalType: "bytes4", name: "selector", type: "bytes4" },
      { internalType: "bool", name: "checkRecipient", type: "bool" },
      { internalType: "bool", name: "checkAmount", type: "bool" },
      { internalType: "uint256", name: "maxAmount", type: "uint256" },
      { internalType: "uint256", name: "unlockTime", type: "uint256" },
      { internalType: "bool", name: "queued", type: "bool" }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const

async function main() {
  const recipient = process.argv[2]
  if (!recipient || !isAddress(recipient)) {
    throw new Error("Usage: npm run allow-eth-recipient -- 0xRecipientAddress")
  }

  const rpcUrl = requireEnv("ALCHEMY_RPC_URL")
  const guardian = privateKeyToAccount(requirePrivateKey("GUARDIAN_PRIVATE_KEY"))
  const publicClient = createPublicClient({ chain: somniaTestnet, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account: guardian, chain: somniaTestnet, transport: http(rpcUrl) })

  const onchainGuardian = await publicClient.readContract({
    address: CONTRACT,
    abi: ABI,
    functionName: "guardian"
  })

  console.error("AgentWallet:", CONTRACT)
  console.error("Guardian signer from GUARDIAN_PRIVATE_KEY:", guardian.address)
  console.error("On-chain guardian:", onchainGuardian)

  if (guardian.address.toLowerCase() !== onchainGuardian.toLowerCase()) {
    throw new Error("GUARDIAN_PRIVATE_KEY does not match the AgentWallet guardian role")
  }

  const existing = await publicClient.readContract({
    address: CONTRACT,
    abi: ABI,
    functionName: "pendingCall"
  })

  if (existing[6]) {
    throw new Error(
      `A call is already queued. Apply or cancel it first.\n` +
      `Queued target: ${existing[0]}\n` +
      `Queued selector: ${existing[1]} (${describeSelector(existing[1])})\n` +
      formatUnlockTime(existing[5]).join("\n")
    )
  }

  const hash = await walletClient.writeContract({
    address: CONTRACT,
    abi: ABI,
    functionName: "queueCall",
    args: [recipient, ZERO_SELECTOR, false, false, 0n]
  })
  console.error("⏳ ETH recipient whitelist queued — tx:", hash)

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== "success") throw new Error(`queueCall reverted — tx: ${hash}`)
  console.error("   confirmed")

  const pending = await publicClient.readContract({
    address: CONTRACT,
    abi: ABI,
    functionName: "pendingCall"
  })

  console.error("\nQueued target:", pending[0], "// ETH recipient")
  console.error("Queued selector:", pending[1], `// ${describeSelector(pending[1])}`)
  for (const line of formatUnlockTime(pending[5])) console.error(line)
  console.error("\nAfter unlock, run:")
  console.error("npm run apply-setup")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
