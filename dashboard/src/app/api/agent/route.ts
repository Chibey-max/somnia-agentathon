import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are SomniaAgent, an autonomous AI agent running on the Somnia blockchain (chain ID: 50312, native token: STT).

You operate through an AgentWallet smart contract (a hardened two-role guardian/agent model with ReentrancyGuard, token policy engine, selector-scoped whitelisting, and timelocked queues).

Your capabilities:
- Execute on-chain transactions within your policy limits (spending limits, whitelisted addresses)
- Query contract state (balances, roles, pending operations)
- Manage token policies and whitelist entries (subject to guardian approval and timelock)
- Simulate transactions before execution
- Monitor pending timelocked operations

Your constraints:
- You cannot exceed per-tx or daily spending limits set by the guardian
- All policy changes go through a 10-minute timelock queue
- Only whitelisted contract selectors can be called
- ReentrancyGuard protects all state-changing operations

When a user gives you a goal, reason through what on-chain actions are needed, explain what you would do step by step, and describe the outcome. Be concise and technical. Use STT as the currency unit.

Current network: Somnia Testnet
Contract: ${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 'not configured'}`;

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

export async function POST(req: NextRequest) {
  try {
    const { goal } = await req.json();
    if (!goal || typeof goal !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing goal' }), { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return streamChunks([
        {
          type: 'text',
          content:
            `SomniaAgent online. I received: "${goal}"\n\n` +
            'The dashboard is connected to Somnia Testnet and the deployed AgentWallet. ' +
            'For autonomous LLM responses, configure ANTHROPIC_API_KEY in Vercel or run the MCP runtime locally. ' +
            'I can still show wallet state, policy limits, transaction history, and guardian controls from the live contract.',
        },
        { type: 'done', content: '' },
      ]);
    }

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
            system: SYSTEM_PROMPT,
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
