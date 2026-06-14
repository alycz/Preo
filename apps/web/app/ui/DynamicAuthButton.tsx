"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
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

export function DynamicAuthButton() {
  const [DynamicWidget, setDynamicWidget] = useState<ComponentType | null>(null);

  useEffect(() => {
    let active = true;

    void import("@dynamic-labs/sdk-react-core").then((mod) => {
      if (active) {
        setDynamicWidget(() => mod.DynamicWidget);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  if (!isDynamicEnvironmentConfigured()) {
    return <DynamicFallback />;
  }

  if (!DynamicWidget) {
    return <DynamicLoadingButton />;
  }

  return <DynamicWidget />;
}
