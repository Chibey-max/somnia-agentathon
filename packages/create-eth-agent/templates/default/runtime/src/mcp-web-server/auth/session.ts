import type { Request } from "express"
import { recoverMessageAddress } from "viem"
import { requireAddress } from "../../env"

export type AuthMode = "api-key" | "wallet-signature"

const guardianAddress = requireAddress("GUARDIAN_ADDRESS")

export function getAuthMode(): AuthMode {
  const mode = (process.env.MCP_AUTH_MODE ?? "api-key").trim().toLowerCase()
  if (mode === "wallet-signature") return "wallet-signature"
  return "api-key"
}

export function verifyApiKey(req: Request): boolean {
  const expected = process.env.MCP_API_KEY?.trim()
  const provided = req.header("X-Agent-Key")?.trim()
  return Boolean(expected && provided && expected === provided)
}

export async function verifyWalletSignature(req: Request): Promise<boolean> {
  const message = req.header("X-Agent-Message")?.trim()
  const signature = req.header("X-Agent-Signature")?.trim() as `0x${string}` | undefined
  if (!message || !signature) return false
  const recovered = await recoverMessageAddress({ message, signature })
  return recovered.toLowerCase() === guardianAddress.toLowerCase()
}

export async function authenticateRequest(req: Request): Promise<{ ok: boolean; isGuardian: boolean }> {
  const mode = getAuthMode()
  if (mode === "api-key") {
    return { ok: verifyApiKey(req), isGuardian: false }
  }
  const ok = await verifyWalletSignature(req)
  return { ok, isGuardian: ok }
}
