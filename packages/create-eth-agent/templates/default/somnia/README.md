# Somnia Agent Kit — Somnia Agentathon

> Autonomous AI agent wallet framework running on Somnia's Agentic L1 (Testnet, Chain ID 50312).

## Folder map

```text
somnia/
  contracts/
    deploy-somnia.sh         Somnia Testnet AgentWallet deploy helper
  skills/
    agentWalletSkill.ts      Skill wrapper for AgentWallet actions on Somnia
  agent/
    somniaAgent.ts           Somnia agent loop and policy decision logic
  README.md                  Somnia-specific docs
```

## Somnia Testnet setup

```bash
export SOMNIA_RPC_URL=https://dream-rpc.somnia.network
export SOMNIA_DEPLOYER_PRIVATE_KEY=0x...
```

Deploy:

```bash
bash somnia/contracts/deploy-somnia.sh
```

## Chain Details

| Field | Value |
|-------|-------|
| Chain ID | `50312` |
| RPC | `https://dream-rpc.somnia.network` |
| Native token | `STT` |
| Block explorer | `https://shannon-explorer.somnia.network` |

## Agent loop demo

```bash
npx ts-node somnia/agent/somniaAgent.ts
```

Expected output:

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
