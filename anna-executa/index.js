const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin });

const tools = [
  {
    name: "get_wallet_state",
    description: "Get AgentWallet balance, daily limit, paused status",
    parameters: []
  },
  {
    name: "send_eth",
    description: "Send ETH to a whitelisted address within policy limits",
    parameters: [
      { name: "to", type: "string", description: "Recipient address" },
      { name: "amount", type: "string", description: "Amount in ETH" }
    ]
  },
  {
    name: "get_policy",
    description: "Get current spending limits and whitelist",
    parameters: []
  },
  {
    name: "get_transaction_history",
    description: "Get recent AgentWallet transactions",
    parameters: []
  }
];

rl.on("line", async line => {
  const req = JSON.parse(line);
  let result;

  if (req.method === "describe") {
    result = {
      name: "eth-agent",
      description: "Autonomous Ethereum AI agent with on-chain policy enforcement and T3N verifiable identity",
      tools
    };
  } else if (req.method === "call") {
    result = {
      output: `eth-agent tool '${req.params.name}' called. Connect to your deployed AgentWallet on Sepolia. See https://github.com/Chibey-max/Ethereum-Agentic for setup.`
    };
  }

  process.stdout.write(
    JSON.stringify({ jsonrpc: "2.0", id: req.id, result }) + "\n"
  );
});
