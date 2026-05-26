# ETH Agent

> Autonomous Ethereum AI agent framework for Sepolia testnet.  
> Connect your AI assistant to an on-chain wallet with enforced spending limits, whitelisting, and guardian controls.

## How it works

```text
IDE Assistant (Claude/Cursor/Kiro)
          │
          ▼
   MCP Server (runtime)
          │
          ▼
   AgentWallet.sol Policy Layer
          │
          ▼
      Ethereum Sepolia
```

## Prerequisites

- Node.js 18+
- Git
- A Sepolia wallet with some test ETH (https://sepoliafaucet.com)
- Free Groq API key (https://console.groq.com)
- Your deployed AgentWallet contract address

## Quickstart

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/eth-agent
cd eth-agent/runtime
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure your environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

- `AGENT_CONTRACT_ADDRESS`  ← your deployed AgentWallet
- `AGENT_PRIVATE_KEY`       ← the agent role private key
- `RPC_URL`                 ← free: https://rpc.ankr.com/eth_sepolia
- `GROQ_API_KEY`            ← free at console.groq.com

### 4. Build

```bash
npm run build
```

### 5. Run setup (connects to your IDE automatically)

```bash
npm run setup
```

Follow the prompts. The setup script will:

- ✓ Verify your contract connection
- ✓ Confirm your agent key matches the contract
- ✓ Detect your installed IDEs
- ✓ Write the MCP config automatically

### 6. Restart your IDE

### 7. Test it

In your IDE chat, try:

- `What is my ETH balance?`
- `What are my spending limits?`
- `Send 0.001 ETH to 0x3bF16591b7FAd920e34b2bF8B0b788AFF8Ae05e7`

## MCP Config (manual setup)

If you prefer to configure manually, add this to your IDE's MCP config:

- Claude Desktop → `~/.config/claude/claude_desktop_config.json`
- Cursor         → `~/.cursor/mcp.json`
- Kiro           → `~/.kiro/settings/mcp.json`

```json
{
  "mcpServers": {
    "eth-agent": {
      "command": "node",
      "args": ["/FULL/PATH/TO/eth-agent/runtime/dist/mcp-server.js"]
    }
  }
}
```

## Available Agent Tools

| Tool | Description |
|------|-------------|
| get_wallet_state | Balance, limits, status, roles |
| transfer_eth | Send ETH to whitelisted address |
| transfer_token | Send ERC-20 within token policy |
| check_limits | Remaining daily ETH allowance |
| get_tx_status | Look up any transaction |
| check_whitelist | Check if address+action is allowed |
| get_pending_actions | Queued calls with countdown timers |
| get_transaction_history | Recent on-chain activity |

## Contract

`AgentWallet` enforces all agent actions on-chain:

- Per-transaction ETH spending limit
- Daily ETH spending limit
- Whitelisted target addresses and function selectors
- Token-specific daily limits
- Guardian pause/unpause
- 10-minute timelock on limit increases

Deploy your own: see `contracts/README.md`

## Project Structure

```text
eth-agent/
  contracts/   — AgentWallet.sol + deploy scripts
  runtime/     — MCP server + AI agent (start here)
  dashboard/   — Web UI (optional)
```

## Troubleshooting

**"Call not whitelisted" error**  
Your target address and function selector need to be approved by the guardian.

**"Exceeds ETH tx limit" error**  
The amount exceeds your per-transaction limit set in the contract.

**Agent key mismatch**  
The private key in `AGENT_PRIVATE_KEY` doesn't match the agent address stored in your AgentWallet contract.

**RPC connection failed**  
Try a different RPC: `https://rpc.ankr.com/eth_sepolia` works without a key.
