// Contract state types
export interface ContractState {
  address: string;
  balance: bigint;
  balanceFormatted: string;
  agent: string;
  guardian: string;
  paused: boolean;
  ethTxLimit: bigint;
  ethDailyLimit: bigint;
  ethDailySpent: bigint;
  ethTxLimitFormatted: string;
  ethDailyLimitFormatted: string;
  ethDailySpentFormatted: string;
  dailySpentPercent: number;
  pendingLimitChange: PendingLimitChange | null;
  pendingCall: PendingCallState | null;
  network: string;
  chainId: number;
}

export interface PendingLimitChange {
  txLimit: bigint;
  dailyLimit: bigint;
  unlockTime: bigint;
  queued: boolean;
  txLimitFormatted: string;
  dailyLimitFormatted: string;
  unlockTimeMs: number;
}

export interface PendingCallState {
  target: string;
  selector: string;
  checkRecipient: boolean;
  checkAmount: boolean;
  maxAmount: bigint;
  unlockTime: bigint;
  queued: boolean;
  unlockTimeMs: number;
}

export interface TokenPolicy {
  token: string;
  dailyLimit: bigint;
  dailySpent: bigint;
  lastReset: bigint;
  enabled: boolean;
  dailyLimitFormatted: string;
  dailySpentFormatted: string;
  spentPercent: number;
}

// Event types
export interface ExecutedEvent {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  target: string;
  value: string;
  selector: string;
  logIndex: number;
}

// Agent chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string;
  toolResult?: string;
  txHash?: string;
  timestamp: number;
}

// Guardian action types
export type GuardianAction =
  | { type: 'pause' }
  | { type: 'unpause' }
  | { type: 'withdraw'; to: string; amount: string }
  | { type: 'transferAgent'; newAgent: string }
  | { type: 'transferGuardian'; newGuardian: string }
  | { type: 'queueCall'; target: string; selector: string; checkRecipient: boolean; checkAmount: boolean; maxAmount: string }
  | { type: 'cancelCallQueue' }
  | { type: 'applyCall' }
  | { type: 'removeCall'; target: string; selector: string }
  | { type: 'queueLimitChange'; txLimit: string; dailyLimit: string }
  | { type: 'applyLimitChange' }
  | { type: 'cancelLimitChange' }
  | { type: 'setTokenPolicy'; token: string; dailyLimit: string }
  | { type: 'revokeTokenPolicy'; token: string };
