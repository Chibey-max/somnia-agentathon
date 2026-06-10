import { publicClient } from "../account";
import { config } from "../env";
import { getAgentTokenId, getRecentActions, getAgentProfile } from "../identity";
import { parseAbi } from "viem";

const IDENTITY_ABI = parseAbi([
  "event ActionRecorded(uint256 indexed tokenId, string action, bytes32 txHash, uint256 timestamp)",
  "event IdentityMinted(uint256 indexed tokenId, address indexed agent, string name, string agentType)",
  "event ReputationUpdated(uint256 indexed tokenId, uint256 oldReputation, uint256 newReputation)",
]);

export interface AuditEntry {
  eventType: "action" | "mint" | "reputation";
  tokenId: string;
  description: string;
  txHash: string;
  blockNumber: bigint;
  timestamp?: string;
}

/**
 * Fetch on-chain audit trail for the agent's identity
 */
export async function getAuditTrail(
  tokenId?: bigint,
  fromBlock?: bigint
): Promise<AuditEntry[]> {
  const id = tokenId || (await getAgentTokenId());
  if (id === 0n) return [];

  const contractAddress = config.IDENTITY_CONTRACT_ADDRESS;
  if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
    return [];
  }

  const startBlock = fromBlock || 0n;

  // Fetch ActionRecorded events
  const actionLogs = await publicClient.getLogs({
    address: contractAddress,
    event: IDENTITY_ABI[0],
    args: { tokenId: id },
    fromBlock: startBlock,
    toBlock: "latest",
  });

  const entries: AuditEntry[] = actionLogs.map((log) => ({
    eventType: "action" as const,
    tokenId: id.toString(),
    description: (log.args as { action?: string }).action || "Unknown action",
    txHash: log.transactionHash || "0x",
    blockNumber: log.blockNumber || 0n,
  }));

  // Fetch ReputationUpdated events
  const repLogs = await publicClient.getLogs({
    address: contractAddress,
    event: IDENTITY_ABI[2],
    args: { tokenId: id },
    fromBlock: startBlock,
    toBlock: "latest",
  });

  for (const log of repLogs) {
    const args = log.args as { oldReputation?: bigint; newReputation?: bigint };
    entries.push({
      eventType: "reputation",
      tokenId: id.toString(),
      description: `Reputation changed: ${args.oldReputation?.toString()} → ${args.newReputation?.toString()}`,
      txHash: log.transactionHash || "0x",
      blockNumber: log.blockNumber || 0n,
    });
  }

  // Sort by block number
  entries.sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : 1));

  return entries;
}

/**
 * Generate a human-readable audit report
 */
export async function generateAuditReport(): Promise<string> {
  const tokenId = await getAgentTokenId();
  if (tokenId === 0n) {
    return "No agent identity found. Mint an identity NFT first.";
  }

  const [profile, recentActions, auditEntries] = await Promise.all([
    getAgentProfile(tokenId),
    getRecentActions(tokenId, 20),
    getAuditTrail(tokenId),
  ]);

  const lines: string[] = [
    `=== Agent Audit Report ===`,
    `Identity Token: #${tokenId}`,
    `Name: ${profile.name} (${profile.agentType})`,
    `Reputation: ${profile.reputation}/1000`,
    `Total Actions: ${profile.actionCount}`,
    `Active Since: ${new Date(Number(profile.createdAt) * 1000).toISOString()}`,
    `Last Active: ${new Date(Number(profile.lastActive) * 1000).toISOString()}`,
    "",
    `=== Recent On-Chain Actions (${recentActions.length}) ===`,
  ];

  for (const action of recentActions) {
    lines.push(
      `  [${new Date(Number(action.timestamp) * 1000).toISOString()}] ${action.action}`
    );
    if (action.txHash !== "0x" + "0".repeat(64)) {
      lines.push(`    TX: ${action.txHash}`);
    }
  }

  if (auditEntries.length > 0) {
    lines.push("");
    lines.push(`=== Blockchain Event Log (${auditEntries.length} events) ===`);
    for (const entry of auditEntries.slice(-10)) {
      lines.push(`  [Block ${entry.blockNumber}] ${entry.description}`);
    }
  }

  return lines.join("\n");
}
