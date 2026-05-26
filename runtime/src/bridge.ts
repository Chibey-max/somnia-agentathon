import { runAgent as runAgentCore, type AgentEvent } from "./agent"

export interface AgentChunk {
  type: "text" | "status" | "tool" | "tool_result" | "tx" | "error" | "done"
  content?: string
  name?: string
  hash?: string
  args?: Record<string, unknown>
  result?: unknown
}

export async function runAgent(
  goal: string,
  onChunk: (chunk: AgentChunk) => void
): Promise<void> {
  try {
    await runAgentCore(goal, (event: AgentEvent) => {
      switch (event.type) {
        case "status":
          onChunk({ type: "status", content: event.content })
          break
        case "text":
          onChunk({ type: "text", content: event.content })
          break
        case "tool_call":
          onChunk({ type: "tool", name: event.name, args: event.args })
          break
        case "tool_result":
          onChunk({ type: "tool_result", name: event.name, result: event.result })
          break
        case "tx":
          onChunk({ type: "tx", hash: event.hash })
          break
        case "error":
          onChunk({ type: "error", content: event.message })
          break
        case "done":
          onChunk({ type: "done", content: event.content })
          break
      }
    })
  } catch (error) {
    const content = error instanceof Error ? error.message : String(error)
    onChunk({ type: "error", content })
    throw error
  }
}
