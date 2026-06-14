"use client";

import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicContextProvider, DynamicWidgetContextProvider } from "@dynamic-labs/sdk-react-core";
import { getDynamicEnvironmentId } from "@/lib/dynamic-env";
import { createContext, useContext, useEffect, useState } from "react";

const DynamicReadyContext = createContext(false);

export const useDynamicReady = () => useContext(DynamicReadyContext);

export function DynamicProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const environmentId = getDynamicEnvironmentId();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!environmentId || !mounted) {
    return <DynamicReadyContext.Provider value={false}>{children}</DynamicReadyContext.Provider>;
  }

  return (
    <DynamicContextProvider
      settings={{
        environmentId,
        walletConnectors: [EthereumWalletConnectors]
      }}
    >
      <DynamicWidgetContextProvider>
        <DynamicReadyContext.Provider value={true}>{children}</DynamicReadyContext.Provider>
      </DynamicWidgetContextProvider>
    </DynamicContextProvider>
  );
}
