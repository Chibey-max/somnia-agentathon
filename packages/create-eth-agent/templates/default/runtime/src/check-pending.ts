import { createPublicClient, http } from "viem"
import { sepolia } from "viem/chains"
import { requireAddress, requireEnv } from "./env"
import { describeSelector, formatUnlockTime } from "./pending-format"

const CONTRACT = requireAddress("AGENT_CONTRACT_ADDRESS")

const ABI = [
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

async function checkPending() {
  const client = createPublicClient({
    chain: sepolia,
    transport: http(requireEnv("ALCHEMY_RPC_URL"))
  })

  const pending = await client.readContract({
    address: CONTRACT,
    abi: ABI,
    functionName: "pendingCall"
  })

  const target = pending[0]
  const selector = pending[1]
  const checkRecipient = pending[2]
  const checkAmount = pending[3]
  const maxAmount = pending[4]
  const unlockTime = pending[5]
  const queued = pending[6]

  console.error("Contract:", CONTRACT)
  console.error("queued:", queued)
  console.error("queued target:", target)
  console.error("queued selector:", selector, `// ${describeSelector(selector)}`)
  console.error("checkRecipient:", checkRecipient)
  console.error("checkAmount:", checkAmount)
  console.error("maxAmount:", maxAmount.toString())

  if (!queued || unlockTime === 0n) {
    console.error("No pending call is currently queued.")
    return
  }

  for (const line of formatUnlockTime(unlockTime)) console.error(line)
}

checkPending().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
