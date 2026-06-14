"use client";

import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicContextProvider, DynamicWidgetContextProvider } from "@dynamic-labs/sdk-react-core";

export function LiveDynamicProvider({ children, environmentId }: { children: React.ReactNode; environmentId: string }) {
  return (
    <DynamicContextProvider
      settings={{
        environmentId,
        walletConnectors: [EthereumWalletConnectors]
      }}
    >
      <DynamicWidgetContextProvider>{children}</DynamicWidgetContextProvider>
    </DynamicContextProvider>
  );
}
