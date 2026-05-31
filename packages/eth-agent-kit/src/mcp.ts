import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { ETHAgent } from './ETHAgent'

function toJsonText(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function successResult(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: toJsonText(payload) }],
    structuredContent: { result: payload }
  }
}

function errorResult(message: string, details?: unknown) {
  return {
    content: [{ type: 'text' as const, text: toJsonText({ success: false, error: message, details }) }],
    structuredContent: { success: false, error: message, details },
    isError: true
  }
}

export async function startMCPServer(agent: ETHAgent): Promise<void> {
  const server = new Server({ name: 'eth-agent-kit', version: '0.1.0' }, { capabilities: { tools: {} } })

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: ((agent as unknown as { getToolSchemas: () => Array<{ function: { name: string; description: string; parameters: Record<string, unknown> } }> }).getToolSchemas()).map((t) => ({
      name: t.function.name,
      description: t.function.description,
      inputSchema: t.function.parameters
    }))
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name
    const rawArgs = (request.params.arguments ?? {}) as Record<string, unknown>

    try {
      const result = await (agent as unknown as { executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown> }).executeTool(toolName, rawArgs)
      return successResult(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[mcp-server] tools/call failed for ${toolName}: ${message}`)
      return errorResult(message)
    }
  })

  let transport: StdioServerTransport | null = null

  async function shutdown(signal: string) {
    console.error(`[mcp-server] received ${signal}, shutting down...`)
    try {
      await server.close()
      transport = null
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[mcp-server] close error: ${message}`)
    }
  }

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM')
  })
  process.on('SIGINT', () => {
    void shutdown('SIGINT')
  })

  try {
    transport = new StdioServerTransport()
    await server.connect(transport)
    console.error('[mcp-server] eth-agent connected over stdio')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[mcp-server] startup error: ${message}`)
    process.exitCode = 1
  }
}
