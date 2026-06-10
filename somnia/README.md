# Somnia Agent Kit — Somnia Agentathon

> Autonomous AI agent wallet framework running on Somnia's Agentic L1 (Testnet, Chain ID 50312).

**Hackathon:** Somnia Agentathon — Encode Club  
**Tracks:** Autonomous Agents · Agent-First Design  

---

## Folder map

```text
somnia/
  contracts/
    deploy-somnia.sh         Somnia Testnet AgentWallet deploy helper
  skills/
    agentWalletSkill.ts      Skill wrapper for AgentWallet actions on Somnia
    somnia.config.ts         Skill registry config
  agent/
    somniaAgent.ts           Somnia agent loop and policy decision logic
  README.md                  Somnia-specific docs
```

---

## Somnia Testnet setup

```bash
export SOMNIA_RPC_URL=https://dream-rpc.somnia.network
export SOMNIA_DEPLOYER_PRIVATE_KEY=0x...
```

Deploy:

```bash
bash somnia/contracts/deploy-somnia.sh
```

Or explicitly:

```bash
forge script contracts/script/Deploy.s.sol \
  --rpc-url https://dream-rpc.somnia.network \
  --broadcast \
  --chain-id 50312
```

---

## Chain Details

| Field | Value |
|-------|-------|
| Chain ID | `50312` |
| RPC | `https://dream-rpc.somnia.network` |
| Native token | `STT` |
| Block explorer | `https://shannon-explorer.somnia.network` |

---

## Agent loop demo

```bash
npx ts-node somnia/agent/somniaAgent.ts
```

Expected output (dry-run):

```json
{
  "type": "prepare_execution",
  "reasoning": "Bullish Somnia signal (85% confidence) fits policy limits. Prepare AgentWallet.execute() on Somnia Testnet.",
  "action": {
    "label": "Guarded STT treasury rebalance",
    "amountStt": 0.05,
    "targetToken": "STT"
  }
}
```

---

## Skills

`somnia/skills/agentWalletSkill.ts` exposes a structured skill interface for:

- **observe** — read wallet state, inspect current policy
- **explain_policy** — describe what AgentWallet enforces on-chain
- **prepare_execution** — dry-run a guarded Somnia action

Real execution flows through `AgentWallet.execute()` and the on-chain policy engine.

---

## Deployed Contract

| Contract | Address |
|----------|---------|
| AgentWallet (Somnia Testnet) | `DEPLOY_AND_FILL` |

---

## Submission checklist

- [ ] Deploy AgentWallet on Somnia Testnet (Chain ID 50312)
- [ ] Set STT-denominated policy limits
- [ ] Show agent autonomously executing on-chain flows
- [ ] Dashboard connected to Somnia Testnet
- [ ] Demo video recorded
- [ ] Contract address and demo link added here
