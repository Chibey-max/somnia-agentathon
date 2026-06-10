# Mantle Agent Kit — Agentic Wallet Economy

> **The first verifiable AI agent wallet economy on Mantle — autonomous, policy-enforced, ERC-8004 identity-native.**

**Hackathon:** Mantle Turing Test Hackathon 2026  
**Tracks:** Agentic Wallets & Economy (primary) · AI Trading & Strategy (secondary) · Best UI/UX  
**Prize Pool:** $120,000  

---

## One-Liner

An AI agent that autonomously manages a Mantle smart wallet — enforcing spending policies, executing quant trading strategies, staking for yield, and recording every decision on-chain via ERC-8004 identity NFTs — all visible through a stunning real-time dashboard.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Mantle Agent Kit                              │
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐  │
│  │   Dashboard     │    │   Agent (MCP)   │    │  Contracts     │  │
│  │   Next.js 14    │◄──►│   TypeScript    │◄──►│   Solidity     │  │
│  │   Tailwind CSS  │    │   Groq/OpenAI   │    │   Foundry      │  │
│  │   Framer Motion │    │   viem          │    │   Mantle L2    │  │
│  └─────────────────┘    └─────────────────┘    └────────────────┘  │
│           │                      │                      │           │
│           │              ┌───────┴───────┐              │           │
│           │              │   Skills      │              │           │
│           │              │   Transfer    │              │           │
│           │              │   Swap Agni   │              │           │
│           │              │   Swap Moe    │              │           │
│           │              │   Stake mETH  │              │           │
│           │              │   Trade       │              │           │
│           └──────────────┴───────────────┴──────────────┘           │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ AgentIdentity│  │MantleAgent   │  │     TradingVault         │  │
│  │  ERC-8004    │  │   Wallet     │  │  RSI+EMA · Risk Mgmt     │  │
│  │  On-chain    │  │  Limits+     │  │  Daily Loss Limit        │  │
│  │  Audit Trail │  │  Guardian+   │  │  Position Tracking       │  │
│  │              │  │  Whitelist+  │  │  Strategy Execution      │  │
│  │              │  │  Timelock    │  │                          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

                         Mantle Network (Chain ID: 5000)
                    MNT · mETH (Mantle LSP) · USDY · Low Gas
```

---

## Features

### Agentic Wallet & Economy
- **MantleAgentWallet** — Policy-enforced smart wallet with spending limits (per-tx + daily), guardian controls, address whitelist, and 2-day timelock for limit changes
- **ERC-8004 On-Chain Identity** — Every agent has a soulbound NFT that logs its decisions on-chain. Reputation grows with successful actions.
- **Multi-token support** — Native MNT, mETH (Mantle LSP), USDY with independent policies
- **Guardian system** — Emergency pause/unpause with guardian role separate from owner
- **executeWithIdentity()** — Atomic execution + on-chain action recording in one call

### AI Trading & Strategy
- **Bybit market data integration** — Real-time ticker, klines, orderbook via API v5
- **Quant strategy engine** — RSI(14) + EMA(9/21) crossover signals with confidence scoring
- **Risk manager** — Position sizing (10% max), daily loss limit (5%), Kelly criterion sizing
- **TradingVault** — On-chain vault for strategy execution with daily loss halt
- **Full trading cycle** — Bybit data → signal analysis → risk check → on-chain execution

### Best UI/UX (Dashboard)
- **Design language: "Mantle Dark Pro"** — Deep dark bg, Mantle green (#00d4aa) accents, glassmorphism panels
- **10 interactive panels** — Overview, Trading, Identity, Skills, Yield, Audit Trail, Guardian, Chat
- **Framer Motion animations** — Smooth panel mounts, chart transitions, live data pulses
- **Agent Chat Terminal** — Real-time chat with tool call visualization
- **Mini sparklines** — On every stat card
- **Recharts integration** — Live candlestick charts, RSI gauge, yield area charts
- **Skill execution modals** — Execute any skill directly from the dashboard

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Contracts** | Solidity ^0.8.20, Foundry, OpenZeppelin |
| **Chain** | Mantle Mainnet (Chain ID: 5000) |
| **Agent** | TypeScript, viem, MCP SDK |
| **LLM** | Groq (primary) → OpenRouter → Google Gemini |
| **Market Data** | Bybit API v5 |
| **Dashboard** | Next.js 14, Tailwind CSS, Framer Motion, Recharts |
| **DeFi** | Merchant Moe (Joe V2.1), Agni Finance, Mantle LSP |

---

## Quick Start

### Prerequisites
- Foundry (`curl -L https://foundry.paradigm.xyz | bash`)
- Node.js 20+
- A funded Mantle wallet

### 1. Deploy Contracts

```bash
cd mantle/contracts

# Install dependencies
forge install OpenZeppelin/openzeppelin-contracts

# Copy environment
cp .env.example .env
# Fill in PRIVATE_KEY, and optionally AGENT_ADDRESS, GUARDIAN_ADDRESS

# Deploy to Mantle
forge script script/Deploy.s.sol \
  --rpc-url https://rpc.mantle.xyz \
  --broadcast \
  --verify

# Copy the logged addresses to agent/.env
```

### 2. Run the Agent

```bash
cd mantle/agent

npm install

# Configure environment
cp .env.example .env
# Fill in contract addresses and API keys

# Start interactive agent
npm run dev

# Or start MCP server
npm run mcp
```

### 3. Start the Dashboard

```bash
cd mantle/dashboard

npm install

# Start dev server on port 3002
npm run dev

# Open http://localhost:3002
```

---

## Contract Addresses (Mantle Mainnet)

| Contract | Address |
|----------|---------|
| AgentIdentity (ERC-8004) | `DEPLOY_AND_FILL` |
| MantleAgentWallet | `DEPLOY_AND_FILL` |
| TradingVault | `DEPLOY_AND_FILL` |

---

## Mantle Token Addresses

| Token | Address | Description |
|-------|---------|-------------|
| MNT | Native | Mantle native token (gas + transfers) |
| mETH | `0xcDA86A272531e8640cD7F1a92c01839911B90bb0` | Mantle Liquid Staking (~4.5% APY) |
| USDY | `0x5bE26527e817998A7206475496fDE1E68957c5A9` | Yield-bearing stablecoin |

---

## Security

- **Spending limits** enforced at contract level — agent cannot exceed per-tx or daily limits
- **Whitelist** — agent can only send to pre-approved addresses
- **Guardian role** — independent address can emergency pause at any time
- **Timelock** — 2-day delay on all limit changes
- **Non-transferable identity** — ERC-8004 NFTs are bound to the agent address
- **ReentrancyGuard** on all state-changing functions
- **Chain ID check** — contracts verify Mantle mainnet (5000)

---

## Team

Built for the Mantle Turing Test Hackathon 2026.

> "We didn't just build an agentic wallet. We built an economy." 

---

## License

MIT
