import { describe, expect, it } from "vitest";
import { blinkSignPaymentRequestSchema, bootstrapRequestSchema, directDepositRequestSchema, evmVerifyDepositRequestSchema } from "../src/index";

describe("shared schemas", () => {
  it("accepts bootstrap requests without a wallet address for demo auth", () => {
    const parsed = bootstrapRequestSchema.parse({ dynamicUserId: "demo-user", primaryWalletAddress: "" });
    expect(parsed.primaryWalletAddress).toBeUndefined();
  });

  it("rejects non-positive deposit amounts", () => {
    expect(() => directDepositRequestSchema.parse({ dynamicUserId: "demo-user", amount: "0", asset: "USDC" })).toThrow();
  });

  it("validates Blink signer and EVM verification inputs", () => {
    expect(
      blinkSignPaymentRequestSchema.parse({
        amount: "25.00",
        chainId: 84532,
        address: "0x0000000000000000000000000000000000000001",
        token: "0x0000000000000000000000000000000000000002",
        callbackScheme: null
      }).callbackScheme
    ).toBeNull();

    expect(() =>
      evmVerifyDepositRequestSchema.parse({
        dynamicUserId: "demo-user",
        txHash: "0x1234"
      })
    ).toThrow();
  });
});
