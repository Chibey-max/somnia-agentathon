"use client";
import { useReadContract, useBalance, useAccount } from "wagmi";
import { formatEther, formatUnits } from "viem";

const WALLET_ABI = [
  {
    name: "paused",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getDailyRemaining",
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
    name: "getBalance",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "agent",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "guardian",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const IDENTITY_ABI = [
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
    name: "agentTokenId",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalIdentities",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const MANTLE_TOKENS = {
  MNT: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  METH: "0xcDA86A272531e8640cD7F1a92c01839911B90bb0" as `0x${string}`,
  USDY: "0x5bE26527e817998A7206475496fDE1E68957c5A9" as `0x${string}`,
} as const;

export function useWalletState(walletAddress?: `0x${string}`) {
  const { data: mntBalanceData, isLoading: mntLoading } = useBalance({
    address: walletAddress,
    query: { enabled: !!walletAddress },
  });

  const { data: isPaused, isLoading: pausedLoading } = useReadContract({
    address: walletAddress,
    abi: WALLET_ABI,
    functionName: "paused",
    query: { enabled: !!walletAddress },
  });

  const { data: agentAddress, isLoading: agentLoading } = useReadContract({
    address: walletAddress,
    abi: WALLET_ABI,
    functionName: "agent",
    query: { enabled: !!walletAddress },
  });

  const { data: guardianAddress, isLoading: guardianLoading } = useReadContract({
    address: walletAddress,
    abi: WALLET_ABI,
    functionName: "guardian",
    query: { enabled: !!walletAddress },
  });

  const { data: methBalanceRaw, isLoading: methLoading } = useReadContract({
    address: walletAddress,
    abi: WALLET_ABI,
    functionName: "getBalance",
    args: [MANTLE_TOKENS.METH],
    query: { enabled: !!walletAddress },
  });

  const { data: usdyBalanceRaw, isLoading: usdyLoading } = useReadContract({
    address: walletAddress,
    abi: WALLET_ABI,
    functionName: "getBalance",
    args: [MANTLE_TOKENS.USDY],
    query: { enabled: !!walletAddress },
  });

  return {
    mntBalance: mntBalanceData ? parseFloat(formatEther(mntBalanceData.value)).toFixed(4) : "0.0000",
    methBalance: methBalanceRaw !== undefined ? parseFloat(formatEther(methBalanceRaw as bigint)).toFixed(4) : "0.0000",
    usdyBalance: usdyBalanceRaw !== undefined ? parseFloat(formatUnits(usdyBalanceRaw as bigint, 18)).toFixed(2) : "0.00",
    isPaused: isPaused as boolean | undefined,
    agentAddress: agentAddress as `0x${string}` | undefined,
    guardianAddress: guardianAddress as `0x${string}` | undefined,
    isLoading: mntLoading || pausedLoading || agentLoading || guardianLoading || methLoading || usdyLoading,
  };
}

export function useSpendingLimits(walletAddress?: `0x${string}`, token?: `0x${string}`) {
  const { data: policyData, isLoading: policyLoading } = useReadContract({
    address: walletAddress,
    abi: WALLET_ABI,
    functionName: "tokenPolicies",
    args: token ? [token] : undefined,
    query: { enabled: !!walletAddress && !!token },
  });

  const { data: dailyRemainingRaw, isLoading: remainingLoading } = useReadContract({
    address: walletAddress,
    abi: WALLET_ABI,
    functionName: "getDailyRemaining",
    args: token ? [token] : undefined,
    query: { enabled: !!walletAddress && !!token },
  });

  if (!policyData) {
    return {
      perTxLimit: 0,
      dailyLimit: 0,
      dailySpent: 0,
      dailyRemaining: 0,
      isLoading: policyLoading || remainingLoading,
    };
  }

  const [perTxLimitRaw, dailyLimitRaw, dailySpentRaw] = policyData as [bigint, bigint, bigint, bigint, boolean];
  const decimals = token === MANTLE_TOKENS.USDY ? 18 : 18;

  const perTxLimit = parseFloat(formatUnits(perTxLimitRaw, decimals));
  const dailyLimit = parseFloat(formatUnits(dailyLimitRaw, decimals));
  const dailySpent = parseFloat(formatUnits(dailySpentRaw, decimals));
  const dailyRemaining = dailyRemainingRaw !== undefined
    ? parseFloat(formatUnits(dailyRemainingRaw as bigint, decimals))
    : Math.max(0, dailyLimit - dailySpent);

  return {
    perTxLimit,
    dailyLimit,
    dailySpent,
    dailyRemaining,
    isLoading: policyLoading || remainingLoading,
  };
}

export function useAgentIdentity(identityAddress?: `0x${string}`, agentAddress?: `0x${string}`) {
  const { data: tokenIdRaw, isLoading: tokenIdLoading } = useReadContract({
    address: identityAddress,
    abi: IDENTITY_ABI,
    functionName: "agentTokenId",
    args: agentAddress ? [agentAddress] : undefined,
    query: { enabled: !!identityAddress && !!agentAddress },
  });

  const tokenId = tokenIdRaw !== undefined ? Number(tokenIdRaw as bigint) : undefined;

  const { data: identityData, isLoading: identityLoading } = useReadContract({
    address: identityAddress,
    abi: IDENTITY_ABI,
    functionName: "getIdentity",
    args: tokenId !== undefined && tokenId > 0 ? [BigInt(tokenId)] : undefined,
    query: { enabled: !!identityAddress && tokenId !== undefined && tokenId > 0 },
  });

  if (!identityData) {
    return {
      tokenId: tokenId ?? 0,
      name: "",
      agentType: "",
      reputation: 0,
      actionCount: 0,
      lastActive: 0,
      isLoading: tokenIdLoading || identityLoading,
    };
  }

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

  return {
    tokenId: tokenId ?? 0,
    name: d.name,
    agentType: d.agentType,
    reputation: Number(d.reputation),
    actionCount: Number(d.actionCount),
    lastActive: Number(d.lastActive),
    isLoading: tokenIdLoading || identityLoading,
  };
}
