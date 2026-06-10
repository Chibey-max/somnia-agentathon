import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, defineChain, http, parseAbiItem } from 'viem';
import { CONTRACT_ADDRESS, RPC_URLS } from '@/lib/contract';

export const dynamic = 'force-dynamic';

const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'Somnia Token', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } },
  blockExplorers: {
    default: { name: 'Somnia Explorer', url: 'https://shannon-explorer.somnia.network' },
  },
});

const EXECUTED_EVENT = parseAbiItem(
  'event Executed(address indexed target, uint256 value, bytes4 selector)'
);
const CALL_QUEUED_EVENT = parseAbiItem(
  'event CallQueued(address indexed target, bytes4 selector, uint256 unlockTime)'
);
const CALL_APPLIED_EVENT = parseAbiItem(
  'event CallApplied(address indexed target, bytes4 selector)'
);
const WITHDRAWN_EVENT = parseAbiItem(
  'event Withdrawn(address indexed to, uint256 amount)'
);
const PAUSED_EVENT = parseAbiItem('event Paused(address indexed by)');
const UNPAUSED_EVENT = parseAbiItem('event Unpaused(address indexed by)');

const EVENT_SPECS = [
  { name: 'Executed', event: EXECUTED_EVENT },
  { name: 'CallQueued', event: CALL_QUEUED_EVENT },
  { name: 'CallApplied', event: CALL_APPLIED_EVENT },
  { name: 'Withdrawn', event: WITHDRAWN_EVENT },
  { name: 'Paused', event: PAUSED_EVENT },
  { name: 'Unpaused', event: UNPAUSED_EVENT },
] as const;

const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const QUICKNODE_MIN_RANGE = BigInt(5);
const DEFAULT_LOG_RANGE = BigInt(2_000);
const LOOKBACK_BLOCKS = BigInt(50_400);
const MAX_CHUNKS_PER_REQUEST = 80; // hard bound to keep latency predictable
const MAX_EVENT_CACHE = 500;

type CachedLog = {
  transactionHash: `0x${string}`;
  blockNumber?: bigint;
  logIndex: number;
  eventName: (typeof EVENT_SPECS)[number]['name'];
  args?: Record<string, unknown>;
};

type ProviderState = {
  client: ReturnType<typeof createPublicClient>;
  maxLogRange: bigint;
  url: string;
};

let scanCursor: bigint | null = null;
let cachedEvents: CachedLog[] = [];
let cachedEventIds = new Set<string>();
let cacheHeadBlock: bigint | null = null;

function eventId(log: Pick<CachedLog, 'transactionHash' | 'logIndex'>) {
  return `${log.transactionHash}-${log.logIndex}`;
}

function parseRangeLimitFromError(error: unknown): bigint | null {
  const msg = String(error);
  const match = msg.match(/limited to a\s+(\d+)\s+range/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return BigInt(parsed);
}

function isTimeoutError(error: unknown): boolean {
  const msg = String(error).toLowerCase();
  return msg.includes('timed out') || msg.includes('timeout');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(parseInt(searchParams.get('limit') || '50', 10), 200));
    const fromBlockParam = searchParams.get('fromBlock');

    const providerStates: ProviderState[] = RPC_URLS.map((url) => ({
      client: createPublicClient({
        chain: somniaTestnet,
        transport: http(url, { timeout: 5_000, retryCount: 0 }),
      }),
      // QuickNode discover plans can enforce very small eth_getLogs ranges.
      maxLogRange: url.includes('quiknode.pro') ? QUICKNODE_MIN_RANGE : DEFAULT_LOG_RANGE,
      url,
    }));

    const withFallback = async <T,>(fn: (client: (typeof providerStates)[number]['client']) => Promise<T>): Promise<T> => {
      let lastError: unknown;
      for (const provider of providerStates) {
        try {
          return await fn(provider.client);
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError ?? new Error('All RPC providers failed');
    };

    const latestBlock = await withFallback((client) => client.getBlockNumber());
    const startBlock = fromBlockParam
      ? BigInt(fromBlockParam)
      : latestBlock > LOOKBACK_BLOCKS
        ? latestBlock - LOOKBACK_BLOCKS
        : BIGINT_ZERO;

    const previousHead = cacheHeadBlock;

    // Initialize scan state once, then only extend it as new blocks arrive.
    if (cacheHeadBlock === null) {
      cacheHeadBlock = latestBlock;
      scanCursor = latestBlock;
    } else if (latestBlock > cacheHeadBlock) {
      cacheHeadBlock = latestBlock;
      scanCursor = latestBlock;
    }

    // If we already scanned up to a previous head, only scan newly mined blocks.
    const scanStartBlock =
      previousHead !== null && latestBlock > previousHead
        ? previousHead + BIGINT_ONE > startBlock
          ? previousHead + BIGINT_ONE
          : startBlock
        : startBlock;

    if (scanCursor === null || scanCursor < scanStartBlock) {
      scanCursor = latestBlock;
    }

    let chunksScanned = 0;
    while (scanCursor >= scanStartBlock && chunksScanned < MAX_CHUNKS_PER_REQUEST) {
      const cursor: bigint = scanCursor;
      let chunkLogs: CachedLog[] | null = null;
      let lastError: unknown;
      let usedChunkFrom: bigint | null = null;

      for (const provider of providerStates) {
        const span = provider.maxLogRange > BIGINT_ZERO ? provider.maxLogRange : BIGINT_ONE;
        const from: bigint = cursor >= span - BIGINT_ONE ? cursor - (span - BIGINT_ONE) : BIGINT_ZERO;
        const fromBlockChunk: bigint = from > scanStartBlock ? from : scanStartBlock;

        try {
          const logsByEvent = await Promise.all(
            EVENT_SPECS.map(({ name, event }) =>
              provider.client
                .getLogs({
                  address: CONTRACT_ADDRESS,
                  event,
                  fromBlock: fromBlockChunk,
                  toBlock: cursor,
                })
                .then((logs) => ({ name, logs }))
            )
          );

          chunkLogs = logsByEvent
            .flatMap(({ name, logs }) =>
              logs
                .filter((log) => log.transactionHash && log.blockNumber !== null && log.logIndex !== null)
                .map((log) => ({
                  transactionHash: log.transactionHash as `0x${string}`,
                  blockNumber: log.blockNumber ?? undefined,
                  logIndex: log.logIndex as number,
                  eventName: name,
                  args: (log.args ?? {}) as Record<string, unknown>,
                }))
            );
          usedChunkFrom = fromBlockChunk;
          break;
        } catch (error) {
          const limitedRange = parseRangeLimitFromError(error);
          if (limitedRange && limitedRange < provider.maxLogRange) {
            provider.maxLogRange = limitedRange;
          }

          // On repeated provider limits/timeouts, skip this provider for future chunks.
          if (limitedRange === QUICKNODE_MIN_RANGE || isTimeoutError(error)) {
            provider.maxLogRange = BIGINT_ZERO;
          }

          lastError = error;
        }
      }

      if (!chunkLogs || usedChunkFrom === null) {
        // Don't fail the whole request: return cached/partial data instead.
        break;
      }

      for (const log of chunkLogs) {
        const id = eventId(log);
        if (cachedEventIds.has(id)) continue;
        cachedEventIds.add(id);
        cachedEvents.push(log);
      }

      chunksScanned += 1;

      if (usedChunkFrom === scanStartBlock) {
        scanCursor = scanStartBlock - BIGINT_ONE;
        break;
      }

      scanCursor = usedChunkFrom - BIGINT_ONE;
    }

    // Keep cache bounded and sorted newest-first by block/log index.
    cachedEvents.sort((a, b) => {
      const ab = a.blockNumber ?? BIGINT_ZERO;
      const bb = b.blockNumber ?? BIGINT_ZERO;
      if (ab === bb) return b.logIndex - a.logIndex;
      return ab > bb ? -1 : 1;
    });

    if (cachedEvents.length > MAX_EVENT_CACHE) {
      const kept = cachedEvents.slice(0, MAX_EVENT_CACHE);
      cachedEvents = kept;
      cachedEventIds = new Set(kept.map((l) => eventId(l)));
    }

    const recentLogs = cachedEvents.slice(0, limit);
    const blockNumbers = [...new Set(recentLogs.map((l) => l.blockNumber).filter((bn): bn is bigint => typeof bn === 'bigint'))];

    const blocks = await Promise.all(
      blockNumbers.map((bn) => withFallback((client) => client.getBlock({ blockNumber: bn })))
    );
    const blockTimestamps = new Map(blocks.map((b) => [b.number.toString(), Number(b.timestamp)]));

    const events = recentLogs.map((log) => {
      const args = (log.args || {}) as Record<string, unknown>;
      const bn = log.blockNumber ?? BIGINT_ZERO;

      let target = '0x0000000000000000000000000000000000000000';
      let value = '0';
      let selector = '0x00000000';

      if (log.eventName === 'Executed') {
        target = (args.target as string) || target;
        value = (args.value as bigint | undefined)?.toString() || '0';
        selector = (args.selector as string) || selector;
      } else if (log.eventName === 'CallQueued' || log.eventName === 'CallApplied') {
        target = (args.target as string) || target;
        selector = (args.selector as string) || selector;
      } else if (log.eventName === 'Withdrawn') {
        target = (args.to as string) || target;
        value = (args.amount as bigint | undefined)?.toString() || '0';
      } else if (log.eventName === 'Paused' || log.eventName === 'Unpaused') {
        target = (args.by as string) || target;
      }

      return {
        txHash: log.transactionHash,
        blockNumber: Number(bn),
        timestamp: blockTimestamps.get(bn.toString()) || 0,
        target,
        value,
        selector,
        action: log.eventName,
        logIndex: log.logIndex,
      };
    });

    const scanComplete = scanCursor !== null && scanCursor < scanStartBlock;

    return NextResponse.json({
      events,
      latestBlock: latestBlock.toString(),
      partial: !scanComplete,
      chunksScanned,
      scanCursor: scanCursor?.toString() ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[/api/events]", message);
    return NextResponse.json({
      events: [],
      latestBlock: cacheHeadBlock?.toString() ?? null,
      partial: true,
      chunksScanned: 0,
      scanCursor: scanCursor?.toString() ?? null,
      rpcUnavailable: true,
      error: message,
    });
  }
}
