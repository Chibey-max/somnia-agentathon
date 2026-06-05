'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  coinbaseWallet,
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { fallback, http } from 'viem';
import { sepolia } from 'wagmi/chains';
import { RPC_URLS } from './contract';

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
const hasWalletConnectProjectId = Boolean(walletConnectProjectId && !/^0+$/.test(walletConnectProjectId));

const popularWallets = [
  metaMaskWallet,
  coinbaseWallet,
  rabbyWallet,
  ...(hasWalletConnectProjectId ? [rainbowWallet, walletConnectWallet] : []),
];

export const wagmiConfig = getDefaultConfig({
  appName: 'ETH Agent Dashboard',
  projectId: walletConnectProjectId || 'eth-agent-local-dev',
  chains: [sepolia],
  transports: {
    [sepolia.id]: fallback(RPC_URLS.map((url) => http(url))),
  },
  wallets: [
    {
      groupName: 'Popular',
      wallets: popularWallets,
    },
  ],
  ssr: true,
});
