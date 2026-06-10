import { NextRequest, NextResponse } from "next/server";

interface ToolCall {
  tool: string;
  result: unknown;
}

async function callContractAPI(address: string, baseUrl: string): Promise<unknown> {
  const res = await fetch(`${baseUrl}/api/contract?address=${address}`);
  if (!res.ok) return null;
  return res.json();
}

async function callIdentityAPI(contract: string, agent: string, baseUrl: string): Promise<unknown> {
  const res = await fetch(`${baseUrl}/api/identity?contract=${contract}&agent=${agent}`);
  if (!res.ok) return null;
  return res.json();
}

async function callTradingAPI(symbol: string, baseUrl: string): Promise<unknown> {
  const res = await fetch(`${baseUrl}/api/trading?symbol=${symbol}&interval=15`);
  if (!res.ok) return null;
  return res.json();
}

function formatBalance(data: Record<string, unknown>): string {
  const balances = data.balances as Record<string, string> | undefined;
  if (!balances) return "Could not fetch balance data.";
  const mnt = parseFloat(balances.MNT || "0").toFixed(4);
  const meth = parseFloat(balances.mETH || "0").toFixed(4);
  const usdy = parseFloat(balances.USDY || "0").toFixed(2);
  const paused = data.isPaused ? "⚠️ PAUSED" : "✓ Active";
  return `Your agent wallet on Mantle Sepolia (${data.address}):\n\n• **${mnt} MNT** (native)\n• **${meth} mETH**\n• **${usdy} USDY**\n\nWallet status: **${paused}**\nAgent: ${data.agentAddress || "not set"}\nGuardian: ${data.guardianAddress || "not set"}`;
}

function formatLimits(data: Record<string, unknown>): string {
  const policies = data.policies as Record<string, Record<string, string>> | undefined;
  if (!policies) return "Could not fetch limit data.";
  const lines = Object.entries(policies).map(([token, p]) => {
    const spent = parseFloat(p.dailySpent || "0").toFixed(4);
    const limit = parseFloat(p.dailyLimit || "0").toFixed(4);
    const remaining = parseFloat(p.dailyRemaining || "0").toFixed(4);
    const pct = limit === "0.0000" ? 0 : ((parseFloat(p.dailySpent || "0") / parseFloat(p.dailyLimit || "1")) * 100).toFixed(1);
    const warn = parseFloat(pct as string) > 80 ? " ⚠️ HIGH" : parseFloat(pct as string) > 50 ? " ⚡ MED" : "";
    return `**${token}:** ${spent}/${limit} used today (${pct}%)${warn} — per-tx: ${parseFloat(p.perTxLimit || "0").toFixed(4)}, remaining: ${remaining}`;
  });
  return `Current spending limits:\n\n${lines.join("\n")}`;
}

function formatIdentity(data: Record<string, unknown>): string {
  if (!data.hasIdentity) {
    return "No ERC-8004 identity found for this agent address. Mint one at the identity contract to establish an on-chain reputation.";
  }
  const lastActive = data.lastActive ? new Date(data.lastActive as string).toLocaleString() : "unknown";
  return `ERC-8004 On-Chain Identity:\n\n• **Token ID:** #${data.tokenId}\n• **Name:** ${data.name}\n• **Type:** ${data.agentType}\n• **Reputation:** ${data.reputation} / 1000\n• **Total Actions:** ${data.actionCount} recorded on-chain\n• **Status:** ${data.active ? "Active ✓" : "Inactive"}\n• **Last Active:** ${lastActive}`;
}

function formatMarketData(data: Record<string, unknown>, symbol: string): string {
  const ticker = data.ticker as Record<string, string> | undefined;
  const klines = data.klines as Array<{ close: number; volume: number }> | undefined;
  if (!ticker) return "Could not fetch market data.";
  const price = parseFloat(ticker.lastPrice || "0").toFixed(4);
  const change = ticker.priceChange24h || "0";
  const vol = parseFloat(ticker.volume24h || "0").toLocaleString(undefined, { maximumFractionDigits: 0 });
  const changeDir = parseFloat(change) >= 0 ? "+" : "";
  const recentClose = klines && klines.length > 0 ? klines[klines.length - 1].close.toFixed(4) : price;
  return `Market data for **${symbol}**:\n\n• **Price:** $${price}\n• **24h Change:** ${changeDir}${change}%\n• **24h Volume:** ${vol}\n• **Last candle close:** $${recentClose}\n\nData from Bybit v5 API (15-min interval, last 50 candles).`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, contractAddress, identityAddress } = body as {
      message: string;
      contractAddress?: string;
      identityAddress?: string;
    };

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "No message" }, { status: 400 });
    }

    const baseUrl = request.nextUrl.origin;
    const lower = message.toLowerCase();
    const toolCalls: ToolCall[] = [];
    let response = "";

    if (lower.includes("balance") || lower.includes("wallet") || (lower.includes("mnt") && !lower.includes("market"))) {
      const addr = contractAddress || "";
      if (!addr) {
        response = "No contract address configured. Please set your Agent Wallet Contract Address in the config panel above.";
      } else {
        const data = await callContractAPI(addr, baseUrl) as Record<string, unknown> | null;
        toolCalls.push({ tool: "get_wallet_state", result: data });
        response = data ? formatBalance(data) : "Failed to read wallet contract. Ensure the address is correct and deployed on Mantle Sepolia.";
      }
    } else if (lower.includes("limit") || lower.includes("spend") || lower.includes("policy")) {
      const addr = contractAddress || "";
      if (!addr) {
        response = "No contract address configured. Please set your Agent Wallet Contract Address in the config panel above.";
      } else {
        const data = await callContractAPI(addr, baseUrl) as Record<string, unknown> | null;
        toolCalls.push({ tool: "check_spending_limits", result: data });
        response = data ? formatLimits(data) : "Failed to read spending limits from contract.";
      }
    } else if (lower.includes("identity") || lower.includes("reputation") || lower.includes("erc-8004")) {
      if (!identityAddress || !contractAddress) {
        response = "Identity or wallet contract address not configured. Please set both in the config panel.";
      } else {
        const contractData = await callContractAPI(contractAddress, baseUrl) as Record<string, string> | null;
        const agentAddr = contractData?.agentAddress || "";
        if (!agentAddr) {
          response = "Could not determine agent address from wallet contract.";
        } else {
          const data = await callIdentityAPI(identityAddress, agentAddr, baseUrl) as Record<string, unknown> | null;
          toolCalls.push({ tool: "get_agent_identity", result: data });
          response = data ? formatIdentity(data) : "Failed to read identity contract.";
        }
      }
    } else if (lower.includes("market") || lower.includes("price") || lower.includes("mntusdt") || lower.includes("trading") || lower.includes("chart")) {
      const sym = lower.includes("eth") ? "ETHUSDT" : lower.includes("btc") ? "BTCUSDT" : "MNTUSDT";
      const data = await callTradingAPI(sym, baseUrl) as Record<string, unknown> | null;
      toolCalls.push({ tool: "get_market_data", result: { symbol: sym } });
      response = data ? formatMarketData(data, sym) : "Failed to fetch market data from Bybit.";
    } else if (lower.includes("help") || lower.includes("what can") || lower.includes("commands")) {
      response = "I am the Mantle AI Agent. Here is what I can do:\n\n• **Check my balance** — reads live MNT, mETH, USDY from your wallet contract\n• **What are my limits?** — shows per-tx and daily spending limits\n• **Show my identity** — reads your ERC-8004 on-chain identity and reputation\n• **Get MNT market data** — fetches live price and klines from Bybit\n\nTo use live data, configure your contract addresses in the panel above.";
    } else {
      response = "I received your message. To execute on Mantle Sepolia I would: (1) verify spending limits, (2) check whitelist status, (3) execute the transaction, (4) record the action via ERC-8004.\n\nTry: 'Check my balance', 'What are my limits?', 'Show my identity', or 'Get MNT market data'.";
    }

    return NextResponse.json({ response, toolCalls });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Internal server error", detail: message }, { status: 500 });
  }
}
