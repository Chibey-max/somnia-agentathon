# MCP Web Server (`runtime/src/mcp-web-server`)

HTTP + SSE MCP server for browser/web clients to control `AgentWallet` on Sepolia with contract-aware preflight guards.

## Start

From `runtime/`:

```bash
npm run mcp:web
```

Dev mode:

```bash
npm run mcp:web:dev
```

Server listens on `MCP_WEB_PORT` (example `3001`).

---

## Required env (in `contracts/.env`)

- `MCP_WEB_PORT=3001`
- `MCP_API_KEY=<secure-random-key>`
- `MCP_CORS_ORIGINS=http://localhost:3000,https://yourdomain.com`
- `MCP_SESSION_TTL_MINUTES=60`
- `MCP_MAX_CONCURRENT_SESSIONS=10`
- `MCP_AUTH_MODE=api-key` (or `wallet-signature`)

> `MCP_SERVER_URL` for dashboard usage is typically:
>
> `http://localhost:3001`

---

## Endpoints

- `GET /sse` — opens SSE stream and returns `session.created` event (JSON-RPC message payload)
- `POST /message` — send JSON-RPC-like MCP messages (`tools/list`, `tools/call`)
- `GET /health` — status, connected clients, contract/network
- `GET /tools` — discover tool definitions

### curl examples

```bash
curl http://localhost:3001/health
```

```bash
curl http://localhost:3001/tools
```

With API key auth:

```bash
curl -N -H "X-Agent-Key: <MCP_API_KEY>" http://localhost:3001/sse
```

---

## Dashboard connection

Your dashboard MCP client should target:

```env
MCP_SERVER_URL=http://localhost:3001
```

Then connect to `new URL(`${process.env.MCP_SERVER_URL}/sse`)` and send tool calls through `/message` with the returned `X-Session-Id` flow implemented in your route layer.

---

## Custom MCP client flow

1. Open SSE: `GET /sse` with auth headers.
2. Read `session.created` message and capture `sessionId`.
3. Send POST `/message` with:
   - `X-Session-Id: <sessionId>`
   - auth headers
   - body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "transfer_eth",
    "arguments": { "to": "0x...", "amount": "0.001" }
  }
}
```

4. Receive progress and final result on SSE `event: message` frames.

---

## Tooling

Exposed tools:

- `get_wallet_state`
- `check_preflight`
- `execute_call`
- `transfer_eth`
- `get_transaction_history`
- `get_token_policy`
- `check_whitelist`
- `get_pending_actions`

State-changing tools emit SSE progress updates for `preflight_check`, `signing_tx`, `broadcasting`, and `confirmed`.
