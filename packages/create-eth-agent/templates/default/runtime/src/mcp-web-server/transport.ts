import type { Response } from "express"

export function setupSseHeaders(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache, no-transform")
  res.setHeader("Connection", "keep-alive")
  res.flushHeaders()
}

export function sendSseEvent(res: Response, event: string, data: unknown): void {
  const payload = typeof data === "string" ? data : JSON.stringify(data)
  res.write(`event: ${event}\n`)
  res.write(`data: ${payload}\n\n`)
}

export function sendMcpMessage(res: Response, payload: unknown): void {
  sendSseEvent(res, "message", payload)
}
