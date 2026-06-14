"use client";

import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { getDynamicEnvironmentId } from "@/lib/dynamic-env";
import { createContext, useContext } from "react";

const DynamicReadyContext = createContext(false);

export const useDynamicReady = () => useContext(DynamicReadyContext);

export function DynamicProvider({ children }: { children: React.ReactNode }) {
  const environmentId = getDynamicEnvironmentId();

  if (!environmentId) {
    return <DynamicReadyContext.Provider value={false}>{children}</DynamicReadyContext.Provider>;
  }

  return (
    <DynamicContextProvider
      settings={{
        environmentId,
        walletConnectors: [EthereumWalletConnectors]
      }}
    >
      <DynamicReadyContext.Provider value={true}>{children}</DynamicReadyContext.Provider>
    </DynamicContextProvider>
  );
}
