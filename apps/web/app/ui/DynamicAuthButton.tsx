"use client";

import dynamic from "next/dynamic";

const DynamicWidget = dynamic(
  () => import("@dynamic-labs/sdk-react-core").then((mod) => mod.DynamicWidget),
  {
    ssr: false,
    loading: () => (
      <button className="rounded-md border px-3 py-2 text-sm opacity-70" disabled>
        Loading wallet...
      </button>
    )
  }
);

export function DynamicAuthButton() {
  return <DynamicWidget />;
}
