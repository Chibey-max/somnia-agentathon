import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import { config } from "../env";

const BASE_URL = "https://api.bybit.com";

export interface Ticker {
  symbol: string;
  lastPrice: string;
  highPrice24h: string;
  lowPrice24h: string;
  volume24h: string;
  priceChangePercent: string;
  bid1Price: string;
  ask1Price: string;
}

export interface Kline {
  startTime: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  volume: number;
  turnover: number;
}

export interface OrderbookLevel {
  price: string;
  size: string;
}

export interface Orderbook {
  symbol: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  timestamp: number;
}

export interface AccountBalance {
  coin: string;
  walletBalance: string;
  availableBalance: string;
  unrealisedPnl: string;
}

class BybitClient {
  private http: AxiosInstance;
  private apiKey: string;
  private apiSecret: string;
  private recvWindow = 5000;

  constructor() {
    this.apiKey = config.BYBIT_API_KEY;
    this.apiSecret = config.BYBIT_API_SECRET;

    this.http = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // ─── Signature for private endpoints ──────────────────────────────────────

  private sign(params: Record<string, string | number>): string {
    const timestamp = Date.now();
    const queryString = Object.entries({ ...params, timestamp, api_key: this.apiKey })
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");

    return crypto
      .createHmac("sha256", this.apiSecret)
      .update(queryString)
      .digest("hex");
  }

  private getSignedParams(params: Record<string, string | number>): Record<string, string | number> {
    const timestamp = Date.now();
    const combined = { ...params, timestamp, api_key: this.apiKey, recv_window: this.recvWindow };
    const signature = this.sign(params);
    return { ...combined, sign: signature };
  }

  // ─── Public Endpoints ──────────────────────────────────────────────────────

  /**
   * Get ticker data for a symbol
   */
  async getTicker(symbol: string): Promise<Ticker> {
    const response = await this.http.get("/v5/market/tickers", {
      params: { category: "spot", symbol },
    });

    const data = response.data;
    if (data.retCode !== 0) {
      throw new Error(`Bybit error: ${data.retMsg}`);
    }

    const ticker = data.result.list[0];
    if (!ticker) throw new Error(`No ticker data for ${symbol}`);

    return {
      symbol: ticker.symbol,
      lastPrice: ticker.lastPrice,
      highPrice24h: ticker.highPrice24h,
      lowPrice24h: ticker.lowPrice24h,
      volume24h: ticker.volume24h,
      priceChangePercent: ticker.price24hPcnt,
      bid1Price: ticker.bid1Price,
      ask1Price: ticker.ask1Price,
    };
  }

  /**
   * Get candlestick (kline) data
   */
  async getKlines(
    symbol: string,
    interval: "1" | "5" | "15" | "30" | "60" | "240" | "D" = "60",
    limit: number = 200
  ): Promise<Kline[]> {
    const response = await this.http.get("/v5/market/kline", {
      params: { category: "spot", symbol, interval, limit },
    });

    const data = response.data;
    if (data.retCode !== 0) {
      throw new Error(`Bybit error: ${data.retMsg}`);
    }

    return (data.result.list as string[][]).map((item) => ({
      startTime: parseInt(item[0]),
      openPrice: parseFloat(item[1]),
      highPrice: parseFloat(item[2]),
      lowPrice: parseFloat(item[3]),
      closePrice: parseFloat(item[4]),
      volume: parseFloat(item[5]),
      turnover: parseFloat(item[6]),
    })).reverse(); // Bybit returns newest first
  }

  /**
   * Get order book depth
   */
  async getOrderbook(symbol: string, limit: number = 25): Promise<Orderbook> {
    const response = await this.http.get("/v5/market/orderbook", {
      params: { category: "spot", symbol, limit },
    });

    const data = response.data;
    if (data.retCode !== 0) {
      throw new Error(`Bybit error: ${data.retMsg}`);
    }

    const result = data.result;
    return {
      symbol,
      bids: result.b.map(([price, size]: [string, string]) => ({ price, size })),
      asks: result.a.map(([price, size]: [string, string]) => ({ price, size })),
      timestamp: parseInt(result.ts),
    };
  }

  // ─── Private Endpoints (require API key) ──────────────────────────────────

  /**
   * Get account balances (unified trading account)
   */
  async getAccountBalance(): Promise<AccountBalance[]> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error("BYBIT_API_KEY and BYBIT_API_SECRET required for account data");
    }

    const timestamp = Date.now();
    const params = {
      accountType: "UNIFIED",
      timestamp: timestamp.toString(),
      api_key: this.apiKey,
      recv_window: this.recvWindow.toString(),
    };

    const paramStr = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");

    const signature = crypto
      .createHmac("sha256", this.apiSecret)
      .update(`${timestamp}${this.apiKey}${this.recvWindow}${paramStr}`)
      .digest("hex");

    const response = await this.http.get("/v5/account/wallet-balance", {
      params: { accountType: "UNIFIED" },
      headers: {
        "X-BAPI-API-KEY": this.apiKey,
        "X-BAPI-SIGN": signature,
        "X-BAPI-SIGN-MSG-HASH": "SHA256",
        "X-BAPI-TIMESTAMP": timestamp.toString(),
        "X-BAPI-RECV-WINDOW": this.recvWindow.toString(),
      },
    });

    const data = response.data;
    if (data.retCode !== 0) {
      throw new Error(`Bybit error: ${data.retMsg}`);
    }

    const coins = data.result.list[0]?.coin || [];
    return coins
      .filter((c: Record<string, string>) => parseFloat(c.walletBalance) > 0)
      .map((c: Record<string, string>) => ({
        coin: c.coin,
        walletBalance: c.walletBalance,
        availableBalance: c.availableToWithdraw,
        unrealisedPnl: c.unrealisedPnl || "0",
      }));
  }

  /**
   * Check if the client is configured with API keys
   */
  hasCredentials(): boolean {
    return !!(this.apiKey && this.apiSecret);
  }
}

export const bybitClient = new BybitClient();
