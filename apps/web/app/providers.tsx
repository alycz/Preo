"use client";

import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { getDynamicEnvironmentId } from "@/lib/dynamic-env";
import { useEffect, useState } from "react";

export function DynamicProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const environmentId = getDynamicEnvironmentId();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!environmentId || !mounted) {
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
