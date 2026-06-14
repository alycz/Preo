"use client";

import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { getDynamicEnvironmentId } from "@/lib/dynamic-env";

export function DynamicProvider({ children }: { children: React.ReactNode }) {
  const environmentId = getDynamicEnvironmentId();

  if (!environmentId) {
    return <>{children}</>;
  }

  return (
    <DynamicContextProvider
      settings={{
        environmentId,
        walletConnectors: [EthereumWalletConnectors]
      }}
    >
      {children}
    </DynamicContextProvider>
  );
}
