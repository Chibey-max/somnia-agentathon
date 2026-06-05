# ETH Agent

> Autonomous Ethereum AI agent framework for EVM chains.
> Like Starknet Agent Kit, but for Ethereum.
> Connect your AI assistant to an on-chain wallet with
> enforced spending limits, whitelisting, and guardian controls.

## How it works

```text
User prompt → MCP Server → AgentWallet.sol → Sepolia
                              ↑
                    enforces: spending limits
                              whitelist
                              pause/unpause
                              daily limits
```

## Quickstart

### Option A — npx (fastest)
```bash
npx create-eth-agent@latest my-agent
cd my-agent
cp .env.example .env
# fill in .env
npm run build
npm run setup
# restart your IDE
```

### Option B — Clone the full repo
```bash
git clone https://github.com/Chibey-max/Ethereum-Agentic.git
cd Ethereum-Agentic/runtime
cp .env.example .env
npm install
npm run build
npm run setup
```

### Option C — npm install (build on top)
```ts
npm install eth-agent-kit

import { ETHAgent } from 'eth-agent-kit'
const agent = new ETHAgent({ ...config })
await agent.run('Send 0.01 ETH to 0x...')
```

## MCP Config (manual)

Add to your IDE config:

Claude Desktop: ~/.config/claude/claude_desktop_config.json
Cursor:         ~/.cursor/mcp.json
Kiro:           ~/.kiro/settings/mcp.json

```json
{
  "mcpServers": {
    "eth-agent": {
      "command": "node",
      "args": ["/full/path/to/runtime/dist/mcp-server.js"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| get_wallet_state | Balance, limits, paused status, roles |
| transfer_eth | Send ETH to whitelisted address |
| transfer_token | Send ERC-20 within token policy |
| check_limits | Remaining daily ETH allowance |
| get_tx_status | Look up transaction by hash |
| check_whitelist | Check if address+action is allowed |
| get_pending_actions | Queued calls with countdown timers |
| get_transaction_history | Recent on-chain activity |

## Smart Contract

AgentWallet enforces all agent actions on-chain:
- Per-transaction ETH spending limit
- Daily ETH spending limit
- Whitelisted target addresses and function selectors
- Token-specific daily limits
- Guardian pause/unpause kill switch
- 10-minute timelock on limit increases
- 2-step role transfers

Deploy your own: see contracts/README.md

## T3N Verifiable Identity Layer

ETH Agent integrates with Terminal 3 Network for
cryptographically verifiable agent identity.

Every agent session:
- Opens an encrypted TEE (Trusted Execution Environment)
  session via T3N SDK
- Receives a `did:t3n` decentralized identifier linked to
  the AgentWallet address
- Logs every action to an immutable audit trail on the
  T3N ledger
- Compatible with A2A, ERC-8004, and MCP protocols

**Setup:**
Get your free API key at https://terminal3.io/claim-page

Add to your `.env`:
```
T3N_API_KEY=your_key_here
```

On agent startup you will see:
```
✅ T3N Identity active
   Address : 0x...
   Credits : 20000
```

If `T3N_API_KEY` is not set the agent runs normally
without the identity layer.

## Platform Integrations

- **MCP** — Cursor, VS Code, Kiro, Claude Desktop, Zed
- **Anna Platform** — Executa plugin via `anna-executa/`
- **Terminal 3 Network** — TEE-backed verifiable identity

### Anna Executa Plugin
Run ETH Agent as an Anna platform plugin:
```bash
node anna-executa/index.js
```
Test:
```bash
echo '{"jsonrpc":"2.0","method":"describe","id":1}' | node anna-executa/index.js
```

## Roadmap
- [ ] Multi-chain support (Base, Arbitrum, Optimism)
- [ ] Role-based agent teams (treasury, HR, ops)
- [ ] Visual policy builder — no-code limit configuration
- [ ] Telegram/Slack bot interface
- [ ] Audit trail export for compliance
- [ ] Anna App Store listing

## Project Structure

```text
eth-agent/
  contracts/            AgentWallet.sol + deploy scripts
  runtime/              MCP server + AI agent loop
  dashboard/            Next.js web UI
  packages/
    eth-agent-kit/      npm install eth-agent-kit
    create-eth-agent/   npx create-eth-agent
```

## Package & Monorepo Overview

This repository is an npm workspace monorepo with publishable packages:

- `eth-agent-kit` — SDK for building Ethereum AI agents programmatically
- `create-eth-agent` — scaffolding CLI used by `npx create-eth-agent`

Published packages:

- `eth-agent-kit` on npm
- `create-eth-agent@0.1.4` on npm (includes TS config compatibility fix)

## Troubleshooting

### `npm run build` fails in a scaffolded project with `node_modules/ox/...` TypeScript errors

Symptoms include errors like:

- `Property 'replaceAll' does not exist on type 'string'`
- `Cannot find name 'window'`
- `AuthenticatorAttestationResponse` / `AuthenticationExtensionsClientOutputs` missing

Cause: an older scaffold template TypeScript config (`target/lib` too old for current `viem`/`ox` types).

Fix:

1. Scaffold with latest CLI:

```bash
npx create-eth-agent@latest my-agent
```

2. Or patch `tsconfig.json` in existing generated projects:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"]
  }
}
```

Then re-run:

```bash
npm run build
```

## Requirements

- Node.js 18+
- Sepolia testnet ETH (https://sepoliafaucet.com)
- Deployed AgentWallet contract
- At least one AI provider key required:
  - Groq (recommended, free): console.groq.com
  - OpenRouter (free models): openrouter.ai
  - Google Gemini (free tier): aistudio.google.com
