# Somnia Agent Kit

> Autonomous AI agent framework for Somnia's Agentic L1.
> Connect your AI assistant to an on-chain wallet with
> enforced spending limits, whitelisting, and guardian controls.

## How it works

```text
User prompt → MCP Server → AgentWallet.sol → Somnia Testnet
                              ↑
                    enforces: spending limits (STT)
                              whitelist
                              pause/unpause
                              daily limits
```

## Quickstart

### Option A — npx (fastest)
```bash
npx create-somnia-agent@latest my-agent
cd my-agent
cp .env.example .env
# fill in .env
npm run build
npm run setup
# restart your IDE
```

### Option B — Clone the full repo
```bash
git clone https://github.com/Chibey-max/somnia-agentathon.git
cd somnia-agentathon/runtime
cp .env.example .env
npm install
npm run build
npm run setup
```

### Option C — npm install (build on top)
```ts
npm install somnia-agent-kit

import { SomniaAgent } from 'somnia-agent-kit'
const agent = new SomniaAgent({ ...config })
await agent.run('Send 0.01 STT to 0x...')
```

## MCP Config (manual)

Add to your IDE config:

Claude Desktop: ~/.config/claude/claude_desktop_config.json
Cursor:         ~/.cursor/mcp.json
Kiro:           ~/.kiro/settings/mcp.json

```json
{
  "mcpServers": {
    "somnia-agent": {
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
| transfer_eth | Send STT to whitelisted address |
| transfer_token | Send ERC-20 within token policy |
| check_limits | Remaining daily STT allowance |
| get_tx_status | Look up transaction by hash |
| check_whitelist | Check if address+action is allowed |
| get_pending_actions | Queued calls with countdown timers |
| get_transaction_history | Recent on-chain activity |

## Chain: Somnia Testnet

| Field | Value |
|-------|-------|
| Chain ID | `50312` |
| RPC | `https://dream-rpc.somnia.network` |
| Native token | `STT` |
| Explorer | `https://shannon-explorer.somnia.network` |

## Smart Contract

AgentWallet enforces all agent actions on-chain:
- Per-transaction STT spending limit
- Daily STT spending limit
- Whitelisted target addresses and function selectors
- Token-specific daily limits
- Guardian pause/unpause kill switch
- 10-minute timelock on limit increases
- 2-step role transfers

Deploy your own: see contracts/README.md

## Requirements

- Node.js 18+
- Somnia Testnet STT (get from the Somnia faucet)
- Deployed AgentWallet contract
- At least one AI provider key required:
  - Groq (recommended, free): console.groq.com
  - OpenRouter (free models): openrouter.ai
  - Google Gemini (free tier): aistudio.google.com
