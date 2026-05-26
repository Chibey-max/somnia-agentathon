import {
  encodeFunctionData,
  formatEther,
  formatUnits,
  isAddress,
  parseEther,
  parseUnits,
  type Hex
} from "viem"
import { agentAccount, getExplorerTxUrl, publicClient, walletClient } from "./account"
import { requireAddress } from "./env"
import type { ToolName } from "./tools"

const AGENT_WALLET_ADDRESS = requireAddress("AGENT_CONTRACT_ADDRESS")
const ZERO_SELECTOR = "0x00000000" as const

const AGENT_WALLET_ABI = [
  { name: "agent", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "guardian", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "ethTxLimit", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "ethDailyLimit", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "ethDailySpent", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    name: "pendingLimitChange",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "txLimit", type: "uint256" },
      { name: "dailyLimit", type: "uint256" },
      { name: "unlockTime", type: "uint256" },
      { name: "queued", type: "bool" }
    ]
  },
  {
    name: "pendingCall",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "target", type: "address" },
      { name: "selector", type: "bytes4" },
      { name: "checkRecipient", type: "bool" },
      { name: "checkAmount", type: "bool" },
      { name: "maxAmount", type: "uint256" },
      { name: "unlockTime", type: "uint256" },
      { name: "queued", type: "bool" }
    ]
  },
  {
    name: "tokenPolicy",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [
      { name: "dailyLimit", type: "uint256" },
      { name: "dailySpent", type: "uint256" },
      { name: "lastReset", type: "uint256" },
      { name: "enabled", type: "bool" }
    ]
  },
  {
    name: "isRecipientAllowed",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "target", type: "address" },
      { name: "sel", type: "bytes4" },
      { name: "recipient", type: "address" }
    ],
    outputs: [{ type: "bool" }]
  },
  {
    name: "execute",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "target", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" }
    ],
    outputs: [{ type: "bytes" }]
  },
  {
    type: "event",
    name: "Executed",
    inputs: [
      { indexed: true, name: "target", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
      { indexed: false, name: "selector", type: "bytes4" }
    ]
  }
] as const

const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ type: "bool" }]
  }
] as const

type RuntimeResult = {
  success: boolean
  tool: ToolName
  data?: Record<string, unknown>
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

type PreflightResult = {
  ok: boolean
  selector: `0x${string}`
  checks: {
    paused: boolean
    underTxLimit: boolean
    underDailyLimit: boolean
    simulatedExecutePass: boolean
  }
  limits: {
    valueWei: bigint
    txLimitWei: bigint
    dailyLimitWei: bigint
    dailySpentWei: bigint
    remainingDailyWei: bigint
  }
  whitelist: {
    target: `0x${string}`
    selector: `0x${string}`
    bySimulation: boolean
    recipient?: `0x${string}`
    recipientAllowed?: boolean
  }
  reason?: string
}

function selectorFromData(data: Hex): `0x${string}` {
  if (data === "0x" || data.length < 10) return ZERO_SELECTOR
  return `0x${data.slice(2, 10)}` as `0x${string}`
}

function cleanError(error: unknown): string {
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null) {
    const withShort = error as { shortMessage?: unknown; message?: unknown; details?: unknown }
    if (typeof withShort.shortMessage === "string") return withShort.shortMessage
    if (typeof withShort.message === "string") return withShort.message
    if (typeof withShort.details === "string") return withShort.details
  }
  return String(error)
}

function serializeBigints<T>(value: T): T {
  if (typeof value === "bigint") return value.toString() as T
  if (Array.isArray(value)) {
    return value.map((item) => serializeBigints(item)) as T
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeBigints(v)
    }
    return out as T
  }
  return value
}

function ok(tool: ToolName, data: Record<string, unknown>): RuntimeResult {
  return {
    success: true,
    tool,
    data: serializeBigints(data)
  }
}

function fail(tool: ToolName, code: string, message: string, details?: Record<string, unknown>): RuntimeResult {
  return {
    success: false,
    tool,
    error: {
      code,
      message,
      details: details ? serializeBigints(details) : undefined
    }
  }
}

async function readWalletState() {
  const [balanceWei, agent, guardian, paused, ethTxLimit, ethDailyLimit, ethDailySpent, pendingLimitChange, pendingCall] =
    await Promise.all([
      publicClient.getBalance({ address: AGENT_WALLET_ADDRESS }),
      publicClient.readContract({ address: AGENT_WALLET_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "agent" }),
      publicClient.readContract({ address: AGENT_WALLET_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "guardian" }),
      publicClient.readContract({ address: AGENT_WALLET_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "paused" }),
      publicClient.readContract({ address: AGENT_WALLET_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "ethTxLimit" }),
      publicClient.readContract({ address: AGENT_WALLET_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "ethDailyLimit" }),
      publicClient.readContract({ address: AGENT_WALLET_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "ethDailySpent" }),
      publicClient.readContract({
        address: AGENT_WALLET_ADDRESS,
        abi: AGENT_WALLET_ABI,
        functionName: "pendingLimitChange"
      }),
      publicClient.readContract({ address: AGENT_WALLET_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "pendingCall" })
    ])

  const remainingDailyWei = ethDailyLimit > ethDailySpent ? ethDailyLimit - ethDailySpent : 0n

  return {
    contractAddress: AGENT_WALLET_ADDRESS,
    balanceWei,
    balanceEth: formatEther(balanceWei),
    agent,
    guardian,
    paused,
    ethTxLimitWei: ethTxLimit,
    ethTxLimitEth: formatEther(ethTxLimit),
    ethDailyLimitWei: ethDailyLimit,
    ethDailyLimitEth: formatEther(ethDailyLimit),
    ethDailySpentWei: ethDailySpent,
    ethDailySpentEth: formatEther(ethDailySpent),
    remainingDailyWei,
    remainingDailyEth: formatEther(remainingDailyWei),
    pendingLimitChange: {
      txLimitWei: pendingLimitChange[0],
      txLimitEth: formatEther(pendingLimitChange[0]),
      dailyLimitWei: pendingLimitChange[1],
      dailyLimitEth: formatEther(pendingLimitChange[1]),
      unlockTime: pendingLimitChange[2],
      queued: pendingLimitChange[3]
    },
    pendingCall: {
      target: pendingCall[0],
      selector: pendingCall[1],
      checkRecipient: pendingCall[2],
      checkAmount: pendingCall[3],
      maxAmount: pendingCall[4],
      unlockTime: pendingCall[5],
      queued: pendingCall[6]
    }
  }
}

async function runPreflight(params: {
  target: `0x${string}`
  valueWei: bigint
  data: Hex
  recipient?: `0x${string}`
}): Promise<PreflightResult> {
  const state = await readWalletState()
  const selector = selectorFromData(params.data)
  const checks = {
    paused: !state.paused,
    underTxLimit: params.valueWei <= state.ethTxLimitWei,
    underDailyLimit: state.ethDailySpentWei + params.valueWei <= state.ethDailyLimitWei,
    simulatedExecutePass: false
  }

  const whitelist: PreflightResult["whitelist"] = {
    target: params.target,
    selector,
    bySimulation: false
  }

  if (params.recipient) {
    try {
      const allowed = await publicClient.readContract({
        address: AGENT_WALLET_ADDRESS,
        abi: AGENT_WALLET_ABI,
        functionName: "isRecipientAllowed",
        args: [params.target, selector as `0x${string}`, params.recipient]
      })
      whitelist.recipient = params.recipient
      whitelist.recipientAllowed = allowed
    } catch {
      // ignore optional recipient check failures
    }
  }

  if (!checks.paused) {
    return {
      ok: false,
      selector,
      checks,
      whitelist,
      limits: {
        valueWei: params.valueWei,
        txLimitWei: state.ethTxLimitWei,
        dailyLimitWei: state.ethDailyLimitWei,
        dailySpentWei: state.ethDailySpentWei,
        remainingDailyWei: state.remainingDailyWei
      },
      reason: "Contract is paused"
    }
  }

  if (!checks.underTxLimit) {
    return {
      ok: false,
      selector,
      checks,
      whitelist,
      limits: {
        valueWei: params.valueWei,
        txLimitWei: state.ethTxLimitWei,
        dailyLimitWei: state.ethDailyLimitWei,
        dailySpentWei: state.ethDailySpentWei,
        remainingDailyWei: state.remainingDailyWei
      },
      reason: "Exceeds ETH tx limit"
    }
  }

  if (!checks.underDailyLimit) {
    return {
      ok: false,
      selector,
      checks,
      whitelist,
      limits: {
        valueWei: params.valueWei,
        txLimitWei: state.ethTxLimitWei,
        dailyLimitWei: state.ethDailyLimitWei,
        dailySpentWei: state.ethDailySpentWei,
        remainingDailyWei: state.remainingDailyWei
      },
      reason: "ETH daily limit exceeded"
    }
  }

  try {
    await publicClient.simulateContract({
      account: agentAccount,
      address: AGENT_WALLET_ADDRESS,
      abi: AGENT_WALLET_ABI,
      functionName: "execute",
      args: [params.target, params.valueWei, params.data]
    })
    checks.simulatedExecutePass = true
    whitelist.bySimulation = true
  } catch (error) {
    const reason = cleanError(error)
    return {
      ok: false,
      selector,
      checks,
      whitelist,
      limits: {
        valueWei: params.valueWei,
        txLimitWei: state.ethTxLimitWei,
        dailyLimitWei: state.ethDailyLimitWei,
        dailySpentWei: state.ethDailySpentWei,
        remainingDailyWei: state.remainingDailyWei
      },
      reason: `Whitelist/policy simulation failed: ${reason}`
    }
  }

  return {
    ok: true,
    selector,
    checks,
    whitelist,
    limits: {
      valueWei: params.valueWei,
      txLimitWei: state.ethTxLimitWei,
      dailyLimitWei: state.ethDailyLimitWei,
      dailySpentWei: state.ethDailySpentWei,
      remainingDailyWei: state.remainingDailyWei
    }
  }
}

async function sendExecuteTx(target: `0x${string}`, valueWei: bigint, data: Hex) {
  const txHash = await walletClient.writeContract({
    address: AGENT_WALLET_ADDRESS,
    abi: AGENT_WALLET_ABI,
    functionName: "execute",
    args: [target, valueWei, data]
  })

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

  return {
    txHash,
    blockNumber: receipt.blockNumber,
    etherscanUrl: getExplorerTxUrl(txHash),
    receiptStatus: receipt.status,
    gasUsed: receipt.gasUsed
  }
}

async function toolGetWalletState(): Promise<RuntimeResult> {
  const state = await readWalletState()
  return ok("get_wallet_state", state)
}

async function toolTransferEth(input: { to: string; amount: string }): Promise<RuntimeResult> {
  if (!isAddress(input.to)) {
    return fail("transfer_eth", "INVALID_ADDRESS", "Invalid recipient address", { to: input.to })
  }

  const valueWei = parseEther(input.amount)
  const preflight = await runPreflight({
    target: input.to as `0x${string}`,
    valueWei,
    data: "0x"
  })

  if (!preflight.ok) {
    return fail("transfer_eth", "PREFLIGHT_FAILED", preflight.reason ?? "Preflight failed", {
      preflight
    })
  }

  const tx = await sendExecuteTx(input.to as `0x${string}`, valueWei, "0x")
  return ok("transfer_eth", {
    txHash: tx.txHash,
    blockNumber: tx.blockNumber,
    etherscanUrl: tx.etherscanUrl,
    receiptStatus: tx.receiptStatus,
    gasUsed: tx.gasUsed,
    amountEth: input.amount,
    to: input.to
  })
}

async function toolTransferToken(input: {
  token: string
  to: string
  amount: string
  decimals: number
}): Promise<RuntimeResult> {
  if (!isAddress(input.token)) {
    return fail("transfer_token", "INVALID_TOKEN_ADDRESS", "Invalid token address", { token: input.token })
  }
  if (!isAddress(input.to)) {
    return fail("transfer_token", "INVALID_RECIPIENT", "Invalid recipient address", { to: input.to })
  }

  const amountRaw = parseUnits(input.amount, input.decimals)
  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [input.to as `0x${string}`, amountRaw]
  })

  const preflight = await runPreflight({
    target: input.token as `0x${string}`,
    valueWei: 0n,
    data,
    recipient: input.to as `0x${string}`
  })

  if (!preflight.ok) {
    return fail("transfer_token", "PREFLIGHT_FAILED", preflight.reason ?? "Preflight failed", {
      preflight
    })
  }

  const tokenPolicy = await publicClient.readContract({
    address: AGENT_WALLET_ADDRESS,
    abi: AGENT_WALLET_ABI,
    functionName: "tokenPolicy",
    args: [input.token as `0x${string}`]
  })

  const tx = await sendExecuteTx(input.token as `0x${string}`, 0n, data)

  return ok("transfer_token", {
    txHash: tx.txHash,
    blockNumber: tx.blockNumber,
    etherscanUrl: tx.etherscanUrl,
    receiptStatus: tx.receiptStatus,
    gasUsed: tx.gasUsed,
    token: input.token,
    to: input.to,
    amount: input.amount,
    decimals: input.decimals,
    amountRaw,
    tokenPolicy: {
      enabled: tokenPolicy[3],
      dailyLimit: tokenPolicy[0],
      dailySpent: tokenPolicy[1],
      remaining: tokenPolicy[0] > tokenPolicy[1] ? tokenPolicy[0] - tokenPolicy[1] : 0n,
      lastReset: tokenPolicy[2]
    }
  })
}

async function toolGetTxStatus(input: { txHash: string }): Promise<RuntimeResult> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(input.txHash)) {
    return fail("get_tx_status", "INVALID_TX_HASH", "Invalid transaction hash", {
      txHash: input.txHash
    })
  }

  const txHash = input.txHash as `0x${string}`

  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash })
    return ok("get_tx_status", {
      txHash,
      status: receipt.status,
      blockNumber: receipt.blockNumber,
      transactionIndex: receipt.transactionIndex,
      from: receipt.from,
      to: receipt.to,
      gasUsed: receipt.gasUsed,
      etherscanUrl: getExplorerTxUrl(txHash)
    })
  } catch (error) {
    const message = cleanError(error)
    if (/not found/i.test(message)) {
      return ok("get_tx_status", {
        txHash,
        status: "pending_or_not_found",
        etherscanUrl: getExplorerTxUrl(txHash)
      })
    }
    throw error
  }
}

async function toolCheckLimits(): Promise<RuntimeResult> {
  const state = await readWalletState()
  return ok("check_limits", {
    paused: state.paused,
    ethTxLimitWei: state.ethTxLimitWei,
    ethTxLimitEth: state.ethTxLimitEth,
    ethDailyLimitWei: state.ethDailyLimitWei,
    ethDailyLimitEth: state.ethDailyLimitEth,
    ethDailySpentWei: state.ethDailySpentWei,
    ethDailySpentEth: state.ethDailySpentEth,
    remainingDailyWei: state.remainingDailyWei,
    remainingDailyEth: state.remainingDailyEth
  })
}

async function toolCheckWhitelist(input: {
  target: string
  selector: string
  recipient?: string
  amount?: string
}): Promise<RuntimeResult> {
  if (!isAddress(input.target)) {
    return fail("check_whitelist", "INVALID_TARGET", "Invalid target address", {
      target: input.target
    })
  }

  if (!/^0x[0-9a-fA-F]{8}$/.test(input.selector)) {
    return fail("check_whitelist", "INVALID_SELECTOR", "Selector must be 4-byte hex", {
      selector: input.selector
    })
  }

  if (input.recipient && !isAddress(input.recipient)) {
    return fail("check_whitelist", "INVALID_RECIPIENT", "Invalid recipient address", {
      recipient: input.recipient
    })
  }

  const selector = input.selector.toLowerCase() as `0x${string}`
  const amountWei = input.amount ? BigInt(input.amount) : selector === ZERO_SELECTOR ? 1n : 0n

  let calldata: Hex = "0x"
  if (selector !== ZERO_SELECTOR) {
    // We only need selector-level preflight for this tool; encoded args are optional.
    // If recipient + amount are provided and selector is ERC20 transfer, simulate with full calldata.
    if (selector === "0xa9059cbb" && input.recipient && input.amount) {
      calldata = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [input.recipient as `0x${string}`, BigInt(input.amount)]
      })
    } else {
      calldata = `${selector}00000000` as Hex
    }
  }

  const preflight = await runPreflight({
    target: input.target as `0x${string}`,
    valueWei: amountWei,
    data: calldata,
    recipient: input.recipient as `0x${string}` | undefined
  })

  return ok("check_whitelist", {
    allowed: preflight.ok,
    reason: preflight.reason,
    preflight
  })
}

async function toolGetPendingActions(): Promise<RuntimeResult> {
  const state = await readWalletState()
  const now = Math.floor(Date.now() / 1000)

  const pendingCallSeconds = state.pendingCall.queued
    ? Math.max(Number(state.pendingCall.unlockTime) - now, 0)
    : 0

  const pendingLimitSeconds = state.pendingLimitChange.queued
    ? Math.max(Number(state.pendingLimitChange.unlockTime) - now, 0)
    : 0

  return ok("get_pending_actions", {
    pendingCall: {
      ...state.pendingCall,
      secondsUntilUnlock: pendingCallSeconds
    },
    pendingLimitChange: {
      ...state.pendingLimitChange,
      secondsUntilUnlock: pendingLimitSeconds
    }
  })
}

async function toolGetTransactionHistory(input: { limit?: number; fromBlock?: string }): Promise<RuntimeResult> {
  const limit = input.limit ?? 20
  const fromBlock = input.fromBlock ? BigInt(input.fromBlock) : undefined

  const logs = await publicClient.getContractEvents({
    address: AGENT_WALLET_ADDRESS,
    abi: AGENT_WALLET_ABI,
    eventName: "Executed",
    fromBlock
  })

  const history = logs
    .slice(Math.max(logs.length - limit, 0))
    .reverse()
    .map((log) => ({
      target: (log.args.target ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      valueWei: log.args.value ?? 0n,
      valueEth: formatEther(log.args.value ?? 0n),
      selector: (log.args.selector ?? ZERO_SELECTOR) as `0x${string}`,
      blockNumber: log.blockNumber ?? 0n,
      txHash: log.transactionHash ?? "0x",
      etherscanUrl: log.transactionHash ? getExplorerTxUrl(log.transactionHash) : undefined
    }))

  return ok("get_transaction_history", { count: history.length, history })
}

export async function executeToolCall(name: ToolName, input: unknown): Promise<RuntimeResult> {
  try {
    switch (name) {
      case "get_wallet_state":
        return await toolGetWalletState()
      case "transfer_eth":
        return await toolTransferEth(input as { to: string; amount: string })
      case "transfer_token":
        return await toolTransferToken(
          input as {
            token: string
            to: string
            amount: string
            decimals: number
          }
        )
      case "get_tx_status":
        return await toolGetTxStatus(input as { txHash: string })
      case "check_limits":
        return await toolCheckLimits()
      case "check_whitelist":
        return await toolCheckWhitelist(input as { target: string; selector: string; recipient?: string; amount?: string })
      case "get_pending_actions":
        return await toolGetPendingActions()
      case "get_transaction_history":
        return await toolGetTransactionHistory(input as { limit?: number; fromBlock?: string })
      default:
        return fail(name, "UNKNOWN_TOOL", `Unknown tool: ${name}`)
    }
  } catch (error) {
    return fail(name, "TOOL_EXECUTION_ERROR", cleanError(error))
  }
}
