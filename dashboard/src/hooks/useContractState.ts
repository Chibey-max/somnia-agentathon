'use client';

import { useQuery } from '@tanstack/react-query';

export interface ContractStateData {
  address: string;
  balance: string;
  balanceFormatted: string;
  agent: string;
  guardian: string;
  pendingAgent: string;
  pendingGuardian: string;
  paused: boolean;
  ethTxLimit: string;
  ethDailyLimit: string;
  ethDailySpent: string;
  ethTxLimitFormatted: string;
  ethDailyLimitFormatted: string;
  ethDailySpentFormatted: string;
  dailySpentPercent: number;
  pendingLimitChange: {
    txLimit: string;
    dailyLimit: string;
    unlockTime: string;
    queued: boolean;
    txLimitFormatted: string;
    dailyLimitFormatted: string;
    unlockTimeMs: number;
  } | null;
  pendingCall: {
    target: string;
    selector: string;
    checkRecipient: boolean;
    checkAmount: boolean;
    maxAmount: string;
    unlockTime: string;
    queued: boolean;
    unlockTimeMs: number;
  } | null;
  network: string;
  chainId: number;
}

const BASE_INTERVAL_MS = 60_000;
const MAX_BACKOFF_MS = 5 * 60_000;

let dynamicIntervalMs = BASE_INTERVAL_MS;

async function fetchContractState(): Promise<ContractStateData> {
  const res = await window.fetch('/api/contract', { cache: 'no-store' });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return res.json();
}

export function useContractState(interval = BASE_INTERVAL_MS) {
  const query = useQuery<ContractStateData, Error>({
    queryKey: ['contract-state'],
    queryFn: fetchContractState,
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status === 429) return failureCount < 2;
      return failureCount < 1;
    },
    retryDelay: (attempt, error) => {
      const status = (error as Error & { status?: number }).status;
      if (status === 429) {
        return Math.min(5_000 * 2 ** attempt, 30_000);
      }
      return 2_000;
    },
    refetchInterval: (q) => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return false;
      }

      const status = (q.state.error as (Error & { status?: number }) | null)?.status;
      if (status === 429) {
        dynamicIntervalMs = Math.min(dynamicIntervalMs * 2, MAX_BACKOFF_MS);
      } else {
        dynamicIntervalMs = Math.max(interval, BASE_INTERVAL_MS);
      }

      return dynamicIntervalMs;
    },
    refetchOnWindowFocus: false,
  });

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? query.error.message : null,
    refetch: async () => {
      dynamicIntervalMs = Math.max(interval, BASE_INTERVAL_MS);
      await query.refetch();
    },
    lastUpdated: query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null,
  };
}
