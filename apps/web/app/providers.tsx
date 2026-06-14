"use client";

import dynamic from "next/dynamic";
import { AppWalletProvider } from "./wallet-context";
import type { ClientWalletMode } from "@/lib/dynamic-env";

const LiveDynamicProvider = dynamic(() => import("./providers-live").then((mod) => mod.LiveDynamicProvider), {
  ssr: false
});

type AppProvidersProps = {
  children: React.ReactNode;
  dynamicEnvironmentId?: string;
  walletMode: ClientWalletMode;
};

export function AppProviders({ children, dynamicEnvironmentId, walletMode }: AppProvidersProps) {
  const content = <AppWalletProvider mode={walletMode}>{children}</AppWalletProvider>;

  if (walletMode !== "live" || !dynamicEnvironmentId) {
    return content;
  }

  return <LiveDynamicProvider environmentId={dynamicEnvironmentId}>{content}</LiveDynamicProvider>;
}
