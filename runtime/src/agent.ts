import OpenAI from "openai"
import { formatEther } from "viem"
import { publicClient } from "./account"
import { requireAddress } from "./env"
import { executeToolCall } from "./executor"
import { agentTools, type ToolName } from "./tools"

const agentWalletAddress = requireAddress("AGENT_CONTRACT_ADDRESS")

type ProviderName = "groq" | "openrouter" | "google"

type ProviderConfig = {
  name: ProviderName
  client: OpenAI
  model: string
}

function buildProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = []

  const groqKey = process.env.GROQ_API_KEY?.trim()
  if (groqKey) {
    providers.push({
      name: "groq",
      client: new OpenAI({ apiKey: groqKey, baseURL: "https://api.groq.com/openai/v1" }),
      model: "llama-3.3-70b-versatile"
    })
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim()
  if (openRouterKey) {
    providers.push({
      name: "openrouter",
      client: new OpenAI({ apiKey: openRouterKey, baseURL: "https://openrouter.ai/api/v1" }),
      model: "openai/gpt-4o-mini"
    })
  }

  const googleKey = process.env.GOOGLE_API_KEY?.trim()
  if (googleKey) {
    providers.push({
      name: "google",
      client: new OpenAI({
        apiKey: googleKey,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai"
      }),
      model: "gemini-2.0-flash"
    })
  }

  if (providers.length === 0) {
    throw new Error("No LLM provider configured. Set GROQ_API_KEY (recommended).")
  }

  return providers
}

const SYSTEM_PROMPT = `You are ETH Agent, a calm and practical Ethereum operations copilot.

Your personality:
- Friendly, concise, and direct.
- Safety-first: never hide policy constraints.
- Explain what you can do now and what needs guardian changes.

Environment:
- Network: Ethereum Sepolia.
- Wallet execution path: AgentWallet.execute().
- Policies are enforced on-chain by the smart contract.

Hard constraints to respect:
- If paused, no transfers should proceed.
- ETH transfers must be within per-transaction and daily limits.
- Target + selector must be whitelisted by policy.
- Token transfers may have token-specific daily limits.

Behavior rules:
- For pure conversation (greetings/help/explanations), reply naturally and do not call tools.
- For on-chain questions and actions, call tools.
- When a tool fails policy checks, explain the failed rule in plain English.
- Never reveal private keys, secrets, or raw credentials.
- If user intent is risky or ambiguous, ask one short clarifying question.`

const CONTRACT_READ_ABI = [
  { name: "agent", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "guardian", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "ethTxLimit", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "ethDailyLimit", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "ethDailySpent", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }
] as const

const CONVERSATIONAL_ONLY = /^(hi|hello|hey|gm|gn|yo|sup|thanks|thank you|who are you|what can you do|help)\b/i
const ACTION_HINTS = /\b(send|transfer|swap|approve|execute|status|tx|hash|balance|limit|whitelist|pending|history|wallet)\b/i

function shouldStayConversational(input: string): boolean {
  const text = input.trim()
  return CONVERSATIONAL_ONLY.test(text) && !ACTION_HINTS.test(text)
}

function safeParseJson(input: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(input)
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>
    }
  } catch {
    // noop
  }
  return {}
}

async function getWalletContext(): Promise<string> {
  try {
    const [balance, agent, guardian, paused, ethTxLimit, ethDailyLimit, ethDailySpent] = await Promise.all([
      publicClient.getBalance({ address: agentWalletAddress }),
      publicClient.readContract({ address: agentWalletAddress, abi: CONTRACT_READ_ABI, functionName: "agent" }),
      publicClient.readContract({ address: agentWalletAddress, abi: CONTRACT_READ_ABI, functionName: "guardian" }),
      publicClient.readContract({ address: agentWalletAddress, abi: CONTRACT_READ_ABI, functionName: "paused" }),
      publicClient.readContract({ address: agentWalletAddress, abi: CONTRACT_READ_ABI, functionName: "ethTxLimit" }),
      publicClient.readContract({ address: agentWalletAddress, abi: CONTRACT_READ_ABI, functionName: "ethDailyLimit" }),
      publicClient.readContract({ address: agentWalletAddress, abi: CONTRACT_READ_ABI, functionName: "ethDailySpent" })
    ])

    const remaining = ethDailyLimit > ethDailySpent ? ethDailyLimit - ethDailySpent : 0n

    return [
      "Live Wallet Context:",
      `- AgentWallet: ${agentWalletAddress}`,
      `- Agent role: ${agent}`,
      `- Guardian role: ${guardian}`,
      `- Status: ${paused ? "PAUSED" : "ACTIVE"}`,
      `- ETH balance: ${formatEther(balance)} ETH`,
      `- ETH per-tx limit: ${formatEther(ethTxLimit)} ETH`,
      `- ETH daily limit: ${formatEther(ethDailyLimit)} ETH`,
      `- ETH spent today: ${formatEther(ethDailySpent)} ETH`,
      `- ETH remaining today: ${formatEther(remaining)} ETH`
    ].join("\n")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return [
      "Live Wallet Context:",
      `- AgentWallet: ${agentWalletAddress}`,
      `- Wallet state currently unavailable (${message})`
    ].join("\n")
  }
}

async function requestWithFallback(
  providers: ProviderConfig[],
  payload: Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, "model">
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  let lastError: unknown = null

  for (const provider of providers) {
    try {
      const response = await provider.client.chat.completions.create({
        ...payload,
        model: provider.model
      })
      if (provider.name !== "groq") {
        console.error(`[agent] fallback provider used: ${provider.name}`)
      }
      return response
    } catch (error) {
      lastError = error
      console.error(
        `[agent] provider failed (${provider.name}): ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`All LLM providers failed. Last error: ${message}`)
}

export type AgentEvent =
  | { type: "status"; content: string }
  | { type: "text"; content: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: unknown }
  | { type: "tx"; hash: string }
  | { type: "error"; message: string }
  | { type: "done"; content?: string }

export async function runAgent(goal: string, emit?: (event: AgentEvent) => void): Promise<void> {
  emit?.({ type: "status", content: "ETH Agent is thinking..." })

  try {
    const providers = buildProviders()
    const walletContext = await getWalletContext()

    if (shouldStayConversational(goal)) {
      const response = await requestWithFallback(providers, {
        messages: [
          { role: "system", content: `${SYSTEM_PROMPT}\n\n${walletContext}` },
          { role: "user", content: goal }
        ]
      })

      const text =
        response.choices[0]?.message?.content?.trim() ||
        "Hey — I can help with wallet state, limits, transfers, and tx status on Sepolia."

      emit?.({ type: "text", content: text })
      emit?.({ type: "done", content: text })
      return
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\n${walletContext}` },
      { role: "user", content: goal }
    ]

    for (let i = 0; i < 8; i += 1) {
      const response = await requestWithFallback(providers, {
        messages,
        tools: agentTools
      })

      const choice = response.choices[0]
      const assistantMessage = choice.message

      messages.push({
        role: "assistant",
        content: assistantMessage.content,
        tool_calls: assistantMessage.tool_calls
      })

      if (choice.finish_reason !== "tool_calls" || !assistantMessage.tool_calls?.length) {
        const text = assistantMessage.content?.trim() || "Done."
        emit?.({ type: "text", content: text })
        emit?.({ type: "done", content: text })
        return
      }

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name as ToolName
        const args = safeParseJson(toolCall.function.arguments)

        emit?.({ type: "tool_call", name: toolName, args })

        const result = await executeToolCall(toolName, args)
        emit?.({ type: "tool_result", name: toolName, result })

        const dataValue =
          result && typeof result === "object" && "data" in result
            ? (result as { data?: unknown }).data
            : undefined

        const maybeTxHash =
          dataValue && typeof dataValue === "object" && "txHash" in dataValue && typeof (dataValue as { txHash?: unknown }).txHash === "string"
            ? (dataValue as { txHash: string }).txHash
            : undefined

        if (maybeTxHash) {
          emit?.({ type: "tx", hash: maybeTxHash })
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        })
      }
    }

    const fallback = "I reached the maximum tool-iteration limit. Please refine the request and try again."
    emit?.({ type: "text", content: fallback })
    emit?.({ type: "done", content: fallback })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    emit?.({ type: "error", message })
    emit?.({ type: "done", content: message })
  }
}
