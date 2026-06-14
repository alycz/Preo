"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import type { ReactNode } from "react";

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="switch-row">
      <SwitchPrimitive.Root className="switch" checked={checked} onCheckedChange={onCheckedChange} disabled={disabled}>
        <SwitchPrimitive.Thumb className="switch-thumb" />
      </SwitchPrimitive.Root>
      {label ? <span>{label}</span> : null}
    </label>
  );
}
