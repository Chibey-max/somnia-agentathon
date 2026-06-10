import { parseEther, formatEther, parseAbi, encodeFunctionData } from "viem";
import { publicClient, walletClient } from "../account";
import { config } from "../env";
import { TradeDecision } from "./quant-strategy";
import { assessRisk } from "./risk-manager";
import { bybitClient } from "./bybit-client";

const VAULT_ABI = parseAbi([
  "function openPosition(address token, uint256 size, uint256 entryPrice, bool isLong, string calldata strategy) external returns (bytes32)",
  "function closePosition(bytes32 positionId, uint256 exitPrice) external",
  "function updatePnl(int256 delta) external",
  "function getVaultBalances() external view returns (uint256 mntBalance, uint256 methBalance)",
  "function dailyPnl() external view returns (int256)",
  "function tradingHalted() external view returns (bool)",
  "function getOpenPositions() external view returns (bytes32[])",
  "function getPosition(bytes32 positionId) external view returns (tuple(address token, uint256 size, uint256 entryPrice, uint256 openedAt, bool isLong, bool open, string strategy))",
]);

export interface ExecutionResult {
  executed: boolean;
  positionId?: `0x${string}`;
  txHash?: `0x${string}`;
  reason: string;
  size: number;
}

/**
 * Execute a trading strategy on-chain via TradingVault
 * Runs full risk checks before execution
 */
export async function executeOnChainTrade(
  decision: TradeDecision,
  symbol: string,
  tokenAddress: `0x${string}`
): Promise<ExecutionResult> {
  const vaultAddr = config.TRADING_VAULT_ADDRESS;
  if (!vaultAddr || vaultAddr === "0x0000000000000000000000000000000000000000") {
    return { executed: false, reason: "TradingVault not configured", size: 0 };
  }

  // Check if trading is halted
  const halted = await publicClient.readContract({
    address: vaultAddr,
    abi: VAULT_ABI,
    functionName: "tradingHalted",
    args: [],
  });

  if (halted) {
    return { executed: false, reason: "Trading halted by vault", size: 0 };
  }

  // Get current vault balances and daily PnL
  const [balances, dailyPnlRaw] = await Promise.all([
    publicClient.readContract({
      address: vaultAddr,
      abi: VAULT_ABI,
      functionName: "getVaultBalances",
      args: [],
    }),
    publicClient.readContract({
      address: vaultAddr,
      abi: VAULT_ABI,
      functionName: "dailyPnl",
      args: [],
    }),
  ]);

  const mntBalance = parseFloat(formatEther(balances[0]));
  const dailyPnl = parseFloat(formatEther(dailyPnlRaw));

  // Risk assessment
  const risk = assessRisk(decision, mntBalance, dailyPnl);

  if (!risk.approved) {
    return {
      executed: false,
      reason: `Risk check failed: ${risk.summary}`,
      size: risk.recommendedSize,
    };
  }

  // Execute the position on-chain
  const entryPriceWei = parseEther(decision.currentPrice.toString());
  const sizeWei = parseEther(risk.recommendedSize.toString());

  const txHash = await walletClient.writeContract({
    address: vaultAddr,
    abi: VAULT_ABI,
    functionName: "openPosition",
    args: [
      tokenAddress,
      sizeWei,
      entryPriceWei,
      decision.signal === "BUY",
      `${symbol} ${decision.signal} — RSI:${decision.rsi.toFixed(1)} ${decision.reason.slice(0, 50)}`,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status !== "success") {
    return { executed: false, reason: "Transaction reverted", size: risk.recommendedSize };
  }

  // Extract position ID from logs
  const log = receipt.logs[0];
  const positionId = log?.topics[1] as `0x${string}` | undefined;

  return {
    executed: true,
    positionId,
    txHash,
    reason: risk.summary,
    size: risk.recommendedSize,
  };
}

/**
 * Run a complete AI trading cycle: fetch data → analyze → risk check → execute
 */
export async function runTradingCycle(
  symbol: string = "MNTUSDT",
  tokenAddress: `0x${string}` = "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8"
): Promise<{ decision: TradeDecision; execution: ExecutionResult }> {
  // Fetch market data from Bybit
  const [ticker, klines] = await Promise.all([
    bybitClient.getTicker(symbol),
    bybitClient.getKlines(symbol, "60", 100),
  ]);

  const { generateTradeDecision } = await import("./quant-strategy");

  // Get vault balances for wallet state
  let mntBalance = 0;
  try {
    const vaultAddr = config.TRADING_VAULT_ADDRESS;
    if (vaultAddr && vaultAddr !== "0x0000000000000000000000000000000000000000") {
      const balances = await publicClient.readContract({
        address: vaultAddr,
        abi: VAULT_ABI,
        functionName: "getVaultBalances",
        args: [],
      });
      mntBalance = parseFloat(formatEther(balances[0]));
    }
  } catch {
    mntBalance = 0;
  }

  const decision = generateTradeDecision(
    {
      symbol,
      klines,
      currentPrice: parseFloat(ticker.lastPrice),
    },
    { mntBalance, totalValueUsd: mntBalance * parseFloat(ticker.lastPrice) }
  );

  const execution = await executeOnChainTrade(decision, symbol, tokenAddress);

  return { decision, execution };
}
