import { describe, expect, it } from "vitest";
import { bootstrapRequestSchema, directDepositRequestSchema } from "../src/index";

describe("shared schemas", () => {
  it("accepts bootstrap requests without a wallet address for demo auth", () => {
    const parsed = bootstrapRequestSchema.parse({ dynamicUserId: "demo-user", primaryWalletAddress: "" });
    expect(parsed.primaryWalletAddress).toBeUndefined();
  });

  it("rejects non-positive deposit amounts", () => {
    expect(() => directDepositRequestSchema.parse({ dynamicUserId: "demo-user", amount: "0", asset: "USDC" })).toThrow();
  });
});
