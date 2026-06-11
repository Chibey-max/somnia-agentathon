import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { executeToolCall } from "./executor"
import { runtimeTools, toolMap, type ToolName } from "./tools"

async function tryStartKitServer(): Promise<boolean> {
  try {
    // Optional local workspace integration with somnia-agent-kit
    const kit = await import("somnia-agent-kit")
    const contractAddress = process.env.AGENT_CONTRACT_ADDRESS as `0x${string}` | undefined
    const privateKey = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined
    const rpcUrl = process.env.RPC_URL ?? process.env.ALCHEMY_RPC_URL

    if (!contractAddress || !privateKey || !rpcUrl) {
      return false
    }

    // Support multiple possible exports from somnia-agent-kit (historical name changes).
    const kAny: any = kit;
    const AgentCtor = kAny.SomniaAgent ?? kAny.SomniaAgentKit ?? kAny.default?.SomniaAgent ?? kAny.default?.SomniaAgentKit;
    if (!AgentCtor) {
      console.error('[mcp-server] somnia-agent-kit found but no compatible export (SomniaAgent|SomniaAgentKit)');
      return false;
    }

    const agent = new AgentCtor({
      contractAddress,
      privateKey,
      rpcUrl,
      groqApiKey: process.env.GROQ_API_KEY,
      openRouterApiKey: process.env.OPENROUTER_API_KEY,
      googleApiKey: process.env.GOOGLE_API_KEY,
      chainId: process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : 50312,
      guardianAddress: process.env.GUARDIAN_ADDRESS
    })

    await agent.startMCPServer()
    return true
  } catch {
    return false
  }
}

function toJsonText(value: unknown): string {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function successResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: toJsonText(payload) }],
    structuredContent: { result: payload }
  }
}

function errorResult(message: string, details?: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: toJsonText({ success: false, error: message, details })
      }
    ],
    structuredContent: {
      success: false,
      error: message,
      details
    },
    isError: true
  }
}

const server = new Server(
  { name: "somnia-agent", version: "1.0.0" },
  {
    capabilities: {
      tools: {}
    }
  }
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: runtimeTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name as ToolName
  const rawArgs = request.params.arguments ?? {}

  try {
    const definition = toolMap.get(toolName)
    if (!definition) {
      return errorResult(`Unknown tool: ${toolName}`)
    }

    const parsed = definition.schema.safeParse(rawArgs)
    if (!parsed.success) {
      return errorResult("Invalid tool arguments", parsed.error.flatten())
    }

    const result = await executeToolCall(toolName, parsed.data)
    return successResult(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[mcp-server] tools/call failed for ${toolName}: ${message}`)
    return errorResult(message)
  }
})

let transport: StdioServerTransport | null = null

async function main() {
  try {
    transport = new StdioServerTransport()
    await server.connect(transport)
    console.error("[mcp-server] somnia-agent connected over stdio")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[mcp-server] startup error: ${message}`)
    process.exitCode = 1
  }
}

async function shutdown(signal: string) {
  console.error(`[mcp-server] received ${signal}, shutting down...`)
  try {
    await server.close()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[mcp-server] close error: ${message}`)
  }
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM")
})

process.on("SIGINT", () => {
  void shutdown("SIGINT")
})

void (async () => {
  const started = await tryStartKitServer()
  if (!started) {
    await main()
  }
})()
