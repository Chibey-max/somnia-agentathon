# ETH Agent Dashboard

Full-stack dashboard for the **AgentWallet** smart contract deployed on Ethereum Sepolia testnet.

## Contract Details

| Field | Value |
|---|---|
| Contract | `0xE49A6044D47De19504B73aA36F31899843B05259` |
| Network | Ethereum Sepolia (chainId: 11155111) |
| Guardian | `0xd9100b701e21fC578BFD937AC2DbDfb5bbD42572` |

## Stack

- **Next.js 14** (App Router)
- **TypeScript** strict mode
- **Tailwind CSS** with dark terminal theme
- **viem** for all blockchain reads
- **wagmi** for wallet connection + write transactions
- **recharts** for charts (TX history)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.local.example .env.local
# Edit .env.local:
#   NEXT_PUBLIC_ALCHEMY_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# 3. Run dev server
npm run dev
```

The dashboard will be at `http://localhost:3000`.

## Project Structure

```
src/
├── app/
│   ├── page.tsx               # Main dashboard
│   ├── layout.tsx             # Root layout with providers
│   ├── globals.css            # Terminal theme styles
│   └── api/
│       ├── contract/route.ts  # GET: all contract state
│       ├── events/route.ts    # GET: Executed events
│       ├── agent/route.ts     # POST: stream agent goals
│       └── guardian/route.ts  # POST: build guardian calldata
├── components/
│   ├── panels/
│   │   ├── OverviewPanel.tsx
│   │   ├── SpendingLimitsPanel.tsx
│   │   ├── TransactionHistoryPanel.tsx
│   │   ├── WhitelistManagerPanel.tsx
│   │   ├── TokenPolicyPanel.tsx
│   │   ├── AgentChatPanel.tsx
│   │   └── GuardianControlPanel.tsx
│   └── shared/
│       ├── index.tsx          # Panel, Badge, Button, Input, etc.
│       ├── Navbar.tsx         # Header with wallet connect
│       └── Providers.tsx      # Wagmi + TanStack Query
├── hooks/
│   ├── useContractState.ts    # Auto-polling contract state (30s)
│   └── useEvents.ts           # Auto-polling events (60s)
├── lib/
│   ├── contract.ts            # ABI + constants
│   ├── utils.ts               # viem client + formatting helpers
│   └── wagmi.ts               # wagmi config
└── types/
    └── index.ts               # TypeScript interfaces
```

## Panels

| Panel | Description |
|---|---|
| Overview | Contract address, ETH balance, roles, network, pause status |
| Spending Limits | Per-TX + daily ETH limits, progress bar, pending limit changes |
| Transaction History | Live `Executed` event feed from Sepolia with Etherscan links |
| Whitelist Manager | Queue/apply/cancel call policy with 10min timelock |
| Token Policy | ERC-20 daily limits, spend tracking, guardian set/revoke |
| Agent Chat | Stream goals to runtime, see tool calls + tx hashes |
| Guardian Control | Pause/unpause, withdraw, transfer roles, queue limit changes |

## Agent Runtime Integration

The Agent Chat panel calls `POST /api/agent`.

The dashboard API route runs in Node runtime and **spawns a separate runtime bridge process** (`runtime/src/dashboard-agent.ts`) to execute agent goals, then streams chunked JSON/SSE-like events back to the UI.

This process boundary avoids Next.js module-format conflicts and keeps runtime execution isolated from dashboard bundling.

End-to-end flow:

```text
dashboard UI -> /api/agent -> runtime bridge process -> AgentWallet/MCP logic -> streamed chunks -> dashboard UI
```

## Design System

| Token | Value |
|---|---|
| Background | `#0a0a0a` |
| Panel | `#0f0f0f` |
| Green accent | `#00ff88` |
| Blue accent | `#3b82f6` |
| Warning orange | `#ff6b35` |
| Danger red | `#ff3333` |
| Font | Space Grotesk (UI) + Geist Mono (code/mono) |

## Chat Execution Modes

The chat panel supports two modes:

| Mode | Who signs | Source of funds | Policy enforcement |
|---|---|---|---|
| `Direct Wallet` | Connected browser wallet | Connected wallet address | None from `AgentWallet` contract |
| `AgentWallet` | Runtime agent (`AGENT_PRIVATE_KEY`) | Deployed `AgentWallet` contract | Yes (whitelist + per-tx + daily limits + guardian controls) |

### Notes

- In **Direct Wallet** mode:
  - address-based balance requests should include an explicit `0x...` address;
  - transfers are sent only from the connected browser wallet.
- In **AgentWallet** mode:
  - requests are executed through the runtime + contract path;
  - on-chain contract policy determines whether execution is allowed.

## Guardian Actions

All guardian write operations use the connected wallet via wagmi — **no private keys** are ever handled by the dashboard.

Actions requiring wallet signing:
- Pause / Unpause
- Emergency withdraw
- Transfer agent/guardian roles
- Queue/apply/cancel call policy
- Queue/apply/cancel limit changes
- Set/revoke token policies
