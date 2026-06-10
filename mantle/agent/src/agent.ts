import OpenAI from "openai";
import { config } from "./env";
import { tools } from "./tools";
import { executeTool } from "./executor";

// ─── LLM Client Factory ────────────────────────────────────────────────────────

function createLLMClient(): { client: OpenAI; model: string; provider: string } | null {
  if (config.GROQ_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: config.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
      }),
      model: "llama3-70b-8192",
      provider: "Groq",
    };
  }

  if (config.OPENROUTER_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: config.OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": "https://mantle-agent.xyz",
          "X-Title": "Mantle Agent Kit",
        },
      }),
      model: "anthropic/claude-3.5-sonnet",
      provider: "OpenRouter",
    };
  }

  if (config.GOOGLE_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: config.GOOGLE_API_KEY,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      }),
      model: "gemini-2.0-flash",
      provider: "Google Gemini",
    };
  }

  return null;
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an autonomous AI agent wallet running on the Mantle network (Chain ID: 5000).

## Your Identity
- You operate an on-chain agent wallet (MantleAgentWallet smart contract) on Mantle
- You have an ERC-8004 identity NFT that records your decisions on-chain for transparency
- Your decisions are policy-enforced: spending limits, whitelists, guardian controls

## Your Capabilities
- Transfer MNT (native Mantle token) and ERC20 tokens (mETH, USDY)
- Execute AI-driven trading strategies via TradingVault
- Monitor positions with real-time risk management (daily loss limits)
- Stake mETH for yield via Mantle LSP
- Swap on Mantle DEXes (Agni Finance, Merchant Moe)
- Record every significant decision on-chain via your identity NFT

## Mantle Network Context
- MNT: Native token for gas and transfers
- mETH: Mantle Liquid Staking Token (~4.5% APY) — address: 0xcDA86A272531e8640cD7F1a92c01839911B90bb0
- USDY: Yield-bearing stablecoin — address: 0x5bE26527e817998A7206475496fDE1E68957c5A9
- Gas is very cheap on Mantle (L2 optimistic rollup)
- Block time: ~2 seconds

## Decision Principles
1. SAFETY FIRST: Never exceed spending limits. Check whitelist before transfers.
2. TRANSPARENCY: Record important decisions on-chain using record_action.
3. RISK MANAGEMENT: Never put more than 10% of balance in a single trade.
4. EFFICIENCY: Mantle has low gas — batch operations when possible.
5. YIELD: Idle funds can be staked as mETH for passive yield.

## Response Format
- Be concise and action-oriented
- When executing transactions, always confirm the outcome
- Report balances in human-readable format (MNT, not wei)
- Flag any risk concerns clearly`;

// ─── Tool Formatter ────────────────────────────────────────────────────────────

function formatToolsForLLM(): OpenAI.Chat.ChatCompletionTool[] {
  return Object.values(tools).map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: {},
        // We pass minimal schema — the LLM infers from description
      },
    },
  }));
}

// ─── Agent Loop ────────────────────────────────────────────────────────────────

export interface AgentMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  toolCallId?: string;
}

export async function runAgent(
  userPrompt: string,
  conversationHistory: AgentMessage[] = []
): Promise<string> {
  const llm = createLLMClient();
  if (!llm) {
    return "Error: No LLM API key configured. Set GROQ_API_KEY, OPENROUTER_API_KEY, or GOOGLE_API_KEY in .env";
  }

  console.log(`[agent] Using ${llm.provider} (${llm.model})`);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory.map((m) => {
      if (m.role === "tool") {
        return {
          role: "tool" as const,
          content: m.content,
          tool_call_id: m.toolCallId || "unknown",
        };
      }
      return { role: m.role, content: m.content };
    }),
    { role: "user", content: userPrompt },
  ];

  const mcpTools = Object.values(tools).map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object" as const,
        properties: buildPropertiesFromZod(tool),
        additionalProperties: false,
      },
    },
  }));

  let iterations = 0;
  const MAX_ITERATIONS = 10;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    console.log(`[agent] Iteration ${iterations}/${MAX_ITERATIONS}`);

    const response = await llm.client.chat.completions.create({
      model: llm.model,
      messages,
      tools: mcpTools,
      tool_choice: "auto",
      temperature: 0.1,
    });

    const choice = response.choices[0];

    if (!choice) {
      return "Error: No response from LLM";
    }

    const assistantMessage = choice.message;
    messages.push(assistantMessage);

    // No tool calls — we have a final answer
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return assistantMessage.content || "Agent completed without response.";
    }

    // Execute tool calls
    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name;
      let toolArgs: Record<string, unknown> = {};

      try {
        toolArgs = JSON.parse(toolCall.function.arguments || "{}");
      } catch {
        toolArgs = {};
      }

      console.log(`[agent] Executing tool: ${toolName}`, toolArgs);

      const result = await executeTool(toolName, toolArgs);
      const resultStr = JSON.stringify(result, null, 2);

      console.log(`[agent] Tool result: ${resultStr.slice(0, 200)}...`);

      messages.push({
        role: "tool",
        content: resultStr,
        tool_call_id: toolCall.id,
      });
    }
  }

  return "Agent reached maximum iterations without completing.";
}

// Build JSON schema properties from tool definitions
function buildPropertiesFromZod(
  tool: (typeof tools)[keyof typeof tools]
): Record<string, unknown> {
  const schema = tool.inputSchema;
  const shape = (schema as Record<string, unknown>)._def as Record<string, unknown>;

  if (!shape) return {};

  // For simple schemas, return empty properties (LLM uses description)
  return {};
}

// ─── Interactive REPL ─────────────────────────────────────────────────────────

export async function startInteractiveAgent(): Promise<void> {
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const history: AgentMessage[] = [];
  console.log("\n[Mantle AI Agent] Ready. Type your command (or 'exit' to quit):\n");

  const askQuestion = (prompt: string): Promise<string> => {
    return new Promise((resolve) => rl.question(prompt, resolve));
  };

  while (true) {
    const userInput = await askQuestion("You: ");
    if (userInput.toLowerCase() === "exit" || userInput.toLowerCase() === "quit") {
      console.log("[agent] Goodbye!");
      rl.close();
      break;
    }

    if (!userInput.trim()) continue;

    history.push({ role: "user", content: userInput });

    try {
      const response = await runAgent(userInput, history.slice(-20)); // Keep last 20 messages
      console.log(`\nAgent: ${response}\n`);
      history.push({ role: "assistant", content: response });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[agent] Error: ${msg}\n`);
    }
  }
}
