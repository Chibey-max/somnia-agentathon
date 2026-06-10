import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, defineChain } from "viem";

const mantleSepolia = defineChain({
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.sepolia.mantle.xyz"] },
    public: { http: ["https://rpc.sepolia.mantle.xyz"] },
  },
  blockExplorers: {
    default: { name: "Mantle Sepolia Explorer", url: "https://explorer.sepolia.mantle.xyz" },
  },
});

const client = createPublicClient({
  chain: mantleSepolia,
  transport: http("https://rpc.sepolia.mantle.xyz"),
});

const IDENTITY_ABI = [
  {
    name: "agentTokenId",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getIdentity",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "agentAddress", type: "address" },
          { name: "name", type: "string" },
          { name: "agentType", type: "string" },
          { name: "reputation", type: "uint256" },
          { name: "actionCount", type: "uint256" },
          { name: "createdAt", type: "uint256" },
          { name: "lastActive", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getRecentActions",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "count", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "actionType", type: "string" },
          { name: "description", type: "string" },
          { name: "txHash", type: "bytes32" },
          { name: "timestamp", type: "uint256" },
          { name: "success", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "totalIdentities",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentAddress = searchParams.get("agent") as `0x${string}` | null;
  const identityContract = searchParams.get("contract") as `0x${string}` | null;

  if (!agentAddress || !identityContract) {
    return NextResponse.json(
      { error: "agent and contract parameters required" },
      { status: 400 }
    );
  }

  try {
    const tokenIdRaw = await client.readContract({
      address: identityContract,
      abi: IDENTITY_ABI,
      functionName: "agentTokenId",
      args: [agentAddress],
    });

    const tokenId = Number(tokenIdRaw);

    if (tokenId === 0) {
      return NextResponse.json({
        hasIdentity: false,
        tokenId: 0,
        agentAddress,
        actions: [],
      });
    }

    const [identityData, actionsData] = await Promise.all([
      client.readContract({
        address: identityContract,
        abi: IDENTITY_ABI,
        functionName: "getIdentity",
        args: [BigInt(tokenId)],
      }),
      client
        .readContract({
          address: identityContract,
          abi: IDENTITY_ABI,
          functionName: "getRecentActions",
          args: [BigInt(tokenId), 10n],
        })
        .catch(() => []),
    ]);

    const d = identityData as {
      agentAddress: `0x${string}`;
      name: string;
      agentType: string;
      reputation: bigint;
      actionCount: bigint;
      createdAt: bigint;
      lastActive: bigint;
      active: boolean;
    };

    const actions = (actionsData as Array<{
      actionType: string;
      description: string;
      txHash: `0x${string}`;
      timestamp: bigint;
      success: boolean;
    }>).map((a) => ({
      actionType: a.actionType,
      description: a.description,
      txHash: a.txHash,
      timestamp: Number(a.timestamp),
      success: a.success,
    }));

    return NextResponse.json({
      hasIdentity: true,
      tokenId,
      name: d.name,
      agentType: d.agentType,
      reputation: Number(d.reputation),
      actionCount: Number(d.actionCount),
      createdAt: new Date(Number(d.createdAt) * 1000).toISOString(),
      lastActive: new Date(Number(d.lastActive) * 1000).toISOString(),
      agentAddress: d.agentAddress,
      active: d.active,
      actions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch identity", detail: message },
      { status: 500 }
    );
  }
}
