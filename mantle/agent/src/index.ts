import "dotenv/config";
import { ensureIdentityExists } from "./identity";
import { startInteractiveAgent, runAgent } from "./agent";
import { agentAccount } from "./account";
import { config } from "./env";

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║         Mantle AI Agent — Agentic Wallet Economy     ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`Agent address: ${agentAccount.address}`);
  console.log(`Chain ID:      ${config.CHAIN_ID} (Mantle Mainnet)`);
  console.log(`RPC:           ${config.MANTLE_RPC_URL}`);
  console.log(`Wallet:        ${config.AGENT_CONTRACT_ADDRESS}`);
  console.log("");

  // Step 1: Ensure the agent has an ERC-8004 identity
  try {
    const tokenId = await ensureIdentityExists("Mantle AI Agent", "trading");
    console.log(`Identity NFT:  Token #${tokenId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[init] Could not verify identity (${msg})`);
    console.warn("[init] Continuing without identity verification...");
  }

  console.log("");

  // Step 2: Check for CLI args
  const args = process.argv.slice(2);

  if (args.length > 0 && args[0] !== "--interactive") {
    // Single command mode
    const prompt = args.join(" ");
    console.log(`Executing: "${prompt}"\n`);
    try {
      const response = await runAgent(prompt);
      console.log("Response:", response);
    } catch (err) {
      console.error("Error:", err);
      process.exit(1);
    }
    return;
  }

  // Step 3: Interactive mode
  await startInteractiveAgent();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
