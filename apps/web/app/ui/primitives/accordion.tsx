"use client";

import * as Accordion from "@radix-ui/react-accordion";
import type { ReactNode } from "react";

export const AccordionRoot = Accordion.Root;
export const AccordionItem = Accordion.Item;

export function AccordionTrigger({ children }: { children: ReactNode }) {
  return (
    <Accordion.Header className="acc-header">
      <Accordion.Trigger className="acc-trigger">
        <span>{children}</span>
        <span className="acc-chevron" aria-hidden />
      </Accordion.Trigger>
    </Accordion.Header>
  );
}

export function AccordionContent({ children }: { children: ReactNode }) {
  return (
    <Accordion.Content className="acc-content">
      <div className="acc-inner">{children}</div>
    </Accordion.Content>
  );
}
