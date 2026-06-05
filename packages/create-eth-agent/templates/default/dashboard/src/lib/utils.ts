import { createPublicClient, fallback, http, formatEther } from 'viem';
import { sepolia } from 'viem/chains';
import { RPC_URLS } from './contract';

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: fallback(RPC_URLS.map((url) => http(url))),
});

export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatETH(value: bigint, decimals = 6): string {
  const formatted = formatEther(value);
  const num = parseFloat(formatted);
  return num.toFixed(decimals);
}

export function formatETHShort(value: bigint): string {
  const formatted = formatEther(value);
  const num = parseFloat(formatted);
  if (num === 0) return '0 ETH';
  if (num < 0.000001) return '< 0.000001 ETH';
  return `${num.toFixed(6)} ETH`;
}

export function formatSelector(selector: string): string {
  if (selector === '0x00000000') return 'ETH Transfer';
  return selector;
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

export function formatCountdown(unlockTimeMs: number): string {
  const now = Date.now();
  const diff = unlockTimeMs - now;
  if (diff <= 0) return 'Ready to apply';
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function getEtherscanLink(hash: string, type: 'tx' | 'address' = 'tx'): string {
  const base = 'https://sepolia.etherscan.io';
  return type === 'tx' ? `${base}/tx/${hash}` : `${base}/address/${hash}`;
}

export function cn(...classes: (string | undefined | boolean)[]): string {
  return classes.filter(Boolean).join(' ');
}
