import { publicClient, walletClient, agentAccount } from "./account";
import { config } from "./env";
import { parseAbi } from "viem";

// ABI subset for AgentIdentity contract
const IDENTITY_ABI = parseAbi([
  "function mintIdentity(address agent, string calldata name, string calldata agentType) external returns (uint256)",
  "function recordAction(uint256 tokenId, string calldata action, bytes32 txHash) external",
  "function getIdentity(uint256 tokenId) external view returns (tuple(string name, string agentType, uint256 reputation, uint256 actionCount, uint256 createdAt, uint256 lastActive, address agentAddress, bool active))",
  "function getRecentActions(uint256 tokenId, uint256 count) external view returns (tuple(string action, bytes32 txHash, uint256 timestamp, bool success)[])",
  "function agentTokenId(address agent) external view returns (uint256)",
  "function totalIdentities() external view returns (uint256)",
]);

export interface AgentProfile {
  name: string;
  agentType: string;
  reputation: bigint;
  actionCount: bigint;
  createdAt: bigint;
  lastActive: bigint;
  agentAddress: `0x${string}`;
  active: boolean;
}

export interface OnChainAction {
  action: string;
  txHash: `0x${string}`;
  timestamp: bigint;
  success: boolean;
}

/**
 * Mint a new ERC-8004 identity NFT for the agent
 */
export async function mintAgentIdentity(
  name: string,
  agentType: string
): Promise<{ tokenId: bigint; txHash: `0x${string}` }> {
  const contractAddress = config.IDENTITY_CONTRACT_ADDRESS;
  if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("IDENTITY_CONTRACT_ADDRESS not configured");
  }

  console.log(`[identity] Minting identity: ${name} (${agentType}) for ${agentAccount.address}`);

  const txHash = await walletClient.writeContract({
    address: contractAddress,
    abi: IDENTITY_ABI,
    functionName: "mintIdentity",
    args: [agentAccount.address, name, agentType],
  });

  console.log(`[identity] Mint tx submitted: ${txHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new Error(`Identity mint failed: ${txHash}`);
  }

  // Get the tokenId from agentTokenId mapping
  const tokenId = await publicClient.readContract({
    address: contractAddress,
    abi: IDENTITY_ABI,
    functionName: "agentTokenId",
    args: [agentAccount.address],
  });

  console.log(`[identity] Identity minted successfully. Token ID: ${tokenId}`);
  return { tokenId, txHash };
}

/**
 * Record an agent decision on-chain via ERC-8004
 */
export async function recordOnChainAction(
  tokenId: bigint,
  action: string,
  txHash?: `0x${string}`
): Promise<`0x${string}`> {
  const contractAddress = config.IDENTITY_CONTRACT_ADDRESS;
  if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
    console.warn("[identity] Identity contract not configured, skipping record");
    return "0x" as `0x${string}`;
  }

  const hash = txHash || ("0x" + "0".repeat(64)) as `0x${string}`;

  const recordTxHash = await walletClient.writeContract({
    address: contractAddress,
    abi: IDENTITY_ABI,
    functionName: "recordAction",
    args: [tokenId, action, hash as `0x${string}`],
  });

  console.log(`[identity] Action recorded on-chain: ${action} | tx: ${recordTxHash}`);
  return recordTxHash;
}

/**
 * Read an agent's ERC-8004 profile
 */
export async function getAgentProfile(tokenId: bigint): Promise<AgentProfile> {
  const contractAddress = config.IDENTITY_CONTRACT_ADDRESS;
  if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("IDENTITY_CONTRACT_ADDRESS not configured");
  }

  const profile = await publicClient.readContract({
    address: contractAddress,
    abi: IDENTITY_ABI,
    functionName: "getIdentity",
    args: [tokenId],
  });

  return {
    name: profile.name,
    agentType: profile.agentType,
    reputation: profile.reputation,
    actionCount: profile.actionCount,
    createdAt: profile.createdAt,
    lastActive: profile.lastActive,
    agentAddress: profile.agentAddress,
    active: profile.active,
  };
}

/**
 * Get the current agent's token ID
 */
export async function getAgentTokenId(): Promise<bigint> {
  const contractAddress = config.IDENTITY_CONTRACT_ADDRESS;
  if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
    return 0n;
  }

  return await publicClient.readContract({
    address: contractAddress,
    abi: IDENTITY_ABI,
    functionName: "agentTokenId",
    args: [agentAccount.address],
  });
}

/**
 * Get recent on-chain actions for an agent
 */
export async function getRecentActions(
  tokenId: bigint,
  count: number = 10
): Promise<OnChainAction[]> {
  const contractAddress = config.IDENTITY_CONTRACT_ADDRESS;
  if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
    return [];
  }

  const actions = await publicClient.readContract({
    address: contractAddress,
    abi: IDENTITY_ABI,
    functionName: "getRecentActions",
    args: [tokenId, BigInt(count)],
  });

  return actions.map((a) => ({
    action: a.action,
    txHash: a.txHash as `0x${string}`,
    timestamp: a.timestamp,
    success: a.success,
  }));
}

/**
 * Ensure agent has an identity, minting one if needed
 */
export async function ensureIdentityExists(
  name: string = "Mantle AI Agent",
  agentType: string = "trading"
): Promise<bigint> {
  const existingId = await getAgentTokenId();
  if (existingId > 0n) {
    console.log(`[identity] Agent already has identity token #${existingId}`);
    return existingId;
  }

  console.log("[identity] No identity found, minting new one...");
  const { tokenId } = await mintAgentIdentity(name, agentType);
  return tokenId;
}
