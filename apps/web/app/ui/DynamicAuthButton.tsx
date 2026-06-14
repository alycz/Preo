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

const DynamicWidgetButton = dynamic(
  () =>
    import("@dynamic-labs/sdk-react-core").then((mod) => {
      const { DynamicWidget } = mod;
      return function DynamicWidgetButtonWithLabel() {
        return <DynamicWidget innerButtonComponent="Connect wallet" />;
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

  return <DynamicWidgetButton />;
}
