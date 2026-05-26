import { NextRequest } from 'next/server';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { goal } = await req.json();
    if (!goal || typeof goal !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing goal' }), { status: 400 });
    }

    // The runtime path from env, defaults to sibling directory
    const runtimePath = process.env.RUNTIME_PATH
      ? path.resolve(process.env.RUNTIME_PATH)
      : path.resolve(process.cwd(), '..', 'runtime');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendChunk = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Dynamically load the runtime module
          const runtimeEntry = path.join(runtimePath, 'dist', 'bridge.js');
          let runAgent: (goal: string, onChunk: (chunk: object) => void) => Promise<void>;

          try {
            // Import compiled runtime bridge output
            const runtime = await import(/* webpackIgnore: true */ runtimeEntry);
            runAgent = runtime.runAgent || runtime.default?.runAgent;
          } catch {
            // If runtime not available, return a helpful message
            sendChunk({
              type: 'text',
              content: `Agent runtime not found at ${runtimePath}. Please ensure the runtime is built and RUNTIME_PATH is configured correctly.`,
            });
            controller.close();
            return;
          }

          if (typeof runAgent !== 'function') {
            sendChunk({
              type: 'error',
              content: 'Runtime module does not export runAgent function',
            });
            controller.close();
            return;
          }

          await runAgent(goal, (chunk: object) => {
            sendChunk(chunk);
          });

          sendChunk({ type: 'done' });
        } catch (error) {
          sendChunk({ type: 'error', content: String(error) });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
}
