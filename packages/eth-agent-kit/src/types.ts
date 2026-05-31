export type AgentConfig = {
  contractAddress: `0x${string}`
  privateKey: `0x${string}`
  rpcUrl: string
  groqApiKey?: string
  openRouterApiKey?: string
  googleApiKey?: string
  chainId?: number
  guardianAddress?: string
}

export type AgentEvent =
  | { type: 'thought'; content: string }
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; result: unknown }
  | { type: 'done'; content: string }
  | { type: 'error'; message: string }

export type WalletState = {
  balance: string
  ethTxLimit: string
  ethDailyLimit: string
  ethDailySpent: string
  remainingToday: string
  paused: boolean
  agent: string
  guardian: string
  contractAddress: string
  network: string
}

export type TransactionResult = {
  success: boolean
  txHash: string
  blockNumber: string
  gasUsed: string
  etherscanUrl: string
}

export type PreflightResult = {
  allowed: boolean
  reason?: string
  remainingDaily: string
  perTxLimit: string
}
