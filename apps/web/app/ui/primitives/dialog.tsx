"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

export const DialogRoot = Dialog.Root;
export const DialogTrigger = Dialog.Trigger;
export const DialogClose = Dialog.Close;

export function DialogContent({
  title,
  description,
  children
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content className="dialog-content">
        <Dialog.Title className="dialog-title">{title}</Dialog.Title>
        {description ? <Dialog.Description className="dialog-desc">{description}</Dialog.Description> : null}
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
