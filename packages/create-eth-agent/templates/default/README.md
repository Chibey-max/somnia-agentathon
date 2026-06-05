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

## T3N Identity Layer

ETH Agent integrates with Terminal 3 Network for verifiable agent identity:

- Each agent session opens an encrypted TEE session via T3N SDK
- The AgentWallet address is registered as a `did:t3n` decentralized identifier  
- Every agent action is backed by a cryptographic audit trail on the T3N ledger
- Compatible with A2A, ERC-8004, and MCP protocols

**Setup:** Add `T3N_API_KEY=your_key` to your `.env` to activate identity layer.

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
- `create-eth-agent@0.1.1` on npm (includes TS config compatibility fix)

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
