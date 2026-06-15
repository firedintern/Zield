'use client';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RainbowKitProvider,
  connectorsForWallets,
  darkTheme,
} from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  injectedWallet,
  braveWallet,
  walletConnectWallet,
  rainbowWallet,
} from '@rainbow-me/rainbowkit/wallets';
import '@rainbow-me/rainbowkit/styles.css';

const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const HAS_WC = !!WC_PROJECT_ID && WC_PROJECT_ID.length === 32 && WC_PROJECT_ID !== 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Installed',
      wallets: [
        metaMaskWallet,
        injectedWallet,
        braveWallet,
        // Only include WalletConnect wallets when a valid project ID exists
        ...(HAS_WC ? [walletConnectWallet, rainbowWallet] : []),
      ],
    },
  ],
  {
    appName: 'Zield',
    projectId: WC_PROJECT_ID || '00000000000000000000000000000000',
  }
);

const config = createConfig({
  connectors,
  chains: [baseSepolia, base],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org'),
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org'),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#19c79a',
            accentColorForeground: '#04110c',
            borderRadius: 'large',
            overlayBlur: 'small',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
