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
npx create-eth-agent my-agent
cd my-agent
cp .env.example .env
# fill in .env
npm run build
npm run setup
# restart your IDE
```

### Option B — Clone the full repo
```bash
git clone https://github.com/Chibey-max/eth-agent
cd eth-agent/runtime
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

## Requirements

- Node.js 18+
- Sepolia testnet ETH (https://sepoliafaucet.com)
- Deployed AgentWallet contract
- At least one AI provider key required:
  - Groq (recommended, free): console.groq.com
  - OpenRouter (free models): openrouter.ai
  - Google Gemini (free tier): aistudio.google.com
