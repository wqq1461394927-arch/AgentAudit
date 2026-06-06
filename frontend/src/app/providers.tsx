"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, getDefaultConfig, darkTheme } from "@rainbow-me/rainbowkit";
import { hardhat, sepolia } from "wagmi/chains";
import "@rainbow-me/rainbowkit/styles.css";

// Configure wagmi + RainbowKit
const config = getDefaultConfig({
  appName: "CeatDAO Bug Bounty",
  projectId: "ceatdao-dev-project-id",
  chains: [hardhat, sepolia],
  ssr: true,
});

// React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#3b82f6",
            accentColorForeground: "#ffffff",
            borderRadius: "medium",
          })}
          locale="zh-CN"
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
