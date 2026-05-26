import express from "express"
import cors from "cors"
import { requireAddress, requireEnv } from "../env"
import { setupSseHeaders, sendMcpMessage } from "./transport"
import { sessionStore } from "./session"
import { authenticateRequest, getAuthMode } from "./auth/session"
import { toolDefinitions, toolMap } from "./tools"
import { registerDefaultPolicies } from "./guard/policy"

const app = express()
app.use(express.json({ limit: "1mb" }))

const port = Number(process.env.MCP_WEB_PORT ?? "3001")
const contractAddress = requireAddress("AGENT_CONTRACT_ADDRESS")
const corsOrigins = (process.env.MCP_CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean)

void requireEnv("MCP_WEB_PORT")
void requireEnv("MCP_API_KEY")
void requireEnv("MCP_CORS_ORIGINS")
void requireEnv("MCP_SESSION_TTL_MINUTES")
void requireEnv("MCP_MAX_CONCURRENT_SESSIONS")

registerDefaultPolicies()

app.use(cors({ origin: corsOrigins.length > 0 ? corsOrigins : false }))

app.get("/sse", async (req, res) => {
  try {
    const auth = await authenticateRequest(req)
    if (!auth.ok) {
      res.status(401).json({ error: "Unauthorized" })
      return
    }

    setupSseHeaders(res)
    const authMode = getAuthMode()
    const session = sessionStore.create(res, auth.isGuardian, authMode === "wallet-signature" ? 15 : undefined)

    sendMcpMessage(res, {
      jsonrpc: "2.0",
      method: "session.created",
      params: {
        sessionId: session.sessionId,
        connectedAt: session.connectedAt,
        expiresAt: session.expiresAt,
        isGuardian: session.isGuardian,
        sessionToken: session.token
      }
    })

    req.on("close", () => {
      sessionStore.delete(session.sessionId)
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: message })
  }
})

app.post("/message", async (req, res) => {
  try {
    const auth = await authenticateRequest(req)
    if (!auth.ok) {
      res.status(401).json({ error: "Unauthorized" })
      return
    }

    const sessionId = req.header("X-Session-Id")?.trim()
    if (!sessionId) {
      res.status(400).json({ error: "Missing X-Session-Id" })
      return
    }

    const session = sessionStore.get(sessionId)
    if (!session) {
      res.status(404).json({ error: "Session not found or expired" })
      return
    }
    const authMode = getAuthMode()
    if (authMode === "wallet-signature") {
      const token = req.header("X-Session-Token")?.trim()
      if (!token || token !== session.token) {
        res.status(401).json({ error: "Invalid session token" })
        return
      }
    }

    sessionStore.touch(sessionId)

    const body = req.body as { id?: string | number; method?: string; params?: any }
    const id = body.id ?? null

    if (body.method === "tools/list") {
      sendMcpMessage(session.sseResponse, {
        jsonrpc: "2.0",
        id,
        result: {
          tools: toolDefinitions.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }))
        }
      })
      res.json({ accepted: true })
      return
    }

    if (body.method !== "tools/call") {
      sendMcpMessage(session.sseResponse, { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } })
      res.json({ accepted: true })
      return
    }

    const toolName = body.params?.name as string | undefined
    const args = body.params?.arguments ?? {}
    if (!toolName) {
      sendMcpMessage(session.sseResponse, { jsonrpc: "2.0", id, error: { code: -32602, message: "Missing tool name" } })
      res.json({ accepted: true })
      return
    }

    const tool = toolMap.get(toolName)
    if (!tool) {
      sendMcpMessage(session.sseResponse, { jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown tool: ${toolName}` } })
      res.json({ accepted: true })
      return
    }

    const parsed = tool.schema.safeParse(args)
    if (!parsed.success) {
      sendMcpMessage(session.sseResponse, {
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: parsed.error.flatten() }
      })
      res.json({ accepted: true })
      return
    }

    sessionStore.incrementCalls(sessionId)

    const emitProgress = (event: unknown) => {
      sendMcpMessage(session.sseResponse, { jsonrpc: "2.0", id, result: event })
    }

    const result = await tool.run(parsed.data, emitProgress)
    sendMcpMessage(session.sseResponse, { jsonrpc: "2.0", id, result })
    res.json({ accepted: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: message })
  }
})

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    connectedClients: sessionStore.count(),
    contractAddress,
    network: { name: "sepolia", chainId: 11155111 }
  })
})

app.get("/tools", (_req, res) => {
  res.json({ tools: toolDefinitions.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) })
})

const server = app.listen(port, () => {
  console.error(`MCP web server listening on :${port}`)
})

function gracefulShutdown(signal: string): void {
  console.error(`Received ${signal}, shutting down MCP web server...`)
  sessionStore.closeAll()
  server.close(() => {
    process.exit(0)
  })
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
process.on("SIGINT", () => gracefulShutdown("SIGINT"))
