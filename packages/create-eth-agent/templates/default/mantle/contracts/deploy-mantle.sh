#!/usr/bin/env bash
set -euo pipefail

# Mantle Sepolia AgentWallet deployment helper.
# Run from the repo root after exporting MANTLE_DEPLOYER_PRIVATE_KEY.

cd contracts

RPC_URL="${MANTLE_SEPOLIA_RPC_URL:-https://rpc.sepolia.mantle.xyz}"

forge script script/Deploy.s.sol:DeployAgentWallet \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --verify \
  --verifier-url "https://api-sepolia.mantlescan.xyz/api" \
  "$@"
