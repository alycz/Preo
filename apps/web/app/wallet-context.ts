"use client";

import { createContext, createElement, useContext } from "react";
import { MOCK_DYNAMIC_IDENTITY, type ClientWalletMode } from "@/lib/dynamic-env";

type AppWalletContextValue = {
  mode: ClientWalletMode;
  dynamicConfigured: boolean;
  mockIdentity: typeof MOCK_DYNAMIC_IDENTITY;
};

const AppWalletContext = createContext<AppWalletContextValue>({
  mode: "none",
  dynamicConfigured: false,
  mockIdentity: MOCK_DYNAMIC_IDENTITY
});

export function AppWalletProvider({ children, mode }: { children?: React.ReactNode; mode: ClientWalletMode }) {
  return createElement(
    AppWalletContext.Provider,
    {
      value: {
        mode,
        dynamicConfigured: mode === "live",
        mockIdentity: MOCK_DYNAMIC_IDENTITY
      }
    },
    children
  );
}

export function useAppWallet() {
  return useContext(AppWalletContext);
}
