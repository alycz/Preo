"use client";

import dynamic from "next/dynamic";
import { type ReactNode } from "react";
import { useAppWallet } from "../wallet-context";

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

const DynamicWidgetControl = dynamic(() => import("@dynamic-labs/sdk-react-core").then((mod) => mod.DynamicWidget), {
  ssr: false,
  loading: DynamicLoadingButton
});

export function DynamicAuthButton() {
  const wallet = useAppWallet();

  if (wallet.mode === "mock") {
    return (
      <button className="rounded-md border px-3 py-2 text-sm opacity-80" disabled type="button">
        Wallet connected
      </button>
    );
  }

  if (!wallet.dynamicConfigured) {
    return <DynamicFallback />;
  }

  return <DynamicWidgetControl innerButtonComponent="Connect wallet" variant="modal" />;
}
