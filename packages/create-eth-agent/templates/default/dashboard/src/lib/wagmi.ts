'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  coinbaseWallet,
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { defineChain, fallback, http } from 'viem';
import { RPC_URLS } from './contract';

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
const hasWalletConnectProjectId = Boolean(walletConnectProjectId && !/^0+$/.test(walletConnectProjectId));

export const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'Somnia Token', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } },
  blockExplorers: {
    default: { name: 'Somnia Explorer', url: 'https://shannon-explorer.somnia.network' },
  },
});

const popularWallets = [
  metaMaskWallet,
  coinbaseWallet,
  rabbyWallet,
  ...(hasWalletConnectProjectId ? [rainbowWallet, walletConnectWallet] : []),
];

export const wagmiConfig = getDefaultConfig({
  appName: 'Somnia Agent Dashboard',
  projectId: walletConnectProjectId || 'somnia-agent-local-dev',
  chains: [somniaTestnet],
  transports: {
    [somniaTestnet.id]: fallback(RPC_URLS.map((url) => http(url))),
  },
  wallets: [
    {
      groupName: 'Popular',
      wallets: popularWallets,
    },
  ],
  ssr: true,
});
