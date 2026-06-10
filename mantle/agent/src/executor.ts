import { parseEther, parseUnits, formatEther, formatUnits, parseAbi, isAddress } from "viem";
import { publicClient, walletClient, agentAccount } from "./account";
import { config } from "./env";
import { MANTLE_TOKENS } from "./tools";
import { getAgentTokenId, getAgentProfile, recordOnChainAction, getRecentActions } from "./identity";

// ─── Contract ABIs ─────────────────────────────────────────────────────────────
const WALLET_ABI = parseAbi([
  "function transferMNT(address payable to, uint256 amount) external",
  "function transferToken(address token, address to, uint256 amount) external",
  "function getDailyRemaining(address token) external view returns (uint256)",
  "function tokenPolicies(address token) external view returns (uint256 perTxLimit, uint256 dailyLimit, uint256 dailySpent, uint256 dayStart, bool enabled)",
  "function whitelist(address target) external view returns (bool)",
  "function paused() external view returns (bool)",
  "function getBalance(address token) external view returns (uint256)",
  "function agent() external view returns (address)",
  "function guardian() external view returns (address)",
]);

const VAULT_ABI = parseAbi([
  "function executeStrategy(address target, bytes calldata data, uint256 amount, string calldata strategyName) external returns (bytes)",
  "function openPosition(address token, uint256 size, uint256 entryPrice, bool isLong, string calldata strategy) external returns (bytes32)",
  "function getOpenPositions() external view returns (bytes32[])",
  "function getPosition(bytes32 positionId) external view returns (tuple(address token, uint256 size, uint256 entryPrice, uint256 openedAt, bool isLong, bool open, string strategy))",
  "function dailyPnl() external view returns (int256)",
  "function tradingHalted() external view returns (bool)",
  "function getVaultBalances() external view returns (uint256 mntBalance, uint256 methBalance)",
]);

const ERC20_ABI = parseAbi([
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
]);

// ─── Tool Executor ─────────────────────────────────────────────────────────────

export type ToolResult =
  | { success: true; data: unknown }
  | { success: false; error: string };

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case "get_wallet_state":
        return await getWalletState();
      case "transfer_mnt":
        return await transferMNT(args.to as string, args.amount as string);
      case "transfer_token":
        return await transferToken(
          args.token as string,
          args.to as string,
          args.amount as string
        );
      case "get_tx_status":
        return await getTxStatus(args.txHash as `0x${string}`);
      case "check_limits":
        return await checkLimits(args.token as string | undefined);
      case "check_whitelist":
        return await checkWhitelist(args.address as string);
      case "get_agent_identity":
        return await getAgentIdentity(args.tokenId as number | undefined);
      case "record_action":
        return await recordAction(args.action as string, args.txHash as `0x${string}` | undefined);
      case "execute_trade":
        return await executeTrade(
          args.strategyName as string,
          args.target as string,
          args.calldata as string,
          args.amountMnt as string | undefined
        );
      case "get_trading_positions":
        return await getTradingPositions();
      case "get_yield_rate":
        return await getYieldRate();
      case "get_transaction_history":
        return await getTransactionHistory(args.limit as number | undefined);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ─── Individual Tool Implementations ──────────────────────────────────────────

async function getWalletState(): Promise<ToolResult> {
  const walletAddr = config.AGENT_CONTRACT_ADDRESS;

  const [mntBalance, methBalance, usdyBalance, isPaused] = await Promise.all([
    publicClient.getBalance({ address: walletAddr }),
    publicClient.readContract({
      address: walletAddr,
      abi: WALLET_ABI,
      functionName: "getBalance",
      args: [MANTLE_TOKENS.METH],
    }),
    publicClient.readContract({
      address: walletAddr,
      abi: WALLET_ABI,
      functionName: "getBalance",
      args: [MANTLE_TOKENS.USDY],
    }),
    publicClient.readContract({
      address: walletAddr,
      abi: WALLET_ABI,
      functionName: "paused",
      args: [],
    }),
  ]);

  const tokenId = await getAgentTokenId();

  return {
    success: true,
    data: {
      address: walletAddr,
      balances: {
        MNT: formatEther(mntBalance),
        mETH: formatEther(methBalance),
        USDY: formatUnits(usdyBalance, 18),
      },
      paused: isPaused,
      agentAddress: agentAccount.address,
      identityTokenId: tokenId.toString(),
      chainId: config.CHAIN_ID,
      network: "Mantle Mainnet",
    },
  };
}

async function transferMNT(to: string, amount: string): Promise<ToolResult> {
  if (!isAddress(to)) return { success: false, error: "Invalid recipient address" };

  const amountWei = parseEther(amount);

  const txHash = await walletClient.writeContract({
    address: config.AGENT_CONTRACT_ADDRESS,
    abi: WALLET_ABI,
    functionName: "transferMNT",
    args: [to as `0x${string}`, amountWei],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    success: receipt.status === "success",
    data: {
      txHash,
      to,
      amount,
      token: "MNT",
      gasUsed: receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber.toString(),
    },
  };
}

async function transferToken(
  token: string,
  to: string,
  amount: string
): Promise<ToolResult> {
  if (!isAddress(to)) return { success: false, error: "Invalid recipient address" };

  let tokenAddress: `0x${string}`;
  let decimals = 18;

  if (token === "METH") {
    tokenAddress = MANTLE_TOKENS.METH;
  } else if (token === "USDY") {
    tokenAddress = MANTLE_TOKENS.USDY;
  } else if (isAddress(token)) {
    tokenAddress = token as `0x${string}`;
    decimals = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "decimals",
      args: [],
    });
  } else {
    return { success: false, error: `Unknown token: ${token}` };
  }

  const amountUnits = parseUnits(amount, decimals);

  const txHash = await walletClient.writeContract({
    address: config.AGENT_CONTRACT_ADDRESS,
    abi: WALLET_ABI,
    functionName: "transferToken",
    args: [tokenAddress, to as `0x${string}`, amountUnits],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    success: receipt.status === "success",
    data: { txHash, to, amount, token, gasUsed: receipt.gasUsed.toString() },
  };
}

async function getTxStatus(txHash: `0x${string}`): Promise<ToolResult> {
  const [receipt, tx] = await Promise.all([
    publicClient.getTransactionReceipt({ hash: txHash }).catch(() => null),
    publicClient.getTransaction({ hash: txHash }).catch(() => null),
  ]);

  if (!tx) return { success: false, error: "Transaction not found" };

  return {
    success: true,
    data: {
      txHash,
      status: receipt ? (receipt.status === "success" ? "confirmed" : "failed") : "pending",
      blockNumber: receipt?.blockNumber?.toString() || "pending",
      gasUsed: receipt?.gasUsed?.toString() || "0",
      from: tx.from,
      to: tx.to,
      value: formatEther(tx.value),
    },
  };
}

async function checkLimits(token?: string): Promise<ToolResult> {
  const walletAddr = config.AGENT_CONTRACT_ADDRESS;

  const tokenMap: Record<string, `0x${string}`> = {
    MNT: "0x0000000000000000000000000000000000000000",
    METH: MANTLE_TOKENS.METH,
    USDY: MANTLE_TOKENS.USDY,
  };

  const tokensToCheck = token ? [token] : ["MNT", "METH", "USDY"];
  const results: Record<string, unknown> = {};

  for (const sym of tokensToCheck) {
    const addr = tokenMap[sym];
    if (!addr) continue;

    const [policy, remaining] = await Promise.all([
      publicClient.readContract({
        address: walletAddr,
        abi: WALLET_ABI,
        functionName: "tokenPolicies",
        args: [addr],
      }),
      publicClient.readContract({
        address: walletAddr,
        abi: WALLET_ABI,
        functionName: "getDailyRemaining",
        args: [addr],
      }),
    ]);

    results[sym] = {
      perTxLimit: formatEther(policy[0]),
      dailyLimit: formatEther(policy[1]),
      dailySpent: formatEther(policy[2]),
      dailyRemaining: formatEther(remaining),
      enabled: policy[4],
    };
  }

  return { success: true, data: results };
}

async function checkWhitelist(address: string): Promise<ToolResult> {
  if (!isAddress(address)) return { success: false, error: "Invalid address" };

  const isWhitelisted = await publicClient.readContract({
    address: config.AGENT_CONTRACT_ADDRESS,
    abi: WALLET_ABI,
    functionName: "whitelist",
    args: [address as `0x${string}`],
  });

  return { success: true, data: { address, whitelisted: isWhitelisted } };
}

async function getAgentIdentity(tokenId?: number): Promise<ToolResult> {
  const id = tokenId ? BigInt(tokenId) : await getAgentTokenId();

  if (id === 0n) {
    return {
      success: true,
      data: { hasIdentity: false, message: "Agent has no identity NFT yet. Use mintIdentity." },
    };
  }

  const [profile, recentActions] = await Promise.all([
    getAgentProfile(id),
    getRecentActions(id, 5),
  ]);

  return {
    success: true,
    data: {
      hasIdentity: true,
      tokenId: id.toString(),
      name: profile.name,
      agentType: profile.agentType,
      reputation: profile.reputation.toString(),
      actionCount: profile.actionCount.toString(),
      createdAt: new Date(Number(profile.createdAt) * 1000).toISOString(),
      lastActive: new Date(Number(profile.lastActive) * 1000).toISOString(),
      agentAddress: profile.agentAddress,
      active: profile.active,
      recentActions: recentActions.map((a) => ({
        action: a.action,
        txHash: a.txHash,
        timestamp: new Date(Number(a.timestamp) * 1000).toISOString(),
        success: a.success,
      })),
    },
  };
}

async function recordAction(
  action: string,
  txHash?: `0x${string}`
): Promise<ToolResult> {
  const tokenId = await getAgentTokenId();
  if (tokenId === 0n) {
    return { success: false, error: "Agent has no identity NFT. Mint one first." };
  }

  const recordTxHash = await recordOnChainAction(tokenId, action, txHash);

  return {
    success: true,
    data: {
      recorded: true,
      action,
      tokenId: tokenId.toString(),
      recordTxHash,
    },
  };
}

async function executeTrade(
  strategyName: string,
  target: string,
  calldata: string,
  amountMnt?: string
): Promise<ToolResult> {
  if (!isAddress(target)) return { success: false, error: "Invalid target address" };

  const vaultAddr = config.TRADING_VAULT_ADDRESS;
  if (!vaultAddr || vaultAddr === "0x0000000000000000000000000000000000000000") {
    return { success: false, error: "TRADING_VAULT_ADDRESS not configured" };
  }

  const amount = amountMnt ? parseEther(amountMnt) : 0n;

  const txHash = await walletClient.writeContract({
    address: vaultAddr,
    abi: VAULT_ABI,
    functionName: "executeStrategy",
    args: [target as `0x${string}`, calldata as `0x${string}`, amount, strategyName],
    value: amount,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    success: receipt.status === "success",
    data: {
      txHash,
      strategyName,
      target,
      amountMnt: amountMnt || "0",
      gasUsed: receipt.gasUsed.toString(),
    },
  };
}

async function getTradingPositions(): Promise<ToolResult> {
  const vaultAddr = config.TRADING_VAULT_ADDRESS;
  if (!vaultAddr || vaultAddr === "0x0000000000000000000000000000000000000000") {
    return { success: false, error: "TRADING_VAULT_ADDRESS not configured" };
  }

  const [positionIds, dailyPnl, halted, balances] = await Promise.all([
    publicClient.readContract({
      address: vaultAddr,
      abi: VAULT_ABI,
      functionName: "getOpenPositions",
      args: [],
    }),
    publicClient.readContract({
      address: vaultAddr,
      abi: VAULT_ABI,
      functionName: "dailyPnl",
      args: [],
    }),
    publicClient.readContract({
      address: vaultAddr,
      abi: VAULT_ABI,
      functionName: "tradingHalted",
      args: [],
    }),
    publicClient.readContract({
      address: vaultAddr,
      abi: VAULT_ABI,
      functionName: "getVaultBalances",
      args: [],
    }),
  ]);

  const positions = await Promise.all(
    (positionIds as `0x${string}`[]).map(async (id) => {
      const pos = await publicClient.readContract({
        address: vaultAddr,
        abi: VAULT_ABI,
        functionName: "getPosition",
        args: [id],
      });
      return {
        id,
        token: pos.token,
        size: formatEther(pos.size),
        entryPrice: formatEther(pos.entryPrice),
        openedAt: new Date(Number(pos.openedAt) * 1000).toISOString(),
        isLong: pos.isLong,
        strategy: pos.strategy,
      };
    })
  );

  return {
    success: true,
    data: {
      positions,
      dailyPnl: formatEther(dailyPnl),
      tradingHalted: halted,
      vaultBalances: {
        MNT: formatEther(balances[0]),
        mETH: formatEther(balances[1]),
      },
    },
  };
}

async function getYieldRate(): Promise<ToolResult> {
  // Query mETH staking contract for current APY
  // Mantle LSP staking: https://meth.mantle.xyz
  try {
    const response = await fetch("https://meth.mantle.xyz/api/v1/stats").catch(() => null);
    if (response && response.ok) {
      const data = await response.json();
      return {
        success: true,
        data: {
          protocol: "Mantle LSP (mETH)",
          apy: data.apy || "N/A",
          totalStaked: data.totalStaked || "N/A",
          source: "https://meth.mantle.xyz",
        },
      };
    }
  } catch {
    // Fall through to estimate
  }

  // Fallback: return known approximate rate
  return {
    success: true,
    data: {
      protocol: "Mantle LSP (mETH)",
      apy: "~4.5%",
      note: "Approximate rate — live data unavailable",
      source: "https://meth.mantle.xyz",
    },
  };
}

async function getTransactionHistory(limit: number = 10): Promise<ToolResult> {
  const walletAddr = config.AGENT_CONTRACT_ADDRESS;

  try {
    // Use Mantle Explorer API
    const url = `https://explorer.mantle.xyz/api?module=account&action=txlist&address=${walletAddr}&page=1&offset=${limit}&sort=desc`;
    const response = await fetch(url).catch(() => null);

    if (response && response.ok) {
      const data = await response.json();
      const txs = (data.result || []).slice(0, limit).map((tx: Record<string, string>) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: formatEther(BigInt(tx.value || "0")),
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        status: tx.txreceipt_status === "1" ? "success" : "failed",
        gasUsed: tx.gasUsed,
      }));
      return { success: true, data: { transactions: txs, address: walletAddr } };
    }
  } catch {
    // Fall through
  }

  return {
    success: true,
    data: {
      transactions: [],
      address: walletAddr,
      note: "Could not fetch transaction history from explorer",
    },
  };
}
