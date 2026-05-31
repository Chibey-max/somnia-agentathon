import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline/promises'
import * as dotenv from 'dotenv'
import { createPublicClient, fallback, formatEther, http, isAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { AGENT_WALLET_ABI } from 'eth-agent-kit'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    process.stderr.write(`Missing required env var: ${name}\n`)
    process.exit(1)
  }
  return value
}

function readJson(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {}
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

function writeJson(filePath: string, value: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2))
}

function detectIdeConfigs(): { claude: string[]; cursor: string[]; kiro: string[] } {
  const home = os.homedir()
  const claudePaths = [
    path.join(home, '.config/claude/claude_desktop_config.json'),
    path.join(home, 'Library/Application Support/Claude/claude_desktop_config.json')
  ]
  const cursorPaths = [path.join(home, '.cursor/mcp.json')]
  const kiroPaths = [path.join(home, '.kiro/settings/mcp.json')]

  return {
    claude: claudePaths.filter((p) => fs.existsSync(p)),
    cursor: cursorPaths.filter((p) => fs.existsSync(p)),
    kiro: kiroPaths.filter((p) => fs.existsSync(p))
  }
}

async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
  const answer = await rl.question(question)
  rl.close()
  return answer.trim().toLowerCase()
}

function configureIde(configPath: string, serverPath: string, label: string): void {
  const existing = readJson(configPath)
  const mcpServers = (existing.mcpServers && typeof existing.mcpServers === 'object' ? existing.mcpServers : {}) as Record<string, unknown>
  mcpServers['eth-agent'] = {
    command: 'node',
    args: [serverPath]
  }
  writeJson(configPath, { ...existing, mcpServers })
  process.stderr.write(`✓ Configured ${label} at ${configPath}\n`)
}

async function main(): Promise<void> {
  const contractAddress = requiredEnv('AGENT_CONTRACT_ADDRESS') as `0x${string}`
  const privateKey = requiredEnv('AGENT_PRIVATE_KEY') as `0x${string}`
  const rpcUrl = process.env.RPC_URL?.trim() || process.env.ALCHEMY_RPC_URL?.trim() || ''
  const groq = process.env.GROQ_API_KEY?.trim()
  const openRouter = process.env.OPENROUTER_API_KEY?.trim()
  const google = process.env.GOOGLE_API_KEY?.trim()

  if (!rpcUrl) {
    process.stderr.write('Missing required env var: RPC_URL\n')
    process.exit(1)
  }
  if (!groq && !openRouter && !google) {
    process.stderr.write('Missing provider key: set GROQ_API_KEY or OPENROUTER_API_KEY or GOOGLE_API_KEY\n')
    process.exit(1)
  }

  if (!isAddress(contractAddress)) {
    process.stderr.write('AGENT_CONTRACT_ADDRESS is not a valid address\n')
    process.exit(1)
  }

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: fallback([
      http(rpcUrl),
      http('https://rpc.ankr.com/eth_sepolia'),
      http('https://sepolia.drpc.org'),
      http('https://ethereum-sepolia-rpc.publicnode.com')
    ])
  })

  try {
    const block = await publicClient.getBlockNumber()
    process.stderr.write(`✓ Connected to Sepolia (block #${block.toString()})\n`)
  } catch {
    process.stderr.write('RPC connection failed. Try https://rpc.ankr.com/eth_sepolia\n')
    process.exit(1)
  }

  const [balance, agent, guardian, ethTxLimit, ethDailyLimit, paused] = await Promise.all([
    publicClient.getBalance({ address: contractAddress }),
    publicClient.readContract({ address: contractAddress, abi: AGENT_WALLET_ABI, functionName: 'agent' }),
    publicClient.readContract({ address: contractAddress, abi: AGENT_WALLET_ABI, functionName: 'guardian' }),
    publicClient.readContract({ address: contractAddress, abi: AGENT_WALLET_ABI, functionName: 'ethTxLimit' }),
    publicClient.readContract({ address: contractAddress, abi: AGENT_WALLET_ABI, functionName: 'ethDailyLimit' }),
    publicClient.readContract({ address: contractAddress, abi: AGENT_WALLET_ABI, functionName: 'paused' })
  ])

  process.stderr.write('\nContract state\n')
  process.stderr.write('----------------------------------------\n')
  process.stderr.write(`contractAddress: ${contractAddress}\n`)
  process.stderr.write(`balance:         ${formatEther(balance)} ETH\n`)
  process.stderr.write(`agent:           ${agent}\n`)
  process.stderr.write(`guardian:        ${guardian}\n`)
  process.stderr.write(`ethTxLimit:      ${formatEther(ethTxLimit)} ETH\n`)
  process.stderr.write(`ethDailyLimit:   ${formatEther(ethDailyLimit)} ETH\n`)
  process.stderr.write(`paused:          ${paused}\n`)
  process.stderr.write('----------------------------------------\n\n')

  const derived = privateKeyToAccount(privateKey).address
  if (derived.toLowerCase() !== String(agent).toLowerCase()) {
    process.stderr.write('Agent key mismatch: AGENT_PRIVATE_KEY address does not match contract agent() role.\n')
    process.stderr.write(`- Derived from private key: ${derived}\n`)
    process.stderr.write(`- Contract agent():         ${agent}\n`)
    process.exit(1)
  }

  const detected = detectIdeConfigs()
  process.stderr.write('Detected IDE configs:\n')
  process.stderr.write(`- Claude: ${detected.claude.length ? detected.claude.join(', ') : 'not found'}\n`)
  process.stderr.write(`- Cursor: ${detected.cursor.length ? detected.cursor.join(', ') : 'not found'}\n`)
  process.stderr.write(`- Kiro:   ${detected.kiro.length ? detected.kiro.join(', ') : 'not found'}\n\n`)

  const selection = await ask('Which IDE do you want to configure? (claude/cursor/kiro/all/skip) ')
  const serverPath = path.resolve(process.cwd(), 'dist/mcp-server.js')

  const home = os.homedir()
  const claudeTargets = detected.claude.length
    ? detected.claude
    : [path.join(home, '.config/claude/claude_desktop_config.json')]
  const cursorTargets = detected.cursor.length
    ? detected.cursor
    : [path.join(home, '.cursor/mcp.json')]
  const kiroTargets = detected.kiro.length
    ? detected.kiro
    : [path.join(home, '.kiro/settings/mcp.json')]

  if (selection === 'claude' || selection === 'all') claudeTargets.forEach((p) => configureIde(p, serverPath, 'Claude'))
  if (selection === 'cursor' || selection === 'all') cursorTargets.forEach((p) => configureIde(p, serverPath, 'Cursor'))
  if (selection === 'kiro' || selection === 'all') kiroTargets.forEach((p) => configureIde(p, serverPath, 'Kiro'))

  process.stderr.write('\n✅ Setup complete!\n')
  process.stderr.write('Restart your IDE and try:\n')
  process.stderr.write('  "What is my ETH balance?"\n')
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exit(1)
})
