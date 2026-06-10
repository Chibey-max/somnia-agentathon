# Somnia Agent Kit

> **The first autonomous AI agent framework for Somnia's Agentic L1.**
> Policy-enforced, guardian-controlled, MCP-native — built for the Somnia Agentathon.

**Hackathon:** Somnia Agentathon — Encode Club  
**Deadline:** June 11, 2026  

---

## What Is This?

Somnia Agent Kit is a chain-agnostic autonomous AI agent framework ported to Somnia's EVM-compatible Agentic L1. An AI agent (powered by Groq/OpenRouter/Gemini) connects to an on-chain `AgentWallet.sol` contract via an MCP server, and can autonomously execute transactions — all constrained by on-chain spending limits, address whitelisting, and a guardian kill-switch.

```
User prompt → MCP Server → SomniaAgent → AgentWallet.sol → Somnia Testnet
                                              ↑
                                    enforces: spending limits (STT)
                                              whitelist
                                              pause/unpause
                                              daily limits
                                              timelocked queues
```

---

## Architecture

```text
somnia-agent-kit/
  contracts/              AgentWallet.sol + Somnia deploy scripts
  runtime/                MCP server + AI agent loop (viem, chain-agnostic)
  dashboard/              Next.js web UI (Somnia Testnet)
  somnia/                 Somnia integration layer
    agent/somniaAgent.ts  Agent entry point for Somnia
    contracts/deploy-somnia.sh
    skills/agentWalletSkill.ts
    README.md
  mantle/                 Mantle Turing Test Hackathon (separate submission)
  packages/
    create-somnia-agent/  CLI scaffold tool
```

---

## Deployed Contract

```
AGENT_WALLET_ADDRESS=<deployed on Somnia Testnet>
```

> Fill this in after running the deploy script below.

---

## Demo Video

> [Insert 2–5 min demo link here showing the agent autonomously executing on-chain actions on Somnia]

---

## How to Run Locally

### Prerequisites
- Node.js 20+
- Foundry (`curl -L https://foundry.paradigm.xyz | bash`)
- A funded Somnia Testnet wallet (get STT from the Somnia faucet)
- At least one LLM API key (Groq recommended — free at console.groq.com)

### 1. Clone & install

```bash
git clone https://github.com/Chibey-max/somnia-agentathon.git
cd somnia-agentathon
npm install
```

### 2. Deploy AgentWallet on Somnia Testnet

```bash
cd contracts
cp .env.example .env
# fill in AGENT_ADDRESS, GUARDIAN_ADDRESS, PRIVATE_KEY

forge script script/Deploy.s.sol \
  --rpc-url https://dream-rpc.somnia.network \
  --broadcast \
  --chain-id 50312
```

Copy the deployed contract address into `.env` and `dashboard/.env.local`.

### 3. Configure the runtime

```bash
cp .env.example .env
# fill in:
#   RPC_URL=https://dream-rpc.somnia.network
#   CHAIN_ID=50312
#   AGENT_CONTRACT_ADDRESS=<deployed address>
#   AGENT_PRIVATE_KEY=<agent key>
#   GROQ_API_KEY=<your key>

npm run build
npm run setup
```

### 4. Start the dashboard

```bash
cd dashboard
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_CONTRACT_ADDRESS, NEXT_PUBLIC_CHAIN_ID=50312

npm run dev
# open http://localhost:3000
```

### 5. Run the Somnia agent loop

```bash
npx ts-node somnia/agent/somniaAgent.ts
```

---

## MCP Config (IDE integration)

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

Add to: `~/.cursor/mcp.json`, `~/.kiro/settings/mcp.json`, or Claude Desktop config.

---

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `get_wallet_state` | Balance, limits, paused status, agent/guardian roles |
| `transfer_eth` | Send STT to a whitelisted address |
| `transfer_token` | Send ERC-20 within token policy |
| `check_limits` | Remaining daily STT allowance |
| `get_tx_status` | Look up transaction by hash |
| `check_whitelist` | Check if address+selector is allowed |
| `get_pending_actions` | Queued calls with countdown timers |
| `get_transaction_history` | Recent on-chain activity |

---

## Smart Contract: AgentWallet.sol

All agent actions are enforced on-chain — the MCP server cannot bypass them:

- Per-transaction STT spending limit
- Daily STT spending limit
- Whitelisted target addresses + function selectors
- Token-specific daily limits
- Guardian pause/unpause kill switch
- 10-minute timelock on limit increases
- 2-step role transfers (agent + guardian)
- ReentrancyGuard on all state-changing functions

---

## Chain Config: Somnia Testnet

| Field | Value |
|-------|-------|
| Chain ID | `50312` |
| RPC | `https://dream-rpc.somnia.network` |
| Native token | `STT` |
| Block explorer | `https://shannon-explorer.somnia.network` |

---

## Judging Criteria

### Functionality
The agent runs end-to-end: deployed contract on Somnia Testnet → MCP server → AI agent → on-chain execution. Every tool call is verified against the on-chain policy before broadcast.

### Agent-First Design
The MCP server exposes `AgentWallet.sol` as structured tools. The AI agent discovers available actions autonomously and invokes them without hard-coded call sequences. The contract is the policy engine — not the agent's prompt.

### Innovation
This is the first agent SDK targeting Somnia's Agentic L1. The framework is chain-agnostic: the same `AgentWallet.sol` logic and MCP server work on any EVM chain — Somnia Testnet today, mainnet tomorrow. Includes a Mantle integration as a parallel submission demonstrating multi-chain portability.

### Autonomous Performance
The agent executes multi-step on-chain flows without human intervention: read wallet state → check policy → prepare calldata → broadcast → confirm. The guardian role exists only for emergency intervention, not normal operation.

---

## .env.example

```bash
RPC_URL=https://dream-rpc.somnia.network
CHAIN_ID=50312
NETWORK=somnia_testnet
CONTRACT_ADDRESS=   # fill after deploy
AGENT_PRIVATE_KEY=0x
GUARDIAN_ADDRESS=0x
GROQ_API_KEY=
T3N_API_KEY=        # optional — Terminal 3 verifiable identity
```

---

## Project Structure (full)

```text
somnia-agent-kit/
  contracts/
    src/AgentWallet.sol         Two-role guardian/agent wallet
    script/Deploy.s.sol         Foundry deploy script (Somnia Testnet)
    foundry.toml                Somnia RPC endpoint configured
  runtime/
    src/agent.ts                AI agent loop
    src/mcp-server.ts           MCP tool server
    src/executor.ts             On-chain executor (viem)
  dashboard/
    src/app/page.tsx            Main dashboard
    src/app/somnia/             Somnia-specific view
    src/lib/wagmi.ts            Somnia Testnet chain config
  somnia/
    agent/somniaAgent.ts        Somnia agent entry point
    contracts/deploy-somnia.sh  One-command Somnia deploy
    skills/agentWalletSkill.ts  MCP skill wrapper
    README.md                   Somnia-specific docs
  mantle/                       Mantle Turing Test (separate submission)
  packages/
    create-somnia-agent/        npx create-somnia-agent scaffold CLI
```

---

## License

MIT
