import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MOCK_DYNAMIC_IDENTITY } from "../lib/dynamic-env";
import { AppWalletProvider, useAppWallet } from "../app/wallet-context";

function MockWalletProbe() {
  const wallet = useAppWallet();
  return createElement(
    "div",
    null,
    createElement("span", { "data-mode": wallet.mode }, wallet.mode),
    createElement("span", { "data-signed-in": wallet.mode === "mock" }, "signed in"),
    createElement("span", { "data-connected": wallet.mode === "mock" }, wallet.mockIdentity.walletAddress)
  );
}

describe("app wallet context", () => {
  it("renders the mock wallet as connected with the demo address", () => {
    const html = renderToStaticMarkup(createElement(AppWalletProvider, { mode: "mock" }, createElement(MockWalletProbe)));

    expect(html).toContain('data-mode="mock"');
    expect(html).toContain('data-signed-in="true"');
    expect(html).toContain('data-connected="true"');
    expect(html).toContain(MOCK_DYNAMIC_IDENTITY.walletAddress);
  });

  it("keeps DynamicAuthButton on DynamicWidget instead of direct Dynamic hooks", () => {
    const source = readFileSync(fileURLToPath(new URL("../app/ui/DynamicAuthButton.tsx", import.meta.url)), "utf8");

    expect(source).toContain("DynamicWidget");
    expect(source).toContain("Wallet connected");
    expect(source).toContain("Dynamic env missing");
    expect(source).not.toContain("useDynamicContext");
  });
});
