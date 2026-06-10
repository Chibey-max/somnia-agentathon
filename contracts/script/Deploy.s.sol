// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AgentWallet.sol";

// Deploy to Somnia Testnet:
//   forge script script/Deploy.s.sol \
//     --rpc-url https://dream-rpc.somnia.network \
//     --broadcast \
//     --chain-id 50312
contract DeployScript is Script {
    function run() external {
        address agentAddr    = vm.envAddress("AGENT_ADDRESS");
        address guardianAddr = vm.envAddress("GUARDIAN_ADDRESS");
        vm.startBroadcast();
        new AgentWallet(agentAddr, guardianAddr, 0.1 ether, 0.5 ether);
        vm.stopBroadcast();
    }
}