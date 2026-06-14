"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ComponentProps, ReactNode } from "react";

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({ children, align = "end" }: { children: ReactNode; align?: "start" | "center" | "end" }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content className="menu-content" sideOffset={8} align={align} collisionPadding={12}>
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function MenuItem(props: ComponentProps<typeof DropdownMenu.Item>) {
  return <DropdownMenu.Item className="menu-item" {...props} />;
}

export function MenuLabel(props: ComponentProps<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className="menu-label" {...props} />;
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="menu-sep" />;
}
