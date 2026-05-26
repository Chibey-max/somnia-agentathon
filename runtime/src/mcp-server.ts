import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { executeToolCall } from "./executor"
import { runtimeTools, toolMap, type ToolName } from "./tools"

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
  { name: "eth-agent", version: "1.0.0" },
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
    console.error("[mcp-server] eth-agent connected over stdio")
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

void main()
