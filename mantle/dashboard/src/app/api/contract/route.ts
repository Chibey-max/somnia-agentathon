import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, defineChain, formatEther, formatUnits, encodeFunctionData, decodeFunctionResult } from "viem";

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

const WALLET_ABI = [
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { name: "agent", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { name: "guardian", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  {
    name: "getBalance",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "tokenPolicies",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "perTxLimit", type: "uint256" },
      { name: "dailyLimit", type: "uint256" },
      { name: "dailySpent", type: "uint256" },
      { name: "lastResetTime", type: "uint256" },
      { name: "enabled", type: "bool" },
    ],
  },
  {
    name: "getDailyRemaining",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const METH_TOKEN = "0xcDA86A272531e8640cD7F1a92c01839911B90bb0" as `0x${string}`;
const USDY_TOKEN = "0x5bE26527e817998A7206475496fDE1E68957c5A9" as `0x${string}`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get("address") as `0x${string}` | null;

  if (!walletAddress) {
    return NextResponse.json({ error: "address parameter required" }, { status: 400 });
  }

  try {
    const [
      mntBalanceWei,
      isPaused,
      agentAddr,
      guardianAddr,
      methBalance,
      usdyBalance,
      mntPolicy,
      methPolicy,
      usdyPolicy,
      mntRemaining,
      methRemaining,
      usdyRemaining,
    ] = await Promise.all([
      client.getBalance({ address: walletAddress }),
      client.readContract({ address: walletAddress, abi: WALLET_ABI, functionName: "paused" }).catch(() => false),
      client.readContract({ address: walletAddress, abi: WALLET_ABI, functionName: "agent" }).catch(() => null),
      client.readContract({ address: walletAddress, abi: WALLET_ABI, functionName: "guardian" }).catch(() => null),
      client.readContract({ address: walletAddress, abi: WALLET_ABI, functionName: "getBalance", args: [METH_TOKEN] }).catch(() => 0n),
      client.readContract({ address: walletAddress, abi: WALLET_ABI, functionName: "getBalance", args: [USDY_TOKEN] }).catch(() => 0n),
      client.readContract({ address: walletAddress, abi: WALLET_ABI, functionName: "tokenPolicies", args: ["0x0000000000000000000000000000000000000000"] }).catch(() => null),
      client.readContract({ address: walletAddress, abi: WALLET_ABI, functionName: "tokenPolicies", args: [METH_TOKEN] }).catch(() => null),
      client.readContract({ address: walletAddress, abi: WALLET_ABI, functionName: "tokenPolicies", args: [USDY_TOKEN] }).catch(() => null),
      client.readContract({ address: walletAddress, abi: WALLET_ABI, functionName: "getDailyRemaining", args: ["0x0000000000000000000000000000000000000000"] }).catch(() => 0n),
      client.readContract({ address: walletAddress, abi: WALLET_ABI, functionName: "getDailyRemaining", args: [METH_TOKEN] }).catch(() => 0n),
      client.readContract({ address: walletAddress, abi: WALLET_ABI, functionName: "getDailyRemaining", args: [USDY_TOKEN] }).catch(() => 0n),
    ]);

    function formatPolicy(policy: readonly [bigint, bigint, bigint, bigint, boolean] | null, decimals: number) {
      if (!policy) return { perTxLimit: "0", dailyLimit: "0", dailySpent: "0", enabled: false };
      return {
        perTxLimit: formatUnits(policy[0], decimals),
        dailyLimit: formatUnits(policy[1], decimals),
        dailySpent: formatUnits(policy[2], decimals),
        enabled: policy[4],
      };
    }

    return NextResponse.json({
      address: walletAddress,
      chainId: 5003,
      network: "Mantle Sepolia",
      balances: {
        MNT: formatEther(mntBalanceWei),
        mETH: formatEther(methBalance as bigint),
        USDY: formatUnits(usdyBalance as bigint, 18),
      },
      isPaused,
      agentAddress: agentAddr,
      guardianAddress: guardianAddr,
      policies: {
        MNT: { ...formatPolicy(mntPolicy as readonly [bigint, bigint, bigint, bigint, boolean] | null, 18), dailyRemaining: formatEther(mntRemaining as bigint) },
        mETH: { ...formatPolicy(methPolicy as readonly [bigint, bigint, bigint, bigint, boolean] | null, 18), dailyRemaining: formatEther(methRemaining as bigint) },
        USDY: { ...formatPolicy(usdyPolicy as readonly [bigint, bigint, bigint, bigint, boolean] | null, 18), dailyRemaining: formatUnits(usdyRemaining as bigint, 18) },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to fetch contract state", detail: message }, { status: 500 });
  }
}
