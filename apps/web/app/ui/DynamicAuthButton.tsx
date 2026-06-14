"use client";

import dynamic from "next/dynamic";
import { isDynamicEnvironmentConfigured } from "@/lib/dynamic-env";

function DynamicFallback({ children = "Dynamic env missing" }: { children?: React.ReactNode }) {
  return <span className="status warn">{children}</span>;
}

function DynamicLoadingButton() {
  return (
    <button className="rounded-md border px-3 py-2 text-sm opacity-70" disabled>
      Loading wallet...
    </button>
  );
}

const DynamicConnectButton = dynamic(
  () =>
    import("@dynamic-labs/sdk-react-core").then((mod) => {
      const { DynamicConnectButton: DynamicSdkConnectButton } = mod;
      return function DynamicConnectButtonWithLabel() {
        return <DynamicSdkConnectButton>Connect wallet</DynamicSdkConnectButton>;
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

  return <DynamicConnectButton />;
}
