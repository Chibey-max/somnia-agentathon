import { createWalletClient, createPublicClient, http, parseUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { requireAddress, requireEnv, requirePrivateKey } from "./env"
import { somniaTestnet } from "./chain"

const TRANSFER_SELECTOR = "0xa9059cbb" as `0x${string}`
const USDC    = "0x0000000000000000000000000000000000000000" // Fill with Somnia Testnet USDC address
const CONTRACT = requireAddress("AGENT_CONTRACT_ADDRESS")

const ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "token", "type": "address" }, { "internalType": "uint256", "name": "_dailyLimit", "type": "uint256" }],
    "name": "setTokenPolicy", "type": "function", "stateMutability": "nonpayable", "outputs": []
  },
  {
    "inputs": [{ "internalType": "address", "name": "target", "type": "address" }, { "internalType": "bytes4", "name": "selector", "type": "bytes4" }, { "internalType": "bool", "name": "checkRecipient", "type": "bool" }, { "internalType": "bool", "name": "checkAmount", "type": "bool" }, { "internalType": "uint256", "name": "maxAmount", "type": "uint256" }],
    "name": "queueCall", "type": "function", "stateMutability": "nonpayable", "outputs": []
  },
  {
    "inputs": [{ "internalType": "address", "name": "target", "type": "address" }, { "internalType": "bytes4", "name": "sel", "type": "bytes4" }, { "internalType": "address", "name": "recipient", "type": "address" }],
    "name": "addRecipient", "type": "function", "stateMutability": "nonpayable", "outputs": []
  },
  {
    "inputs": [],
    "name": "applyCall", "type": "function", "stateMutability": "nonpayable", "outputs": []
  },
  {
    "inputs": [],
    "name": "cancelCallQueue", "type": "function", "stateMutability": "nonpayable", "outputs": []
  },
  {
    "inputs": [],
    "name": "pendingCall",
    "outputs": [
      { "internalType": "address",  "name": "target",         "type": "address"  },
      { "internalType": "bytes4",   "name": "selector",       "type": "bytes4"   },
      { "internalType": "bool",     "name": "checkRecipient", "type": "bool"     },
      { "internalType": "bool",     "name": "checkAmount",    "type": "bool"     },
      { "internalType": "uint256",  "name": "maxAmount",      "type": "uint256"  },
      { "internalType": "uint256",  "name": "unlockTime",     "type": "uint256"  },
      { "internalType": "bool",     "name": "queued",         "type": "bool"     }
    ],
    "stateMutability": "view", "type": "function"
  },
  {
    "inputs": [], "name": "TIMELOCK",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view", "type": "function"
  }
] as const

async function setup() {
  const guardian = privateKeyToAccount(requirePrivateKey("GUARDIAN_PRIVATE_KEY"))
  const rpcUrl = requireEnv("RPC_URL")

  const publicClient = createPublicClient({ chain: somniaTestnet, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account: guardian, chain: somniaTestnet, transport: http(rpcUrl) })

  // Check timelock value
  const timelock = await publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: "TIMELOCK" })
  console.error(`⏱  Timelock is: ${Number(timelock) / 60} minutes`)

  async function waitForSuccess(hash: `0x${string}`, label: string) {
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== "success") throw new Error(`${label} reverted — tx: ${hash}`)
  }

  // 1. Set USDC daily limit (1000 USDC/day)
  const tx1 = await walletClient.writeContract({
    address: CONTRACT, abi: ABI,
    functionName: "setTokenPolicy",
    args: [USDC, parseUnits("1000", 6)]
  })
  console.error("✅ USDC policy submitted — tx:", tx1)
  await waitForSuccess(tx1, "setTokenPolicy")
  console.error("   confirmed")

  // 2. Queue USDC transfer whitelist
  const tx2 = await walletClient.writeContract({
    address: CONTRACT, abi: ABI,
    functionName: "queueCall",
    args: [USDC, TRANSFER_SELECTOR, true, true, parseUnits("500", 6)]
  })
  console.error("⏳ USDC transfer queue submitted — tx:", tx2)
  await waitForSuccess(tx2, "queueCall")
  console.error("   confirmed")

  // 3. Add trusted recipient
  const trusted = requireAddress("TRUSTED_RECIPIENT")
  const tx3 = await walletClient.writeContract({
    address: CONTRACT, abi: ABI,
    functionName: "addRecipient",
    args: [USDC, TRANSFER_SELECTOR, trusted]
  })
  console.error("✅ Trusted recipient submitted:", trusted, "— tx:", tx3)
  await waitForSuccess(tx3, "addRecipient")
  console.error("   confirmed")

  // Show unlock time
  const pending = await publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: "pendingCall" })
  const unlockTime = pending[5]
  const queued = pending[6]
  if (!queued || unlockTime === 0n) throw new Error("No pending call is queued on this contract")

  const unlockDate = new Date(Number(unlockTime) * 1000)
  console.error(`\n📅 Call unlocks at: ${unlockDate.toLocaleString()}`)
  console.error(`   UTC: ${unlockDate.toISOString()}`)
  console.error(`   Run 'npm run apply-setup' after that time`)
}

setup().catch(console.error)
