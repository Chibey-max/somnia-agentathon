import { randomUUID } from "node:crypto"
import type { Response } from "express"
import { requireEnv } from "../env"
import type { SessionRecord } from "./types"

const sessionTtlMinutes = Number(process.env.MCP_SESSION_TTL_MINUTES ?? "60")
const maxConcurrentSessions = Number(process.env.MCP_MAX_CONCURRENT_SESSIONS ?? "10")

if (!Number.isFinite(sessionTtlMinutes) || sessionTtlMinutes <= 0) {
  throw new Error("MCP_SESSION_TTL_MINUTES must be a positive number")
}
if (!Number.isFinite(maxConcurrentSessions) || maxConcurrentSessions <= 0) {
  throw new Error("MCP_MAX_CONCURRENT_SESSIONS must be a positive number")
}

void requireEnv("MCP_SESSION_TTL_MINUTES")
void requireEnv("MCP_MAX_CONCURRENT_SESSIONS")

class SessionStore {
  private readonly sessions = new Map<string, SessionRecord>()

  create(sseResponse: Response, isGuardian: boolean, ttlMinutesOverride?: number): SessionRecord {
    this.evictExpired()
    if (this.sessions.size >= maxConcurrentSessions) {
      throw new Error("Maximum concurrent sessions reached")
    }

    const now = Date.now()
    const ttlMinutes = ttlMinutesOverride && ttlMinutesOverride > 0 ? ttlMinutesOverride : sessionTtlMinutes
    const ttlMs = ttlMinutes * 60_000
    const session: SessionRecord = {
      sessionId: randomUUID(),
      connectedAt: now,
      lastActivity: now,
      expiresAt: now + ttlMs,
      isGuardian,
      toolCallCount: 0,
      sseResponse,
      token: randomUUID()
    }
    this.sessions.set(session.sessionId, session)
    return session
  }

  get(sessionId: string): SessionRecord | undefined {
    const session = this.sessions.get(sessionId)
    if (!session) return undefined
    if (Date.now() > session.expiresAt) {
      this.delete(sessionId)
      return undefined
    }
    return session
  }

  touch(sessionId: string): void {
    const session = this.get(sessionId)
    if (!session) return
    session.lastActivity = Date.now()
    this.sessions.set(sessionId, session)
  }

  incrementCalls(sessionId: string): void {
    const session = this.get(sessionId)
    if (!session) return
    session.toolCallCount += 1
    session.lastActivity = Date.now()
    this.sessions.set(sessionId, session)
  }

  delete(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      try {
        session.sseResponse.end()
      } catch {
        // no-op
      }
    }
    this.sessions.delete(sessionId)
  }

  evictExpired(): void {
    const now = Date.now()
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.delete(sessionId)
      }
    }
  }

  count(): number {
    this.evictExpired()
    return this.sessions.size
  }

  closeAll(): void {
    for (const [sessionId] of this.sessions.entries()) {
      this.delete(sessionId)
    }
  }
}

export const sessionStore = new SessionStore()
