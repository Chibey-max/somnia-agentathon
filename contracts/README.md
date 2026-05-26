# Deploy Your Own AgentWallet

## What it does

`AgentWallet` is a smart contract that acts as a policy-enforced wallet.  
Your AI agent can only perform actions that the contract allows.

## Deploy

```bash
cd contracts
cp .env.example .env
```

Fill in `contracts/.env`:

- `GUARDIAN_ADDRESS=0x...`   ← your wallet (you control the rules)
- `AGENT_ADDRESS=0x...`      ← the AI agent's address
- `ETH_TX_LIMIT=0.1`         ← max ETH per transaction
- `ETH_DAILY_LIMIT=0.5`      ← max ETH per day total
- `PRIVATE_KEY=0x...`        ← deployer private key

Run deploy:

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

Copy the deployed address into `runtime/.env` as `AGENT_CONTRACT_ADDRESS`.

## After deploying — whitelist your first address

Before the agent can send ETH, you must whitelist the recipient as guardian.  
This is done via the dashboard or directly via Etherscan.
