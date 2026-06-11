import { NextRequest } from 'next/server';
import {
  createPublicClient,
  createWalletClient,
  fallback,
  formatEther,
  http,
  isAddress,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { AGENT_WALLET_ABI, CONTRACT_ADDRESS, RPC_URLS } from '@/lib/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SOMNIA_CHAIN = {
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'Somnia Token', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } },
} as const;

const EXECUTE_ABI = [
  {
    name: 'execute',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [{ type: 'bytes' }],
  },
] as const;

const SYSTEM_PROMPT = `You are SomniaAgent, a precise autonomous AI operator for Somnia Testnet (chain ID 50312, native token STT).

Your job is to turn user goals into safe, observable on-chain actions through AgentWallet.sol.
You are not a generic chatbot. You inspect live wallet state first, reason about constraints, then either execute, preflight, or give the exact next safe action.

Operating model:
- AgentWallet has two roles: agent executes approved actions; guardian manages policy and emergency controls.
- Native currency is STT, not ETH.
- The contract enforces per-transaction limits, daily limits, selector-scoped whitelists, token policy, timelocked queues, pause/unpause, and ReentrancyGuard.
- Never claim an action succeeded unless a transaction hash or live chain read proves it.
- If execution is blocked by missing server key, policy, timelock, whitelist, or balance, say exactly what blocked it and what the user should do next.

Reasoning style:
- Start from live state: balance, paused flag, limits, remaining allowance, roles, pending queues.
- For transfer requests, parse recipient and STT amount, compare against tx/daily limits and vault balance, then preflight execution.
- For policy requests, identify the guardian action and whether it is immediate or timelocked.
- Be concise, technical, and useful under hackathon demo pressure.

Current deployed AgentWallet: ${CONTRACT_ADDRESS}`;

const publicClient = createPublicClient({
  chain: SOMNIA_CHAIN,
  transport: fallback(RPC_URLS.map((url) => http(url, { timeout: 15_000, retryCount: 1 }))),
});

function streamChunks(chunks: object[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

function normalizePrivateKey(value?: string) {
  if (!value) return undefined;
  return value.startsWith('0x') ? (value as `0x${string}`) : (`0x${value}` as `0x${string}`);
}

async function readWalletState() {
  const [
    balance,
    agent,
    guardian,
    paused,
    txLimit,
    dailyLimit,
    dailySpent,
    pendingLimitChange,
    pendingCall,
  ] = await Promise.all([
    publicClient.getBalance({ address: CONTRACT_ADDRESS }),
    publicClient.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: 'agent' }),
    publicClient.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: 'guardian' }),
    publicClient.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: 'paused' }),
    publicClient.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: 'ethTxLimit' }),
    publicClient.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: 'ethDailyLimit' }),
    publicClient.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: 'ethDailySpent' }),
    publicClient.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: 'pendingLimitChange' }),
    publicClient.readContract({ address: CONTRACT_ADDRESS, abi: AGENT_WALLET_ABI, functionName: 'pendingCall' }),
  ]);

  const remainingToday = dailyLimit > dailySpent ? dailyLimit - dailySpent : 0n;

  return {
    balance,
    balanceStt: formatEther(balance),
    agent,
    guardian,
    paused,
    txLimit,
    txLimitStt: formatEther(txLimit),
    dailyLimit,
    dailyLimitStt: formatEther(dailyLimit),
    dailySpent,
    dailySpentStt: formatEther(dailySpent),
    remainingToday,
    remainingTodayStt: formatEther(remainingToday),
    pendingLimitChange,
    pendingCall,
  };
}

function parseTransferGoal(goal: string) {
  const address = goal.match(/0x[a-fA-F0-9]{40}/)?.[0];
  const amount = goal.match(/(?:send|transfer)\s+([0-9]+(?:\.[0-9]+)?)\s*(?:stt|somnia)?/i)?.[1];
  if (!address || !amount || !isAddress(address)) return undefined;
  return { to: address as `0x${string}`, amount, value: parseEther(amount) };
}

async function answerWithoutLlm(goal: string) {
  const lower = goal.toLowerCase();
  const state = await readWalletState();
  const transfer = parseTransferGoal(goal);

  if (transfer) {
    const problems = [];
    if (state.paused) problems.push('the AgentWallet is paused');
    if (transfer.value > state.balance) problems.push(`vault balance is only ${state.balanceStt} STT`);
    if (transfer.value > state.txLimit) problems.push(`amount exceeds per-tx limit of ${state.txLimitStt} STT`);
    if (transfer.value > state.remainingToday) problems.push(`amount exceeds remaining daily allowance of ${state.remainingTodayStt} STT`);

    if (problems.length) {
      return {
        tool: 'preflight_transfer',
        text:
          `Preflight blocked for ${transfer.amount} STT to ${transfer.to}.\n\n` +
          `Blocked by: ${problems.join('; ')}.\n\n` +
          `Live state: balance ${state.balanceStt} STT, per-tx limit ${state.txLimitStt} STT, remaining today ${state.remainingTodayStt} STT, paused=${state.paused}.`,
      };
    }

    const privateKey = normalizePrivateKey(process.env.AGENT_PRIVATE_KEY);
    if (!privateKey) {
      return {
        tool: 'preflight_transfer',
        text:
          `Preflight passed for ${transfer.amount} STT to ${transfer.to}.\n\n` +
          `I checked the live AgentWallet: balance ${state.balanceStt} STT, per-tx limit ${state.txLimitStt} STT, remaining today ${state.remainingTodayStt} STT, paused=${state.paused}.\n\n` +
          `Execution is not broadcast from Vercel because AGENT_PRIVATE_KEY is not configured there. To execute autonomously, run the MCP/runtime with the agent key, or use Direct Wallet Mode for a connected-wallet transfer. If this transfer is through AgentWallet, guardian policy must also whitelist the recipient/selector before execution.`,
      };
    }

    const account = privateKeyToAccount(privateKey);
    const walletClient = createWalletClient({
      account,
      chain: SOMNIA_CHAIN,
      transport: fallback(RPC_URLS.map((url) => http(url, { timeout: 15_000, retryCount: 1 }))),
    });

    const { request } = await publicClient.simulateContract({
      account,
      address: CONTRACT_ADDRESS,
      abi: EXECUTE_ABI,
      functionName: 'execute',
      args: [transfer.to, transfer.value, '0x'],
    });
    const hash = await walletClient.writeContract(request);

    return {
      tool: 'transfer_stt',
      text:
        `Executed ${transfer.amount} STT from AgentWallet to ${transfer.to}.\n\n` +
        `Transaction: https://shannon-explorer.somnia.network/tx/${hash}`,
    };
  }

  if (/\b(balance|state|status|wallet|roles?)\b/i.test(goal)) {
    return {
      tool: 'get_wallet_state',
      text:
        `Live AgentWallet state on Somnia Testnet:\n\n` +
        `- Contract: ${CONTRACT_ADDRESS}\n` +
        `- Vault balance: ${state.balanceStt} STT\n` +
        `- Agent: ${state.agent}\n` +
        `- Guardian: ${state.guardian}\n` +
        `- Paused: ${state.paused}\n` +
        `- Per-tx limit: ${state.txLimitStt} STT\n` +
        `- Daily limit: ${state.dailyLimitStt} STT\n` +
        `- Spent today: ${state.dailySpentStt} STT\n` +
        `- Remaining today: ${state.remainingTodayStt} STT`,
    };
  }

  if (/\b(limits?|allowance|spend)\b/i.test(goal)) {
    return {
      tool: 'check_limits',
      text:
        `Current STT policy:\n\n` +
        `- Per transaction: ${state.txLimitStt} STT\n` +
        `- Daily allowance: ${state.dailyLimitStt} STT\n` +
        `- Used today: ${state.dailySpentStt} STT\n` +
        `- Remaining today: ${state.remainingTodayStt} STT`,
    };
  }

  if (/\b(pending|queue|timelock)\b/i.test(goal)) {
    const pendingLimit = state.pendingLimitChange as readonly [bigint, bigint, bigint, boolean];
    const pendingCall = state.pendingCall as readonly [`0x${string}`, `0x${string}`, boolean, boolean, bigint, bigint, boolean];
    return {
      tool: 'get_pending_actions',
      text:
        `Pending timelocked actions:\n\n` +
        `- Limit change queued: ${pendingLimit[3] ? `yes, unlock time ${pendingLimit[2].toString()}` : 'no'}\n` +
        `- Call policy queued: ${pendingCall[6] ? `yes, target ${pendingCall[0]}, selector ${pendingCall[1]}, unlock time ${pendingCall[5].toString()}` : 'no'}`,
    };
  }

  if (/\b(history|transactions?|events?)\b/i.test(goal)) {
    const latest = await publicClient.getBlockNumber();
    const fromBlock = latest > 900n ? latest - 900n : 0n;
    const logs = await publicClient.getLogs({ address: CONTRACT_ADDRESS, fromBlock, toBlock: latest });
    return {
      tool: 'get_transaction_history',
      text:
        `Recent AgentWallet activity:\n\n` +
        `- Checked blocks ${fromBlock.toString()} to ${latest.toString()} on Somnia Testnet.\n` +
        `- Found ${logs.length} contract event(s).\n` +
        (logs[0] ? `- Latest tx: https://shannon-explorer.somnia.network/tx/${logs[logs.length - 1].transactionHash}` : '- No recent events in this block window.'),
    };
  }

  if (/^(hi|hello|hey|help|what can you do)/i.test(lower)) {
    return {
      tool: 'capability_summary',
      text:
        `I am connected to the live Somnia AgentWallet and can perform real read/preflight tasks now.\n\n` +
        `Try:\n` +
        `- "show wallet state"\n` +
        `- "check my limits"\n` +
        `- "any pending timelocks?"\n` +
        `- "show recent history"\n` +
        `- "send 0.01 STT to 0x..." for a live preflight and execution path\n\n` +
        `Current vault balance: ${state.balanceStt} STT. Remaining today: ${state.remainingTodayStt} STT. Paused: ${state.paused}.`,
    };
  }

  return {
    tool: 'agent_planner',
    text:
      `I inspected the live AgentWallet before planning.\n\n` +
      `Current state: ${state.balanceStt} STT balance, ${state.remainingTodayStt} STT remaining today, paused=${state.paused}.\n\n` +
      `For this goal, I would break it into: identify target contract/recipient, check AgentWallet policy, simulate the call, then execute only if limits and whitelist pass. Ask for "wallet state", "limits", "pending actions", "history", or "send <amount> STT to <address>" for an immediate tool-backed action.`,
  };
}

async function requestGroq(goal: string, toolBackedAnswer: { tool: string; text: string }) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 900,
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\nLive tool context from ${toolBackedAnswer.tool}:\n${toolBackedAnswer.text}`,
        },
        { role: 'user', content: goal },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Groq request failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const json = await response.json();
  return json?.choices?.[0]?.message?.content?.trim() || toolBackedAnswer.text;
}

export async function POST(req: NextRequest) {
  try {
    const { goal } = await req.json();
    if (!goal || typeof goal !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing goal' }), { status: 400 });
    }

    const toolBackedAnswer = await answerWithoutLlm(goal);

    if (process.env.GROQ_API_KEY) {
      try {
        const text = await requestGroq(goal, toolBackedAnswer);
        return streamChunks([
          { type: 'tool', name: toolBackedAnswer.tool, args: { goal } },
          { type: 'text', content: text },
          { type: 'done', content: '' },
        ]);
      } catch (error) {
        return streamChunks([
          { type: 'tool', name: toolBackedAnswer.tool, args: { goal } },
          { type: 'error', content: String(error) },
          { type: 'text', content: toolBackedAnswer.text },
          { type: 'done', content: '' },
        ]);
      }
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return streamChunks([
        { type: 'tool', name: toolBackedAnswer.tool, args: { goal } },
        {
          type: 'text',
          content: toolBackedAnswer.text,
        },
        { type: 'done', content: '' },
      ]);
    }

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const closeStream = () => { if (!closed) { closed = true; controller.close(); } };
        const sendChunk = (data: object) => {
          if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          sendChunk({ type: 'text', content: `SomniaAgent processing: "${goal}"\n\n` });

          const response = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: `${SYSTEM_PROMPT}\n\nLive tool context from ${toolBackedAnswer.tool}:\n${toolBackedAnswer.text}`,
            messages: [{ role: 'user', content: goal }],
            stream: true,
          });

          for await (const event of response) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              sendChunk({ type: 'text', content: event.delta.text });
            }
          }

          sendChunk({ type: 'done', content: '' });
        } catch (error) {
          sendChunk({ type: 'error', content: String(error) });
        } finally {
          closeStream();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return streamChunks([{ type: 'error', content: String(error) }, { type: 'done', content: '' }]);
  }
}
