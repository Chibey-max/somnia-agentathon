// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AgentIdentity.sol";
import "../src/MantleAgentWallet.sol";
import "../src/TradingVault.sol";

/**
 * @title Deploy
 * @notice Foundry deploy script for Mantle Sepolia Testnet (chain ID 5003)
 * @dev Run: forge script script/Deploy.s.sol --rpc-url https://rpc.sepolia.mantle.xyz --broadcast
 */
contract Deploy is Script {
    // Deployment parameters — override via env vars
    address public AGENT_ADDRESS = vm.envOr("AGENT_ADDRESS", address(0));
    address public GUARDIAN_ADDRESS = vm.envOr("GUARDIAN_ADDRESS", address(0));
    uint256 public DAILY_LOSS_LIMIT_BPS = vm.envOr("DAILY_LOSS_LIMIT_BPS", uint256(500)); // 5%

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Mantle Agent Kit Deployment — Mantle Sepolia Testnet (RPC: https://rpc.sepolia.mantle.xyz) ===");
        console.log("Deployer:    ", deployer);
        console.log("Chain ID:    ", block.chainid);
        console.log("Block:       ", block.number);

        // Fallback: use deployer as agent/guardian if not set
        if (AGENT_ADDRESS == address(0)) AGENT_ADDRESS = deployer;
        if (GUARDIAN_ADDRESS == address(0)) GUARDIAN_ADDRESS = deployer;

        console.log("Agent:       ", AGENT_ADDRESS);
        console.log("Guardian:    ", GUARDIAN_ADDRESS);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy AgentIdentity (ERC-8004)
        AgentIdentity identity = new AgentIdentity();
        console.log("AgentIdentity deployed at:      ", address(identity));

        // 2. Deploy MantleAgentWallet
        MantleAgentWallet wallet = new MantleAgentWallet(
            AGENT_ADDRESS,
            GUARDIAN_ADDRESS,
            address(identity)
        );
        console.log("MantleAgentWallet deployed at:  ", address(wallet));

        // 3. Deploy TradingVault
        TradingVault vault = new TradingVault(
            AGENT_ADDRESS,
            DAILY_LOSS_LIMIT_BPS
        );
        console.log("TradingVault deployed at:       ", address(vault));

        // 4. Mint initial identity for agent
        uint256 tokenId = identity.mintIdentity(
            AGENT_ADDRESS,
            "Mantle AI Agent",
            "trading"
        );
        console.log("Identity NFT minted, tokenId:   ", tokenId);

        // 5. Whitelist vault and wallet in each other
        wallet.setWhitelist(address(vault), true);
        wallet.setWhitelist(AGENT_ADDRESS, true);
        console.log("Whitelist configured");

        // 6. Authorize wallet as strategist in vault
        vault.setStrategist(address(wallet), true);
        console.log("Wallet authorized as vault strategist");

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("Add to .env:");
        console.log("IDENTITY_CONTRACT_ADDRESS=", vm.toString(address(identity)));
        console.log("AGENT_CONTRACT_ADDRESS=", vm.toString(address(wallet)));
        console.log("TRADING_VAULT_ADDRESS=", vm.toString(address(vault)));
    }
}
