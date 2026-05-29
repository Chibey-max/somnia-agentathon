# ETH Agent

Autonomous Ethereum AI agent framework for Sepolia.
Connect your IDE assistant to an on-chain wallet with enforced limits, whitelisting, and guardian controls.

---

## 5-Minute Quickstart (No Guesswork)

> Follow these steps in order. Do **not** skip contract deployment.

## 0) Prerequisites

- Node.js 18+
- Git
- Foundry installed (`forge`, `cast`)
- Sepolia ETH in your deployer + agent wallets (https://sepoliafaucet.com)
- Groq API key (https://console.groq.com)

---

## 1) Clone

```bash
git clone https://github.com/Chibey-max/Ethereum-Agentic.git
cd Ethereum-Agentic
```

---

## 2) Create wallets (important)

You need 3 EVM keys/addresses:

1. **Guardian wallet** (controls policy / pause)
2. **Agent wallet** (used by MCP runtime)
3. **Deployer wallet** (pays contract deployment gas)

> You can reuse wallet #1 or #2 as deployer, but beginners should keep them separate.

---

## 3) Deploy `AgentWallet` on Sepolia (contracts first)

```bash
cd contracts
cp .env.example .env
```

Edit `contracts/.env` (the template already includes `RPC_URL` by default after `cp .env.example .env`):

```env
AGENT_ADDRESS=0x...         # public address of the AGENT wallet
GUARDIAN_ADDRESS=0x...      # public address of the GUARDIAN wallet
PRIVATE_KEY=0x...           # DEPLOYER private key (funded on Sepolia)
RPC_URL=https://sepolia.drpc.org
```

`RPC_URL` is pre-populated by default from `.env.example`.

Load env into shell:

> Important: after **any** `.env` change, run this again in the same terminal before deploying.

```bash
set -a
source .env
set +a
```

Sanity check env loaded:

```bash
echo "RPC_URL=[$RPC_URL]"
echo "PRIVATE_KEY set? [$([ -n "$PRIVATE_KEY" ] && echo yes || echo no)]"
echo "AGENT_ADDRESS=[$AGENT_ADDRESS]"
echo "GUARDIAN_ADDRESS=[$GUARDIAN_ADDRESS]"
```

Optional RPC health check:

```bash
cast block-number --rpc-url "$RPC_URL"
```

Deploy:

```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY"
```

Copy the deployed contract address from output:

```text
Contract Address: 0x...
```

That value is your `AGENT_CONTRACT_ADDRESS`.

---

## 4) Configure runtime

```bash
cd ../runtime
cp .env.example .env
```

Edit `runtime/.env` (the template already includes `RPC_URL` by default after `cp .env.example .env`):

```env
AGENT_CONTRACT_ADDRESS=0x...   # from deploy output
AGENT_PRIVATE_KEY=0x...        # AGENT wallet private key (must match AGENT_ADDRESS used at deploy)
RPC_URL=https://sepolia.drpc.org
GROQ_API_KEY=...
CHAIN_ID=11155111
```

`RPC_URL` is pre-populated by default from `.env.example`.

If you update `runtime/.env`, reload it in the same terminal before running runtime commands:

```bash
set -a
source .env
set +a
```

---

## 5) Build + validate + connect MCP

```bash
npm install
npm run build
npm run setup:check
npm run setup
```

When prompted, choose your IDE:

```text
claude / cursor / kiro / all
```

The setup script merges MCP config (does not overwrite existing servers).

---

## 6) Restart IDE and test

Try in IDE chat:

- `What is my ETH balance?`
- `What are my spending limits?`
- `Get wallet state`

---

## 7) Run the dashboard (web UI)

From the repository root:

```bash
cd dashboard
npm install
cp .env.local.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Notes:
- `dashboard` `predev` automatically builds `../runtime` before starting Next.js.
- If you edit `dashboard/.env.local`, restart the dev server.
- For dashboard-specific details, see `dashboard/README.md`.

---

## How it works

```text
IDE Assistant (Claude/Cursor/Kiro)
          │
          ▼
    MCP Server (runtime)
          │
          ▼
   AgentWallet.sol policy layer
          │
          ▼
      Ethereum Sepolia
```

---

## Manual MCP config (if needed)

Use this in your IDE MCP config:

```json
{
  "mcpServers": {
    "eth-agent": {
      "command": "node",
      "args": ["/FULL/PATH/TO/Ethereum-Agentic/runtime/dist/mcp-server.js"]
    }
  }
}
```

Paths:

- Claude Desktop: `~/.config/claude/claude_desktop_config.json`
- Cursor: `~/.cursor/mcp.json`
- Kiro: `~/.kiro/settings/mcp.json`

---

## Dashboard modes (AgentWallet vs Direct Wallet)

The dashboard chat supports two execution modes:

| Mode | Who signs transactions | Funds source | Policy / whitelist / limits | Best for |
|------|-------------------------|--------------|-------------------------------|----------|
| `Direct Wallet` | Your connected browser wallet (e.g. MetaMask) | Connected wallet address | No `AgentWallet` policy enforcement | Manual user-driven actions |
| `AgentWallet` | Runtime agent using `AGENT_PRIVATE_KEY` | Deployed `AgentWallet` contract balance | Yes — on-chain policy + whitelist + per-tx + daily limits | Controlled autonomous execution |

### Practical behavior

- **Direct Wallet Mode**
  - Can check connected wallet balance.
  - Can check balance for any explicit `0x...` address in prompt.
  - Sends ETH from the currently connected wallet only.
- **AgentWallet Mode**
  - Routes requests through dashboard API -> runtime bridge -> `AgentWallet` contract.
  - Contract policy gates execution (whitelist + limits + guardian controls).

Use **Direct** for quick wallet actions you personally approve in wallet popups.
Use **AgentWallet** when you need policy-constrained agent execution.

## Available tools

| Tool | Description |
|------|-------------|
| `get_wallet_state` | Balance, status, limits, agent, guardian |
| `transfer_eth` | Send ETH to whitelisted address |
| `transfer_token` | Send ERC-20 within policy limits |
| `get_tx_status` | Check transaction by hash |
| `check_limits` | Remaining daily/per-tx ETH allowance |
| `check_whitelist` | Check if target+selector is currently allowed |
| `get_pending_actions` | Pending queued policy/limit actions with countdown |
| `get_transaction_history` | Recent `Executed` events |

---

## Fast troubleshooting

### `Invalid private key`
You passed literal `PRIVATE_KEY` instead of actual value, or key format is wrong.
Must be `0x` + 64 hex chars.

### `--rpc-url <URL> but none was supplied`
`$RPC_URL` is empty in shell. Run:

```bash
set -a; source .env; set +a
```

### `Connection refused` / transport error (`os error 111`)
Your RPC endpoint is unreachable from your current network, or the provider is temporarily unavailable.

1) Test current RPC quickly:

```bash
cast block-number --rpc-url "$RPC_URL"
```

2) If that fails, switch `RPC_URL` in `.env` to another Sepolia endpoint (try one at a time):

```env
RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
# RPC_URL=https://rpc.sepolia.org
# RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
# RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
```

3) Reload env and re-test:

```bash
set -a; source .env; set +a
cast block-number --rpc-url "$RPC_URL"
```

4) Optional network check:

```bash
curl -I https://sepolia.drpc.org
```

If curl/RPC checks fail, try disabling VPN, changing network (e.g. hotspot), or using another RPC provider.

### `Agent key mismatch`
`runtime/.env` `AGENT_PRIVATE_KEY` does not match the on-chain `agent` in deployed contract.

### `Call not whitelisted`
Contract policy is blocking the action (expected behavior). Whitelist target/selector/recipient first as guardian.

---

## Security notes

- Never commit `.env` files.
- Never share private keys.
- If a key appears in screenshots/logs, rotate it immediately.
