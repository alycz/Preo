"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { motion } from "motion/react";
import type { ReactNode } from "react";

export const TabsRoot = Tabs.Root;
export const TabsContent = Tabs.Content;

export function TabsList({ children }: { children: ReactNode }) {
  return <Tabs.List className="tabs-list">{children}</Tabs.List>;
}

export function TabTrigger({ value, active, children }: { value: string; active: boolean; children: ReactNode }) {
  return (
    <Tabs.Trigger value={value} className="tabs-trigger">
      <span>{children}</span>
      {active ? (
        <motion.span
          layoutId="tab-underline"
          className="tabs-underline"
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
        />
      ) : null}
    </Tabs.Trigger>
  );
}
