"use client";

import dynamic from "next/dynamic";
import { type ReactNode } from "react";
import { isDynamicEnvironmentConfigured } from "@/lib/dynamic-env";

function DynamicFallback({ children = "Dynamic env missing" }: { children?: ReactNode }) {
  return <span className="status warn">{children}</span>;
}

function DynamicLoadingButton() {
  return (
    <button className="rounded-md border px-3 py-2 text-sm opacity-70" disabled>
      Loading wallet...
    </button>
  );
}

const DynamicConnectControl = dynamic(
  () =>
    import("@dynamic-labs/sdk-react-core").then((mod) => {
      const { useDynamicContext } = mod;
      return function DynamicConnectControl() {
        const { primaryWallet, sdkHasLoaded, setShowAuthFlow } = useDynamicContext();

        if (!sdkHasLoaded) {
          return <DynamicLoadingButton />;
        }

        if (primaryWallet) {
          return (
            <button className="rounded-md border px-3 py-2 text-sm opacity-80" disabled type="button">
              Wallet connected
            </button>
          );
        }

        return (
          <button
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => {
              setShowAuthFlow(true);
            }}
            type="button"
          >
            Connect wallet
          </button>
        );
      };
    }),
  {
    ssr: false,
    loading: DynamicLoadingButton
  }
);

export function DynamicAuthButton() {
  if (!isDynamicEnvironmentConfigured()) {
    return <DynamicFallback />;
  }

  return <DynamicConnectControl />;
}
