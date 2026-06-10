#!/usr/bin/env bash
set -euo pipefail

# Somnia Testnet AgentWallet deployment helper.
# Run from the repo root after exporting SOMNIA_DEPLOYER_PRIVATE_KEY.

cd contracts

RPC_URL="${SOMNIA_RPC_URL:-https://dream-rpc.somnia.network}"

forge script script/Deploy.s.sol \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --chain-id 50312 \
  "$@"
