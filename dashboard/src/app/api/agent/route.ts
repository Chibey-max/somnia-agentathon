import { NextRequest } from 'next/server';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
        let closed = false;

        const closeStream = () => {
          if (!closed) {
            closed = true;
            controller.close();
          }
        };

        const sendChunk = (data: object) => {
          if (!closed) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          }
        };

        try {
          const runtimeEntry = path.join(runtimePath, 'dist', 'dashboard-agent.js');

          if (!fs.existsSync(runtimeEntry)) {
            sendChunk({
              type: 'text',
              content: `Agent runtime dashboard bridge not found at ${runtimeEntry}. Run: cd ${runtimePath} && npm run build`,
            });
            closeStream();
            return;
          }

          const runtimeEnvPath = path.join(runtimePath, '.env');
          const runtimeEnvExamplePath = path.join(runtimePath, '.env.example');
          const requiredRuntimeEnv = ['RPC_URL', 'AGENT_CONTRACT_ADDRESS', 'AGENT_PRIVATE_KEY'];
          const missingRuntimeEnv = requiredRuntimeEnv.filter((key) => !process.env[key]?.trim());

          if (missingRuntimeEnv.length > 0 && !fs.existsSync(runtimeEnvPath)) {
            sendChunk({
              type: 'error',
              content: `Runtime config missing: ${runtimeEnvPath}. Create it from ${runtimeEnvExamplePath} and set ${missingRuntimeEnv.join(', ')}.`,
            });
            closeStream();
            return;
          }

          await new Promise<void>((resolve) => {
            const child = spawn(process.execPath, [runtimeEntry, goal], {
              cwd: runtimePath,
              env: process.env,
              stdio: ['ignore', 'pipe', 'pipe'],
            });

            let stdoutBuffer = '';
            let stderrBuffer = '';

            child.stdout.on('data', (data) => {
              stdoutBuffer += data.toString();
              const lines = stdoutBuffer.split('\n');
              stdoutBuffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                  sendChunk(JSON.parse(trimmed));
                } catch {
                  sendChunk({ type: 'text', content: trimmed });
                }
              }
            });

            child.stderr.on('data', (data) => {
              stderrBuffer += data.toString();
            });

            child.on('error', (error) => {
              sendChunk({ type: 'error', content: `Failed to start runtime process: ${error.message}` });
              resolve();
            });

            child.on('close', (code) => {
              const trailing = stdoutBuffer.trim();
              if (trailing) {
                try {
                  sendChunk(JSON.parse(trailing));
                } catch {
                  sendChunk({ type: 'text', content: trailing });
                }
              }

              if (code && code !== 0) {
                const stderr = stderrBuffer.trim();
                sendChunk({
                  type: 'error',
                  content: stderr || `Runtime process exited with code ${code}`,
                });
              }

              resolve();
            });
          });
        } catch (error) {
          sendChunk({ type: 'error', content: String(error) });
        } finally {
          closeStream();
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
