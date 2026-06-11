import { NextResponse } from 'next/server';
import { createPublicClient, defineChain, http, formatEther } from 'viem';
import { CONTRACT_ADDRESS, AGENT_WALLET_ABI, RPC_URLS } from '@/lib/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

const CACHE_TTL_MS = 10_000;
let cache: { data: unknown; expiresAt: number } | null = null;
let inflight: Promise<unknown> | null = null;

const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'Somnia Token', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } },
  blockExplorers: {
    default: { name: 'Somnia Explorer', url: 'https://shannon-explorer.somnia.network' },
  },
});

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function unavailableContractState(error: unknown) {
  return {
    address: CONTRACT_ADDRESS,
    balance: "0",
    balanceFormatted: "0",
    agent: "0x0000000000000000000000000000000000000000",
    guardian: "0x0000000000000000000000000000000000000000",
    pendingAgent: "0x0000000000000000000000000000000000000000",
    pendingGuardian: "0x0000000000000000000000000000000000000000",
    paused: false,
    ethTxLimit: "0",
    ethDailyLimit: "0",
    ethDailySpent: "0",
    ethTxLimitFormatted: "0",
    ethDailyLimitFormatted: "0",
    ethDailySpentFormatted: "0",
    dailySpentPercent: 0,
    pendingLimitChange: null,
    pendingCall: null,
    network: "Somnia Testnet",
    chainId: 50312,
    rpcUnavailable: true,
    error: errorMessage(error),
  };
}

async function readContractState() {
  const clients = RPC_URLS.map((url) =>
    createPublicClient({
      chain: somniaTestnet,
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

  const balance = await withFallback((client) => client.getBalance({ address: CONTRACT_ADDRESS }));
  const agent = await withFallback((client) => client.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "agent" }));
  const guardian = await withFallback((client) => client.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "guardian" }));
  const pendingAgent = await withFallback((client) => client.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "pendingAgent" }));
  const pendingGuardian = await withFallback((client) => client.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "pendingGuardian" }));
  const paused = await withFallback((client) => client.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "paused" }));
  const ethTxLimit = await withFallback((client) => client.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "ethTxLimit" }));
  const ethDailyLimit = await withFallback((client) => client.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "ethDailyLimit" }));
  const ethDailySpent = await withFallback((client) => client.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "ethDailySpent" }));
  const pendingLimitChangeRaw = await withFallback((client) => client.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "pendingLimitChange" }));
  const pendingCallRaw = await withFallback((client) => client.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: "pendingCall" }));

  const [plcTxLimit, plcDailyLimit, plcUnlockTime, plcQueued] = pendingLimitChangeRaw as [bigint, bigint, bigint, boolean];
  const [pcTarget, pcSelector, pcCheckRecipient, pcCheckAmount, pcMaxAmount, pcUnlockTime, pcQueued] = pendingCallRaw as [string, string, boolean, boolean, bigint, bigint, boolean];

  const bigintZero = BigInt(0);
  const percentScale = BigInt(10_000);

  const dailySpentPercent = ethDailyLimit > bigintZero
    ? Number((ethDailySpent * percentScale) / ethDailyLimit) / 100
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
    network: 'Somnia Testnet',
    chainId: 50312,
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
    console.error("[/api/contract]", errorMessage(error));
    if (cache) {
      return NextResponse.json({ ...(cache.data as Record<string, unknown>), stale: true, rpcUnavailable: true });
    }
    return NextResponse.json(unavailableContractState(error));
  } finally {
    inflight = null;
  }
}
