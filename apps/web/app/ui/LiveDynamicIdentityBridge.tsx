"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useEffect } from "react";

export type LiveDynamicIdentity = {
  dynamicConfigured: true;
  dynamicUserId: string;
  walletAddress?: string;
  email?: string;
  signedIn: boolean;
};

function getWalletAddress(primaryWallet: unknown): string | undefined {
  if (!primaryWallet || typeof primaryWallet !== "object") {
    return undefined;
  }
  return (primaryWallet as { address?: string }).address;
}

export function LiveDynamicIdentityBridge({ onIdentity }: { onIdentity: (identity: LiveDynamicIdentity) => void }) {
  const { primaryWallet, user } = useDynamicContext();

  useEffect(() => {
    onIdentity({
      dynamicConfigured: true,
      dynamicUserId: user?.userId ?? "demo-dynamic-user",
      walletAddress: getWalletAddress(primaryWallet),
      email: user?.email,
      signedIn: Boolean(user)
    });
  }, [onIdentity, primaryWallet, user]);

  return null;
}
