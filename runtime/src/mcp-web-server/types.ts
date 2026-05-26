import type { Response } from "express"
import type { Hex } from "viem"

export type Address = `0x${string}`

export interface PendingCall {
  target: Address
  selector: Hex
  checkRecipient: boolean
  checkAmount: boolean
  maxAmount: bigint
  unlockTime: bigint
  queued: boolean
}

export interface PendingLimitChange {
  txLimit: bigint
  dailyLimit: bigint
  unlockTime: bigint
  queued: boolean
}

export interface WalletState {
  contractAddress: Address
  chainId: number
  balanceWei: bigint
  agent: Address
  guardian: Address
  paused: boolean
  ethTxLimit: bigint
  ethDailyLimit: bigint
  ethDailySpent: bigint
  pendingLimitChange: PendingLimitChange
  pendingCall: PendingCall
}

export interface WhitelistPolicyResult {
  allowed: boolean
  checkRecipient: boolean
  checkAmount: boolean
  maxAmount: bigint
}

export interface PreflightInput {
  target: Address
  value: bigint
  calldata: Hex
}

export interface PreflightResult {
  allowed: boolean
  reason?: string
  rule?: string
  remainingDaily: bigint
  selector: Hex
}

export interface SessionRecord {
  sessionId: string
  connectedAt: number
  lastActivity: number
  expiresAt: number
  isGuardian: boolean
  toolCallCount: number
  sseResponse: Response
  token?: string
}

export interface MpcProgressEvent {
  type: "progress"
  step: string
  status: "running" | "passed" | "failed" | "done"
  txHash?: string
  message?: string
}

export interface SerializedExecutedEvent {
  target: Address
  value: string
  selector: Hex
  blockNumber: string
  transactionHash: Hex
}
