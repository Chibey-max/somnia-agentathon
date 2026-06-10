import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import { createPublicClient, formatEther, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { somniaTestnet } from "../src/chain"
import {
  getRpcUrl,
  getRuntimeEnvPath,
  optionalEnv,
  requireAddress,
  requirePrivateKey
} from "../src/env"

type IdeName = "claude" | "cursor" | "kiro"

type IdeTarget = {
  name: IdeName
  filePath: string
  detected: boolean
}

type SetupOptions = {
  checkOnly: boolean
}

const CONTRACT_READ_ABI = [
  { name: "agent", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "guardian", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "ethTxLimit", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "ethDailyLimit", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }
] as const

function log(message: string): void {
  console.error(message)
}

function parseOptions(): SetupOptions {
  const args = process.argv.slice(2)
  return {
    checkOnly: args.includes("--check-only")
  }
}

function runtimeRoot(): string {
  return path.resolve(__dirname, "..")
}

function mcpServerPath(): string {
  return path.resolve(runtimeRoot(), "dist", "mcp-server.js")
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function getIdeTargets(projectRoot: string): IdeTarget[] {
  const home = os.homedir()
  const claudePath = path.join(home, ".config", "claude", "claude_desktop_config.json")
  const cursorPath = path.join(home, ".cursor", "mcp.json")
  const kiroPath = path.join(home, ".kiro", "settings", "mcp.json")

  return [
    { name: "claude", filePath: claudePath, detected: false },
    { name: "cursor", filePath: cursorPath, detected: false },
    { name: "kiro", filePath: kiroPath, detected: false }
  ]
}

async function detectIdes(projectRoot: string): Promise<IdeTarget[]> {
  const ideTargets = getIdeTargets(projectRoot)

  for (const target of ideTargets) {
    target.detected = await exists(target.filePath)
  }

  const vscodeDetected = await exists(path.join(projectRoot, ".vscode"))

  log("\nIDE detection:")
  for (const target of ideTargets) {
    log(`- ${target.name}: ${target.detected ? "detected" : "not detected"} (${target.filePath})`)
  }
  log(`- vscode workspace folder: ${vscodeDetected ? "detected" : "not detected"} (${path.join(projectRoot, ".vscode")})`)

  return ideTargets
}

function parseJsonLoose(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // noop
  }
  return {}
}

async function readJsonFileOrEmpty(filePath: string): Promise<Record<string, unknown>> {
  if (!(await exists(filePath))) {
    return {}
  }

  try {
    const raw = await fs.readFile(filePath, "utf8")
    return parseJsonLoose(raw)
  } catch {
    return {}
  }
}

async function writeMergedMcpConfig(filePath: string, absoluteServerPath: string): Promise<void> {
  const current = await readJsonFileOrEmpty(filePath)
  const currentMcpServersRaw = current.mcpServers

  const currentMcpServers: Record<string, unknown> =
    currentMcpServersRaw && typeof currentMcpServersRaw === "object" && !Array.isArray(currentMcpServersRaw)
      ? { ...(currentMcpServersRaw as Record<string, unknown>) }
      : {}

  currentMcpServers["somnia-agent"] = {
    command: "node",
    args: [absoluteServerPath]
  }

  const merged = {
    ...current,
    mcpServers: currentMcpServers
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(merged, null, 2)}\n`, "utf8")
}

async function promptIdeChoice(): Promise<"claude" | "cursor" | "kiro" | "all"> {
  const rl = readline.createInterface({ input, output })
  try {
    const answer = (await rl.question("Which IDE do you want to configure? (claude/cursor/kiro/all): "))
      .trim()
      .toLowerCase()

    if (answer === "claude" || answer === "cursor" || answer === "kiro" || answer === "all") {
      return answer
    }

    throw new Error("Invalid choice. Use: claude, cursor, kiro, or all.")
  } finally {
    rl.close()
  }
}

function requiredEnvNames(): string[] {
  return ["AGENT_CONTRACT_ADDRESS", "AGENT_PRIVATE_KEY", "RPC_URL", "GROQ_API_KEY"]
}

function validateRequiredEnv(): void {
  const missing: string[] = []

  for (const name of requiredEnvNames()) {
    const value = optionalEnv(name)
    if (!value) {
      missing.push(name)
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required env vars in ${getRuntimeEnvPath()}: ${missing.join(", ")}`)
  }

  // validate formats
  void requireAddress("AGENT_CONTRACT_ADDRESS")
  void requirePrivateKey("AGENT_PRIVATE_KEY")
}

async function runSetup(options: SetupOptions): Promise<void> {
  log("Somnia Agent setup starting...")
  log(`Using env file: ${getRuntimeEnvPath()}`)

  validateRequiredEnv()

  const rpcUrl = getRpcUrl()
  const contractAddress = requireAddress("AGENT_CONTRACT_ADDRESS")
  const agentPrivateKey = requirePrivateKey("AGENT_PRIVATE_KEY")

  const client = createPublicClient({ chain: somniaTestnet, transport: http(rpcUrl) })

  const blockNumber = await client.getBlockNumber()
  log(`RPC connection OK. Current block: ${blockNumber.toString()}`)

  const bytecode = await client.getBytecode({ address: contractAddress })
  if (!bytecode || bytecode === "0x") {
    throw new Error(`No contract code found at AGENT_CONTRACT_ADDRESS=${contractAddress} on Somnia Testnet.`)
  }

  const [agent, guardian, ethTxLimit, ethDailyLimit, paused] = await Promise.all([
    client.readContract({ address: contractAddress, abi: CONTRACT_READ_ABI, functionName: "agent" }),
    client.readContract({ address: contractAddress, abi: CONTRACT_READ_ABI, functionName: "guardian" }),
    client.readContract({ address: contractAddress, abi: CONTRACT_READ_ABI, functionName: "ethTxLimit" }),
    client.readContract({ address: contractAddress, abi: CONTRACT_READ_ABI, functionName: "ethDailyLimit" }),
    client.readContract({ address: contractAddress, abi: CONTRACT_READ_ABI, functionName: "paused" })
  ])

  log("\nContract state:")
  log(`Agent address: ${agent}`)
  log(`Guardian address: ${guardian}`)
  log(`STT tx limit: ${formatEther(ethTxLimit)} STT`)
  log(`Daily limit: ${formatEther(ethDailyLimit)} STT`)
  log(`Status: ${paused ? "PAUSED" : "Active"}`)

  const localAgent = privateKeyToAccount(agentPrivateKey)
  if (localAgent.address.toLowerCase() !== agent.toLowerCase()) {
    throw new Error(
      `Agent key mismatch. AGENT_PRIVATE_KEY resolves to ${localAgent.address}, but contract agent is ${agent}. ` +
        "Update AGENT_PRIVATE_KEY to the AGENT role key set in AgentWallet."
    )
  }

  log("Agent private key matches on-chain agent role. ✅")

  const projectRoot = path.resolve(runtimeRoot(), "..")
  const ides = await detectIdes(projectRoot)

  if (options.checkOnly) {
    log("\nCheck-only mode enabled; skipping IDE config writes.")
    log("Setup checks passed ✅")
    return
  }

  const choice = await promptIdeChoice()
  const absoluteServerPath = mcpServerPath()

  if (!(await exists(absoluteServerPath))) {
    throw new Error(
      `MCP server build output not found at ${absoluteServerPath}. Run 'npm run build' inside runtime/ first.`
    )
  }

  let selected: IdeTarget[]
  if (choice === "all") {
    selected = ides
  } else {
    selected = ides.filter((i) => i.name === choice)
  }

  for (const target of selected) {
    await writeMergedMcpConfig(target.filePath, absoluteServerPath)
    log(`Configured ${target.name}: ${target.filePath}`)
  }

  log("\nSetup complete ✅")
  log("Next steps:")
  log("1) Restart your IDE")
  log("2) Open IDE chat and ask: 'What is my STT balance?'")
  log("3) Ask: 'What are my spending limits?'")
}

async function main() {
  try {
    const options = parseOptions()
    await runSetup(options)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log(`Setup failed: ${message}`)
    process.exitCode = 1
  }
}

void main()
