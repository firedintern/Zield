'use client';

import { WagmiProvider } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RainbowKitProvider,
  darkTheme,
  connectorsForWallets,
} from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  injectedWallet,
  rainbowWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import '@rainbow-me/rainbowkit/styles.css';

const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const RPC_BASE = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org';
const RPC_SEPOLIA = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org';

// Build wallet list — WalletConnect connectors require a real project ID.
// Without one, only injected/MetaMask/Coinbase are offered so the modal
// doesn't stall on an invalid WC handshake.
function buildWallets() {
  const injected = [
    injectedWallet,
    metaMaskWallet,
  ];
  if (WC_PROJECT_ID) {
    return [
      ...injected,
      rainbowWallet,
      walletConnectWallet,
    ];
  }
  return injected;
}

const connectors = connectorsForWallets(
  [{ groupName: 'Connect wallet', wallets: buildWallets() }],
  {
    appName: 'Zield',
    projectId: WC_PROJECT_ID || 'placeholder',
  }
);

const config = createConfig({
  connectors,
  chains: [baseSepolia, base],
  transports: {
    [base.id]: http(RPC_BASE),
    [baseSepolia.id]: http(RPC_SEPOLIA),
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
