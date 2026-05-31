import OpenAI from 'openai'
import { z } from 'zod'
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  fallback,
  formatEther,
  getAddress,
  http,
  isAddress,
  parseEther,
  parseUnits,
  type Hex
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { AGENT_WALLET_ABI } from './abi'
import type { AgentConfig, AgentEvent, PreflightResult, TransactionResult, WalletState } from './types'
import { startMCPServer as startMCP } from './mcp'

type ToolName =
  | 'get_wallet_state'
  | 'transfer_eth'
  | 'transfer_token'
  | 'get_tx_status'
  | 'check_limits'
  | 'check_whitelist'
  | 'get_pending_actions'
  | 'get_transaction_history'

type RuntimeResult = {
  success: boolean
  tool: ToolName
  data?: Record<string, unknown>
  error?: { code: string; message: string; details?: Record<string, unknown> }
}

type ProviderName = 'groq' | 'openrouter' | 'google'
type ProviderConfig = { name: ProviderName; client: OpenAI; model: string }

const ZERO_SELECTOR = '0x00000000' as const
const CONVERSATIONAL_ONLY = /^(hi|hello|hey|gm|gn|yo|sup|thanks|thank you|who are you|what can you do|help)\b/i
const ACTION_HINTS = /\b(send|transfer|swap|approve|execute|status|tx|hash|balance|limit|whitelist|pending|history|wallet)\b/i

const addressSchema = z.string().refine((v) => isAddress(v), 'Invalid Ethereum address')
const hexSchema = z.string().regex(/^0x[0-9a-fA-F]*$/, 'Must be a hex string')

const runtimeTools = [
  { name: 'get_wallet_state', description: 'Read current AgentWallet state.', inputSchema: { type: 'object', properties: {}, required: [] }, schema: z.object({}).strict() },
  { name: 'transfer_eth', description: 'Send ETH from AgentWallet to recipient with policy checks.', inputSchema: { type: 'object', properties: { to: { type: 'string' }, amount: { type: 'string' } }, required: ['to', 'amount'] }, schema: z.object({ to: addressSchema, amount: z.string().min(1) }).strict() },
  { name: 'transfer_token', description: 'Transfer ERC20 via AgentWallet.execute with policy checks.', inputSchema: { type: 'object', properties: { token: { type: 'string' }, to: { type: 'string' }, amount: { type: 'string' }, decimals: { type: 'number' } }, required: ['token', 'to', 'amount', 'decimals'] }, schema: z.object({ token: addressSchema, to: addressSchema, amount: z.string().min(1), decimals: z.number().int().min(0).max(36) }).strict() },
  { name: 'get_tx_status', description: 'Get tx status by hash.', inputSchema: { type: 'object', properties: { txHash: { type: 'string' } }, required: ['txHash'] }, schema: z.object({ txHash: hexSchema.regex(/^0x[0-9a-fA-F]{64}$/, 'Invalid tx hash') }).strict() },
  { name: 'check_limits', description: 'Read ETH policy limits and remaining allowance.', inputSchema: { type: 'object', properties: {}, required: [] }, schema: z.object({}).strict() },
  { name: 'check_whitelist', description: 'Preflight target + selector policy checks.', inputSchema: { type: 'object', properties: { target: { type: 'string' }, selector: { type: 'string' }, recipient: { type: 'string' }, amount: { type: 'string' } }, required: ['target', 'selector'] }, schema: z.object({ target: addressSchema, selector: z.string().regex(/^0x[0-9a-fA-F]{8}$/), recipient: addressSchema.optional(), amount: z.string().regex(/^\d+$/).optional() }).strict() },
  { name: 'get_pending_actions', description: 'Read pending timelocked actions.', inputSchema: { type: 'object', properties: {}, required: [] }, schema: z.object({}).strict() },
  { name: 'get_transaction_history', description: 'Read recent Executed events.', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, fromBlock: { type: 'string' } }, required: [] }, schema: z.object({ limit: z.number().int().min(1).max(100).optional(), fromBlock: z.string().regex(/^\d+$/).optional() }).strict() }
] as const

const ERC20_ABI = [{ name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] }] as const

export class ETHAgent {
  private readonly config: AgentConfig
  private readonly account
  private readonly publicClient
  private readonly walletClient

  constructor(config: AgentConfig) {
    const chainId = config.chainId ?? 11155111
    if (chainId !== sepolia.id) {
      throw new Error(`Unsupported CHAIN_ID=${chainId}. This SDK currently supports Sepolia only (${sepolia.id}).`)
    }
    const normalizedPrivateKey = config.privateKey.startsWith('0x') ? config.privateKey : (`0x${config.privateKey}` as `0x${string}`)
    this.config = { ...config, privateKey: normalizedPrivateKey, chainId }
    this.account = privateKeyToAccount(normalizedPrivateKey)
    const transport = fallback([
      http(config.rpcUrl, { timeout: 15_000, retryCount: 2, retryDelay: 250 }),
      http('https://rpc.ankr.com/eth_sepolia', { timeout: 15_000, retryCount: 2, retryDelay: 250 }),
      http('https://sepolia.drpc.org', { timeout: 15_000, retryCount: 2, retryDelay: 250 }),
      http('https://ethereum-sepolia-rpc.publicnode.com', { timeout: 15_000, retryCount: 2, retryDelay: 250 })
    ])
    this.publicClient = createPublicClient({ chain: sepolia, transport })
    this.walletClient = createWalletClient({ account: this.account, chain: sepolia, transport })
  }

  async run(goal: string, onEvent?: (e: AgentEvent) => void): Promise<string> {
    try {
      onEvent?.({ type: 'thought', content: 'ETH Agent is thinking...' })
      const providers = this.buildProviders()
      const state = await this.getState()
      const system = this.buildSystemPrompt(state)

      if (this.shouldStayConversational(goal)) {
        const response = await this.requestWithFallback(providers, {
          messages: [{ role: 'system', content: system }, { role: 'user', content: goal }]
        })
        const text = response.choices[0]?.message?.content?.trim() || 'Done.'
        onEvent?.({ type: 'done', content: text })
        return text
      }

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: system },
        { role: 'user', content: goal }
      ]

      for (let i = 0; i < 8; i += 1) {
        const response = await this.requestWithFallback(providers, {
          messages,
          tools: this.getToolSchemas()
        })
        const choice = response.choices[0]
        const assistant = choice.message

        messages.push({ role: 'assistant', content: assistant.content, tool_calls: assistant.tool_calls })

        if (choice.finish_reason !== 'tool_calls' || !assistant.tool_calls?.length) {
          const text = assistant.content?.trim() || 'Done.'
          onEvent?.({ type: 'done', content: text })
          return text
        }

        for (const toolCall of assistant.tool_calls) {
          const name = toolCall.function.name as ToolName
          const args = this.safeParseJson(toolCall.function.arguments)
          onEvent?.({ type: 'tool_call', name, args })
          const result = await this.executeTool(name, args)
          onEvent?.({ type: 'tool_result', name, result })
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) })
        }
      }

      const exhausted = 'I reached the maximum tool-iteration limit. Please refine the request and try again.'
      onEvent?.({ type: 'done', content: exhausted })
      return exhausted
    } catch (error) {
      const msg = this.cleanError(error)
      onEvent?.({ type: 'error', message: msg })
      return msg
    }
  }

  async getState(): Promise<WalletState> {
    try {
      const [balance, agent, guardian, paused, txLimit, dailyLimit, dailySpent] = await Promise.all([
        this.publicClient.getBalance({ address: this.config.contractAddress }),
        this.publicClient.readContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'agent' }),
        this.publicClient.readContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'guardian' }),
        this.publicClient.readContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'paused' }),
        this.publicClient.readContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'ethTxLimit' }),
        this.publicClient.readContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'ethDailyLimit' }),
        this.publicClient.readContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'ethDailySpent' })
      ])
      const remaining = dailyLimit > dailySpent ? dailyLimit - dailySpent : 0n
      return {
        balance: formatEther(balance),
        ethTxLimit: formatEther(txLimit),
        ethDailyLimit: formatEther(dailyLimit),
        ethDailySpent: formatEther(dailySpent),
        remainingToday: formatEther(remaining),
        paused,
        agent,
        guardian,
        contractAddress: this.config.contractAddress,
        network: 'sepolia'
      }
    } catch (error) {
      throw new Error(`Failed to read wallet state: ${this.cleanError(error)}`)
    }
  }

  async preflight(to: string, valueEth: string): Promise<PreflightResult> {
    try {
      if (!isAddress(to)) {
        return { allowed: false, reason: 'Invalid recipient address', remainingDaily: '0', perTxLimit: '0' }
      }
      const valueWei = parseEther(valueEth)
      const [paused, txLimit, dailyLimit, dailySpent] = await Promise.all([
        this.publicClient.readContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'paused' }),
        this.publicClient.readContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'ethTxLimit' }),
        this.publicClient.readContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'ethDailyLimit' }),
        this.publicClient.readContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'ethDailySpent' })
      ])
      const remaining = dailyLimit > dailySpent ? dailyLimit - dailySpent : 0n
      if (paused) return { allowed: false, reason: 'Contract is paused', remainingDaily: formatEther(remaining), perTxLimit: formatEther(txLimit) }
      if (valueWei > txLimit) return { allowed: false, reason: 'Exceeds ETH tx limit', remainingDaily: formatEther(remaining), perTxLimit: formatEther(txLimit) }
      if (dailySpent + valueWei > dailyLimit) return { allowed: false, reason: 'ETH daily limit exceeded', remainingDaily: formatEther(remaining), perTxLimit: formatEther(txLimit) }
      return { allowed: true, remainingDaily: formatEther(remaining), perTxLimit: formatEther(txLimit) }
    } catch (error) {
      return { allowed: false, reason: this.cleanError(error), remainingDaily: '0', perTxLimit: '0' }
    }
  }

  async transferETH(to: string, amount: string): Promise<TransactionResult> {
    try {
      const preflight = await this.preflight(to, amount)
      if (!preflight.allowed) throw new Error(preflight.reason ?? 'Preflight failed')
      const valueWei = parseEther(amount)
      await this.publicClient.simulateContract({ account: this.account, address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'execute', args: [to as `0x${string}`, valueWei, '0x'] })
      const txHash = await this.walletClient.writeContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'execute', args: [to as `0x${string}`, valueWei, '0x'] })
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash })
      return { success: receipt.status === 'success', txHash, blockNumber: receipt.blockNumber.toString(), gasUsed: receipt.gasUsed.toString(), etherscanUrl: this.getExplorerTxUrl(txHash) }
    } catch (error) {
      return { success: false, txHash: '', blockNumber: '0', gasUsed: '0', etherscanUrl: `error:${this.cleanError(error)}` }
    }
  }

  async startMCPServer(): Promise<void> {
    await startMCP(this)
  }

  private async executeTool(name: string, args: Record<string, unknown>): Promise<RuntimeResult> {
    try {
      const toolName = name as ToolName
      const definition = runtimeTools.find((t) => t.name === toolName)
      if (!definition) return this.fail(toolName, 'UNKNOWN_TOOL', `Unknown tool: ${name}`)
      const parsed = definition.schema.safeParse(args)
      if (!parsed.success) return this.fail(toolName, 'INVALID_ARGUMENTS', 'Invalid tool arguments', parsed.error.flatten() as unknown as Record<string, unknown>)

      switch (toolName) {
        case 'get_wallet_state':
          return this.ok(toolName, await this.getStateAsTool())
        case 'transfer_eth': {
          const input = parsed.data as { to: string; amount: string }
          const tx = await this.transferETH(input.to, input.amount)
          if (!tx.success) return this.fail(toolName, 'TOOL_EXECUTION_ERROR', tx.etherscanUrl)
          return this.ok(toolName, tx as unknown as Record<string, unknown>)
        }
        case 'transfer_token':
          return await this.toolTransferToken(parsed.data as { token: string; to: string; amount: string; decimals: number })
        case 'get_tx_status':
          return await this.toolGetTxStatus(parsed.data as { txHash: string })
        case 'check_limits':
          return this.ok(toolName, await this.toolCheckLimits())
        case 'check_whitelist':
          return await this.toolCheckWhitelist(parsed.data as { target: string; selector: string; recipient?: string; amount?: string })
        case 'get_pending_actions':
          return this.ok(toolName, await this.toolGetPendingActions())
        case 'get_transaction_history':
          return await this.toolGetTransactionHistory(parsed.data as { limit?: number; fromBlock?: string })
      }
    } catch (error) {
      return this.fail(name as ToolName, 'TOOL_EXECUTION_ERROR', this.cleanError(error))
    }
  }

  private getToolSchemas() {
    return runtimeTools.map((tool) => ({ type: 'function' as const, function: { name: tool.name, description: tool.description, parameters: tool.inputSchema } }))
  }

  private buildSystemPrompt(state: WalletState): string {
    return [
      'You are ETH Agent, a calm and practical Ethereum operations copilot.',
      '',
      'Safety constraints are on-chain and must be respected.',
      '- If paused, no transfers should proceed.',
      '- ETH transfers must be within per-transaction and daily limits.',
      '- Target + selector must be whitelisted by policy.',
      '- Token transfers may have token-specific daily limits.',
      '',
      'Behavior rules:',
      '- For pure conversation (greetings/help/explanations), reply naturally and do not call tools.',
      '- For on-chain questions and actions, call tools.',
      '- Never reveal private keys or raw credentials.',
      '',
      `Live Wallet Context:`,
      `- AgentWallet: ${state.contractAddress}`,
      `- Agent role: ${state.agent}`,
      `- Guardian role: ${state.guardian}`,
      `- Status: ${state.paused ? 'PAUSED' : 'ACTIVE'}`,
      `- ETH balance: ${state.balance} ETH`,
      `- ETH per-tx limit: ${state.ethTxLimit} ETH`,
      `- ETH daily limit: ${state.ethDailyLimit} ETH`,
      `- ETH spent today: ${state.ethDailySpent} ETH`,
      `- ETH remaining today: ${state.remainingToday} ETH`
    ].join('\n')
  }

  private shouldStayConversational(input: string): boolean {
    const text = input.trim()
    return CONVERSATIONAL_ONLY.test(text) && !ACTION_HINTS.test(text)
  }

  private buildProviders(): ProviderConfig[] {
    const providers: ProviderConfig[] = []
    const groqKey = this.config.groqApiKey?.trim()
    const openRouterKey = this.config.openRouterApiKey?.trim()
    const googleKey = this.config.googleApiKey?.trim()

    if (groqKey) providers.push({ name: 'groq', client: new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' }), model: 'llama-3.3-70b-versatile' })
    if (openRouterKey) providers.push({ name: 'openrouter', client: new OpenAI({ apiKey: openRouterKey, baseURL: 'https://openrouter.ai/api/v1' }), model: 'openai/gpt-4o-mini' })
    if (googleKey) providers.push({ name: 'google', client: new OpenAI({ apiKey: googleKey, baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai' }), model: 'gemini-2.0-flash' })

    if (providers.length === 0) {
      throw new Error('No LLM provider configured. Set at least one of groqApiKey, openRouterApiKey, googleApiKey.')
    }
    return providers
  }

  private async requestWithFallback(providers: ProviderConfig[], payload: Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, 'model'>): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    let lastError: unknown = null
    for (const provider of providers) {
      try {
        const response = await provider.client.chat.completions.create({ ...payload, model: provider.model })
        if (provider.name !== 'groq') console.error(`[eth-agent-kit] fallback provider used: ${provider.name}`)
        return response
      } catch (error) {
        lastError = error
        console.error(`[eth-agent-kit] provider failed (${provider.name}): ${this.cleanError(error)}`)
      }
    }
    throw new Error(`All LLM providers failed. Last error: ${this.cleanError(lastError)}`)
  }

  private safeParseJson(input: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(input)
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    } catch {
      // noop
    }
    return {}
  }

  private cleanError(error: unknown): string {
    if (typeof error === 'string') return error
    if (error instanceof Error) return error.message
    if (typeof error === 'object' && error !== null) {
      const candidate = error as { shortMessage?: unknown; message?: unknown; details?: unknown }
      if (typeof candidate.shortMessage === 'string') return candidate.shortMessage
      if (typeof candidate.message === 'string') return candidate.message
      if (typeof candidate.details === 'string') return candidate.details
    }
    return String(error)
  }

  private serializeBigints<T>(value: T): T {
    if (typeof value === 'bigint') return value.toString() as T
    if (Array.isArray(value)) return value.map((item) => this.serializeBigints(item)) as T
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = this.serializeBigints(v)
      return out as T
    }
    return value
  }

  private ok(tool: ToolName, data: Record<string, unknown>): RuntimeResult {
    return { success: true, tool, data: this.serializeBigints(data) }
  }

  private fail(tool: ToolName, code: string, message: string, details?: Record<string, unknown>): RuntimeResult {
    return { success: false, tool, error: { code, message, details: details ? this.serializeBigints(details) : undefined } }
  }

  private selectorFromData(data: Hex): `0x${string}` {
    if (data === '0x' || data.length < 10) return ZERO_SELECTOR
    return `0x${data.slice(2, 10)}` as `0x${string}`
  }

  private async sendExecuteTx(target: `0x${string}`, valueWei: bigint, data: Hex) {
    const txHash = await this.walletClient.writeContract({
      address: this.config.contractAddress,
      abi: AGENT_WALLET_ABI,
      functionName: 'execute',
      args: [target, valueWei, data]
    })
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash })
    return { txHash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed, receiptStatus: receipt.status, etherscanUrl: this.getExplorerTxUrl(txHash) }
  }

  private async getStateAsTool() {
    const [balanceWei, agent, guardian, paused, ethTxLimit, ethDailyLimit, ethDailySpent, pendingLimitChange, pendingCall] =
      await Promise.all([
        this.publicClient.getBalance({ address: this.config.contractAddress }),
        this.publicClient.readContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'agent' }),
        this.publicClient.readContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'guardian' }),
        this.publicClient.readContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'paused' }),
        this.publicClient.readContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'ethTxLimit' }),
        this.publicClient.readContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'ethDailyLimit' }),
        this.publicClient.readContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'ethDailySpent' }),
        this.publicClient.readContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'pendingLimitChange' }),
        this.publicClient.readContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'pendingCall' })
      ])
    const remainingDailyWei = ethDailyLimit > ethDailySpent ? ethDailyLimit - ethDailySpent : 0n
    return {
      contractAddress: this.config.contractAddress,
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
      pendingLimitChange: { txLimitWei: pendingLimitChange[0], dailyLimitWei: pendingLimitChange[1], unlockTime: pendingLimitChange[2], queued: pendingLimitChange[3] },
      pendingCall: { target: pendingCall[0], selector: pendingCall[1], checkRecipient: pendingCall[2], checkAmount: pendingCall[3], maxAmount: pendingCall[4], unlockTime: pendingCall[5], queued: pendingCall[6] }
    }
  }

  private async runPreflight(params: { target: `0x${string}`; valueWei: bigint; data: Hex; recipient?: `0x${string}` }) {
    const state = await this.getStateAsTool()
    const selector = this.selectorFromData(params.data)
    const checks = {
      paused: !state.paused,
      underTxLimit: params.valueWei <= state.ethTxLimitWei,
      underDailyLimit: state.ethDailySpentWei + params.valueWei <= state.ethDailyLimitWei,
      simulatedExecutePass: false
    }
    const whitelist: { target: `0x${string}`; selector: `0x${string}`; bySimulation: boolean; recipient?: `0x${string}`; recipientAllowed?: boolean } = { target: params.target, selector, bySimulation: false }

    if (params.recipient) {
      try {
        const allowed = await this.publicClient.readContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'isRecipientAllowed', args: [params.target, selector, params.recipient] })
        whitelist.recipient = params.recipient
        whitelist.recipientAllowed = allowed
      } catch {
        // optional check
      }
    }

    const limits = { valueWei: params.valueWei, txLimitWei: state.ethTxLimitWei, dailyLimitWei: state.ethDailyLimitWei, dailySpentWei: state.ethDailySpentWei, remainingDailyWei: state.remainingDailyWei }

    if (!checks.paused) return { ok: false, reason: 'Contract is paused', checks, whitelist, limits }
    if (!checks.underTxLimit) return { ok: false, reason: 'Exceeds ETH tx limit', checks, whitelist, limits }
    if (!checks.underDailyLimit) return { ok: false, reason: 'ETH daily limit exceeded', checks, whitelist, limits }

    try {
      await this.publicClient.simulateContract({ account: this.account, address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'execute', args: [params.target, params.valueWei, params.data] })
      checks.simulatedExecutePass = true
      whitelist.bySimulation = true
      return { ok: true, checks, whitelist, limits }
    } catch (error) {
      return { ok: false, reason: `Whitelist/policy simulation failed: ${this.cleanError(error)}`, checks, whitelist, limits }
    }
  }

  private async toolTransferToken(input: { token: string; to: string; amount: string; decimals: number }): Promise<RuntimeResult> {
    if (!isAddress(input.token)) return this.fail('transfer_token', 'INVALID_TOKEN_ADDRESS', 'Invalid token address', { token: input.token })
    if (!isAddress(input.to)) return this.fail('transfer_token', 'INVALID_RECIPIENT', 'Invalid recipient address', { to: input.to })
    const amountRaw = parseUnits(input.amount, input.decimals)
    const data = encodeFunctionData({ abi: ERC20_ABI, functionName: 'transfer', args: [input.to as `0x${string}`, amountRaw] })

    const preflight = await this.runPreflight({ target: input.token as `0x${string}`, valueWei: 0n, data, recipient: input.to as `0x${string}` })
    if (!preflight.ok) return this.fail('transfer_token', 'PREFLIGHT_FAILED', preflight.reason ?? 'Preflight failed', { preflight: this.serializeBigints(preflight) as unknown as Record<string, unknown> })

    const tokenPolicy = await this.publicClient.readContract({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, functionName: 'tokenPolicy', args: [input.token as `0x${string}`] })
    const tx = await this.sendExecuteTx(input.token as `0x${string}`, 0n, data)

    return this.ok('transfer_token', { txHash: tx.txHash, blockNumber: tx.blockNumber, etherscanUrl: tx.etherscanUrl, receiptStatus: tx.receiptStatus, gasUsed: tx.gasUsed, token: input.token, to: input.to, amount: input.amount, decimals: input.decimals, amountRaw, tokenPolicy: { enabled: tokenPolicy[3], dailyLimit: tokenPolicy[0], dailySpent: tokenPolicy[1], remaining: tokenPolicy[0] > tokenPolicy[1] ? tokenPolicy[0] - tokenPolicy[1] : 0n, lastReset: tokenPolicy[2] } })
  }

  private async toolGetTxStatus(input: { txHash: string }): Promise<RuntimeResult> {
    const txHash = input.txHash as `0x${string}`
    try {
      const receipt = await this.publicClient.getTransactionReceipt({ hash: txHash })
      return this.ok('get_tx_status', { txHash, status: receipt.status, blockNumber: receipt.blockNumber, transactionIndex: receipt.transactionIndex, from: receipt.from, to: receipt.to, gasUsed: receipt.gasUsed, etherscanUrl: this.getExplorerTxUrl(txHash) })
    } catch (error) {
      const message = this.cleanError(error)
      if (/not found/i.test(message)) return this.ok('get_tx_status', { txHash, status: 'pending_or_not_found', etherscanUrl: this.getExplorerTxUrl(txHash) })
      throw error
    }
  }

  private async toolCheckLimits() {
    const state = await this.getStateAsTool()
    return {
      paused: state.paused,
      ethTxLimitWei: state.ethTxLimitWei,
      ethTxLimitEth: state.ethTxLimitEth,
      ethDailyLimitWei: state.ethDailyLimitWei,
      ethDailyLimitEth: state.ethDailyLimitEth,
      ethDailySpentWei: state.ethDailySpentWei,
      ethDailySpentEth: state.ethDailySpentEth,
      remainingDailyWei: state.remainingDailyWei,
      remainingDailyEth: state.remainingDailyEth
    }
  }

  private async toolCheckWhitelist(input: { target: string; selector: string; recipient?: string; amount?: string }): Promise<RuntimeResult> {
    if (!isAddress(input.target)) return this.fail('check_whitelist', 'INVALID_TARGET', 'Invalid target address', { target: input.target })
    if (!/^0x[0-9a-fA-F]{8}$/.test(input.selector)) return this.fail('check_whitelist', 'INVALID_SELECTOR', 'Selector must be 4-byte hex', { selector: input.selector })
    if (input.recipient && !isAddress(input.recipient)) return this.fail('check_whitelist', 'INVALID_RECIPIENT', 'Invalid recipient address', { recipient: input.recipient })

    const selector = input.selector.toLowerCase() as `0x${string}`
    const amountWei = input.amount ? BigInt(input.amount) : selector === ZERO_SELECTOR ? 1n : 0n
    let calldata: Hex = '0x'
    if (selector !== ZERO_SELECTOR) {
      if (selector === '0xa9059cbb' && input.recipient && input.amount) {
        calldata = encodeFunctionData({ abi: ERC20_ABI, functionName: 'transfer', args: [input.recipient as `0x${string}`, BigInt(input.amount)] })
      } else {
        calldata = `${selector}00000000` as Hex
      }
    }

    const preflight = await this.runPreflight({ target: input.target as `0x${string}`, valueWei: amountWei, data: calldata, recipient: input.recipient as `0x${string}` | undefined })
    return this.ok('check_whitelist', { allowed: preflight.ok, reason: preflight.reason, preflight: this.serializeBigints(preflight) as unknown as Record<string, unknown> })
  }

  private async toolGetPendingActions() {
    const state = await this.getStateAsTool()
    const now = Math.floor(Date.now() / 1000)
    const pendingCallSeconds = state.pendingCall.queued ? Math.max(Number(state.pendingCall.unlockTime) - now, 0) : 0
    const pendingLimitSeconds = state.pendingLimitChange.queued ? Math.max(Number(state.pendingLimitChange.unlockTime) - now, 0) : 0
    return {
      pendingCall: { ...state.pendingCall, secondsUntilUnlock: pendingCallSeconds },
      pendingLimitChange: { ...state.pendingLimitChange, secondsUntilUnlock: pendingLimitSeconds }
    }
  }

  private async toolGetTransactionHistory(input: { limit?: number; fromBlock?: string }): Promise<RuntimeResult> {
    const limit = input.limit ?? 20
    const fromBlock = input.fromBlock ? BigInt(input.fromBlock) : undefined
    const logs = await this.publicClient.getContractEvents({ address: this.config.contractAddress, abi: AGENT_WALLET_ABI, eventName: 'Executed', fromBlock })
    const history = logs.slice(Math.max(logs.length - limit, 0)).reverse().map((log) => ({ target: (log.args.target ?? '0x0000000000000000000000000000000000000000') as `0x${string}`, valueWei: log.args.value ?? 0n, valueEth: formatEther(log.args.value ?? 0n), selector: (log.args.selector ?? ZERO_SELECTOR) as `0x${string}`, blockNumber: log.blockNumber ?? 0n, txHash: log.transactionHash ?? '0x', etherscanUrl: log.transactionHash ? this.getExplorerTxUrl(log.transactionHash) : undefined }))
    return this.ok('get_transaction_history', { count: history.length, history })
  }

  private getExplorerTxUrl(txHash: `0x${string}`): string {
    return `https://sepolia.etherscan.io/tx/${txHash}`
  }
}
