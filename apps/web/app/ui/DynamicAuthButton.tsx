"use client";

import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { type ReactNode } from "react";
import { isDynamicEnvironmentConfigured } from "@/lib/dynamic-env";

function DynamicFallback({ children = "Dynamic env missing" }: { children?: ReactNode }) {
  return <span className="status warn">{children}</span>;
}

export function DynamicAuthButton() {
  if (!isDynamicEnvironmentConfigured()) {
    return <DynamicFallback />;
  }

  return <DynamicWidget />;
}
