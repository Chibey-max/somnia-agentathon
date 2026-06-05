export type PolicyViolationCode =
  | "CONTRACT_PAUSED"
  | "INSUFFICIENT_BALANCE"
  | "PER_TX_LIMIT_EXCEEDED"
  | "DAILY_LIMIT_EXCEEDED"

export type PolicyViolation = {
  code: PolicyViolationCode
  message: string
  details?: Record<string, string>
}

export type PolicyDecision = {
  allow: boolean
  violations: PolicyViolation[]
  context?: Record<string, string>
}
