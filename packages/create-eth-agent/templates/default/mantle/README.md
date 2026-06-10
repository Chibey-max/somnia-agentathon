# ETH Agent × Mantle

Mantle hackathon work lives here so the existing Ethereum-Agentic repo stays untouched.

## One-line pitch

ETH Agent on Mantle is a policy-governed autonomous wallet that can observe market context, prepare guarded actions, and expose every decision through a human-readable mission-control UI and cryptographic audit trail.

## Folder map

```text
mantle/
  contracts/
    deploy-mantle.sh              Mantle Sepolia AgentWallet deploy helper
    hardhat.config.mantle.ts      Mantle Sepolia Hardhat network config
  skills/
    agentWalletSkill.ts           Byreal-style skill wrapper for AgentWallet actions
    byreal.config.ts              Skill registry config
  agent/
    mantleAgent.ts                Mantle agent loop and policy decision simulation
  dashboard/
    MantleView.tsx                Standalone Mantle Mission Control UI component
  README.md                       Mantle-specific docs and demo notes
```

## Mantle Sepolia setup

```bash
export MANTLE_SEPOLIA_RPC_URL=https://rpc.sepolia.mantle.xyz
export MANTLE_DEPLOYER_PRIVATE_KEY=0x...
export MANTLESCAN_API_KEY=...
```

Deploy helper:

```bash
bash mantle/contracts/deploy-mantle.sh
```

The helper uses the existing `contracts/` AgentWallet deployment script and broadcasts to Mantle Sepolia.

## Agent loop demo

```bash
npx ts-node mantle/agent/mantleAgent.ts
```

Expected output is a deterministic dry-run decision such as:

```json
{
  "type": "prepare_execution",
  "reasoning": "Bullish Mantle signal ... fits policy limits. Prepare AgentWallet.execute().",
  "action": {
    "label": "Guarded MNT treasury rebalance",
    "amountMnt": 0.05,
    "targetToken": "MNT"
  }
}
```

## Dashboard UI

`mantle/dashboard/MantleView.tsx` is a standalone component implementing the five-screen Mission Control concept:

1. Agent Overview
2. Live Activity Feed
3. Policy Settings
4. On-Chain Proof
5. Connect / Onboard

To wire it into the existing Next.js dashboard later, import `MantleView` from this folder into a route such as `dashboard/src/app/mantle/page.tsx`.

## Byreal skills

`mantle/skills/agentWalletSkill.ts` exposes a simple skill interface for:

- observe mode
- policy explanation
- guarded Mantle execution preparation

It is intentionally dry-run first. Real execution should continue to flow through `AgentWallet.execute()` and the existing on-chain policy checks.

## Bounty checklist

- Deploy or link AgentWallet on Mantle Sepolia
- Set MNT-denominated policy limits
- Show the mission-control dashboard
- Demonstrate observe → policy preflight → dry-run execution → proof trail
- Add deployed contract address and demo link here before final submission
