"use client";

import dynamic from "next/dynamic";
import { type ReactNode } from "react";
import { isDynamicEnvironmentConfigured } from "@/lib/dynamic-env";
import { useDynamicReady } from "@/app/providers";

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

const DynamicWidget = dynamic(() => import("@dynamic-labs/sdk-react-core").then((mod) => mod.DynamicWidget), {
  ssr: false,
  loading: DynamicLoadingButton
});

export function DynamicAuthButton() {
  const ready = useDynamicReady();

  if (!isDynamicEnvironmentConfigured()) {
    return <DynamicFallback />;
  }

  if (!ready) {
    return <DynamicLoadingButton />;
  }

  return <DynamicWidget />;
}
