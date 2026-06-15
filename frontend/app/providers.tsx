'use client';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { injected, metaMask } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

const RPC_BASE = process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org';
const RPC_SEPOLIA = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || 'https://sepolia.base.org';

// metaMask() targets MetaMask via EIP-6963 rdns "io.metamask".
// injected() is the fallback for any other injected provider.
// Both are listed so RainbowKit always shows wallet options instead of
// the "What is a Wallet?" onboarding screen.
const config = createConfig({
  connectors: [
    metaMask({ dappMetadata: { name: 'Zield', url: 'https://zield-nu.vercel.app' } }),
    injected({ target: 'metaMask' }),
    injected(),
  ],
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
