import { NextResponse } from 'next/server';
import { createPublicClient, http, formatEther } from 'viem';
import { sepolia } from 'viem/chains';
import { CONTRACT_ADDRESS, AGENT_WALLET_ABI, RPC_URLS } from '@/lib/contract';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CACHE_TTL_MS = 10_000;
let cache: { data: unknown; expiresAt: number } | null = null;
let inflight: Promise<unknown> | null = null;

async function readContractState() {
  const clients = RPC_URLS.map((url) =>
    createPublicClient({
      chain: sepolia,
      transport: http(url, { timeout: 8_000, retryCount: 0 }),
    })
  );

  const withFallback = async <T,>(fn: (client: (typeof clients)[number]) => Promise<T>): Promise<T> => {
    let lastError: unknown;
    for (const client of clients) {
      try {
        return await fn(client);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error('All RPC providers failed');
  };

  const [
    balance,
    agent,
    guardian,
    pendingAgent,
    pendingGuardian,
    paused,
    ethTxLimit,
    ethDailyLimit,
    ethDailySpent,
    pendingLimitChangeRaw,
    pendingCallRaw,
  ] = await Promise.all([
    withFallback((client) => client.getBalance({ address: CONTRACT_ADDRESS })),
    withFallback((client) => client.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: 'agent' })),
    withFallback((client) => client.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: 'guardian' })),
    withFallback((client) => client.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: 'pendingAgent' })),
    withFallback((client) => client.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: 'pendingGuardian' })),
    withFallback((client) => client.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: 'paused' })),
    withFallback((client) => client.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: 'ethTxLimit' })),
    withFallback((client) => client.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: 'ethDailyLimit' })),
    withFallback((client) => client.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: 'ethDailySpent' })),
    withFallback((client) => client.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: 'pendingLimitChange' })),
    withFallback((client) => client.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: 'pendingCall' })),
  ]);

  const [plcTxLimit, plcDailyLimit, plcUnlockTime, plcQueued] = pendingLimitChangeRaw as [bigint, bigint, bigint, boolean];
  const [pcTarget, pcSelector, pcCheckRecipient, pcCheckAmount, pcMaxAmount, pcUnlockTime, pcQueued] = pendingCallRaw as [string, string, boolean, boolean, bigint, bigint, boolean];

  const dailySpentPercent = ethDailyLimit > 0n
    ? Number((ethDailySpent * 10000n) / ethDailyLimit) / 100
    : 0;

  return {
    address: CONTRACT_ADDRESS,
    balance: balance.toString(),
    balanceFormatted: formatEther(balance),
    agent,
    guardian,
    pendingAgent,
    pendingGuardian,
    paused,
    ethTxLimit: ethTxLimit.toString(),
    ethDailyLimit: ethDailyLimit.toString(),
    ethDailySpent: ethDailySpent.toString(),
    ethTxLimitFormatted: formatEther(ethTxLimit as bigint),
    ethDailyLimitFormatted: formatEther(ethDailyLimit as bigint),
    ethDailySpentFormatted: formatEther(ethDailySpent as bigint),
    dailySpentPercent,
    pendingLimitChange: plcQueued ? {
      txLimit: plcTxLimit.toString(),
      dailyLimit: plcDailyLimit.toString(),
      unlockTime: plcUnlockTime.toString(),
      queued: true,
      txLimitFormatted: formatEther(plcTxLimit),
      dailyLimitFormatted: formatEther(plcDailyLimit),
      unlockTimeMs: Number(plcUnlockTime) * 1000,
    } : null,
    pendingCall: pcQueued ? {
      target: pcTarget,
      selector: pcSelector,
      checkRecipient: pcCheckRecipient,
      checkAmount: pcCheckAmount,
      maxAmount: pcMaxAmount.toString(),
      unlockTime: pcUnlockTime.toString(),
      queued: true,
      unlockTimeMs: Number(pcUnlockTime) * 1000,
    } : null,
    network: 'Sepolia',
    chainId: 11155111,
  };
}

export async function GET() {
  try {
    const now = Date.now();
    if (cache && cache.expiresAt > now) {
      return NextResponse.json(cache.data);
    }

    if (inflight) {
      const data = await inflight;
      return NextResponse.json(data);
    }

    inflight = readContractState();
    const data = await inflight;
    cache = { data, expiresAt: now + CACHE_TTL_MS };

    return NextResponse.json(data);
  } catch (error) {
    console.error('[/api/contract]', error);
    return NextResponse.json(
      { error: 'Failed to read contract state', details: String(error) },
      { status: 500 }
    );
  } finally {
    inflight = null;
  }
}
