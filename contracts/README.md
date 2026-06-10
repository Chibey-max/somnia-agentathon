# Deploy Your Own AgentWallet (Foundry — Somnia Testnet)

This project deploys `AgentWallet` using Foundry script:

- `script/Deploy.s.sol`

---

## 1) Prepare env

```bash
cd contracts
cp .env.example .env
```

Edit `.env`:

```env
AGENT_ADDRESS=0x...         # agent role address
GUARDIAN_ADDRESS=0x...      # guardian role address
PRIVATE_KEY=0x...           # deployer private key (funded on Somnia Testnet)
RPC_URL=https://dream-rpc.somnia.network
CHAIN_ID=50312
```

---

## 2) Load env into shell

```bash
set -a
source .env
set +a
```

Verify values are present:

```bash
echo "RPC_URL=[$RPC_URL]"
echo "PRIVATE_KEY set? [$([ -n "$PRIVATE_KEY" ] && echo yes || echo no)]"
echo "AGENT_ADDRESS=[$AGENT_ADDRESS]"
echo "GUARDIAN_ADDRESS=[$GUARDIAN_ADDRESS]"
```

Optional RPC check:

```bash
cast block-number --rpc-url "$RPC_URL"
```

---

## 3) Deploy to Somnia Testnet

```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://dream-rpc.somnia.network \
  --broadcast \
  --chain-id 50312 \
  --private-key "$PRIVATE_KEY"
```

On success, copy from output:

```text
Contract Address: 0x...
```

Use that address in `runtime/.env` as:

```env
AGENT_CONTRACT_ADDRESS=0x...
```

---

## 4) After deploy

In `runtime/.env`, `AGENT_PRIVATE_KEY` must match the same agent address used in `AGENT_ADDRESS` during deployment.

Then from `runtime/`:

```bash
npm run build
npm run setup
```

---

## Common errors

### Invalid private key
- Key must be `0x` + 64 hex chars.
- Don't pass literal `PRIVATE_KEY`; pass `$PRIVATE_KEY` after sourcing `.env`.

### --rpc-url missing
- `$RPC_URL` is empty because `.env` was not sourced.

### Provider/RPC rejected request
- Somnia Testnet RPC: `https://dream-rpc.somnia.network`
- No API key required.
