import { NextRequest, NextResponse } from "next/server";

const BYBIT_BASE = "https://api.bybit.com";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || "MNTUSDT";
  const interval = searchParams.get("interval") || "15";

  try {
    const [klinesRes, tickerRes] = await Promise.all([
      fetch(`${BYBIT_BASE}/v5/market/kline?category=spot&symbol=${symbol}&interval=${interval}&limit=50`),
      fetch(`${BYBIT_BASE}/v5/market/tickers?category=spot&symbol=${symbol}`),
    ]);

    const [klinesData, tickerData] = await Promise.all([
      klinesRes.json(),
      tickerRes.json(),
    ]);

    // Bybit kline format: [startTime, openPrice, highPrice, lowPrice, closePrice, volume, turnover]
    const rawKlines: string[][] = klinesData.result?.list || [];
    // Bybit returns newest first — reverse so chart is chronological
    const klines = [...rawKlines].reverse().map((k) => ({
      timestamp: Number(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));

    const tickerRaw = tickerData.result?.list?.[0] || {};
    const ticker = {
      symbol: tickerRaw.symbol || symbol,
      lastPrice: tickerRaw.lastPrice || "0",
      priceChange24h: tickerRaw.price24hPcnt
        ? (parseFloat(tickerRaw.price24hPcnt) * 100).toFixed(2)
        : "0",
      volume24h: tickerRaw.volume24h || "0",
      highPrice24h: tickerRaw.highPrice24h || "0",
      lowPrice24h: tickerRaw.lowPrice24h || "0",
    };

    return NextResponse.json({ klines, ticker });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch market data", detail: message },
      { status: 500 }
    );
  }
}
