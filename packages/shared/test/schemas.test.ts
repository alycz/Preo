import { describe, expect, it } from "vitest";
import {
  blinkSignPaymentRequestSchema,
  bootstrapRequestSchema,
  directDepositRequestSchema,
  evmVerifyDepositRequestSchema,
  policyRequestSchema,
  validatePolicyInput
} from "../src/index";

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
        amount: 25,
        chainId: 84532,
        address: "0x0000000000000000000000000000000000000001",
        token: "0x0000000000000000000000000000000000000002",
        callbackScheme: null,
        url: "https://pay-sandbox.blink.cash",
        version: "v1",
        reference: "order-123",
        metadata: { invoiceId: "INV-456" }
      }).callbackScheme
    ).toBeNull();

    expect(() =>
      evmVerifyDepositRequestSchema.parse({
        dynamicUserId: "demo-user",
        txHash: "0x1234"
      })
    ).toThrow();
  });

  it("validates policy bps totals and required category fields", () => {
    const policy = policyRequestSchema.parse({
      dynamicUserId: "demo-user",
      policyName: "Demo",
      categories: [
        {
          categoryId: "rent",
          label: "Rent",
          percentageBps: 5000,
          categoryType: "ExternalPayment",
          requiresApproval: false
        },
        {
          categoryId: "portfolio",
          label: "Portfolio",
          percentageBps: 4000,
          categoryType: "PortfolioAllocation",
          requiresApproval: true
        }
      ],
      approvalRules: []
    });

    const result = validatePolicyInput(policy);
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      "POLICY_PERCENTAGE_SUM_INVALID",
      "CATEGORY_MISSING_RECIPIENT",
      "CATEGORY_MISSING_PORTFOLIO_TARGET"
    ]));
    expect(result.errors.map((error) => error.path)).toContain("categories[1].portfolioTarget");
  });

  it("returns engine warnings through the compatibility validator", () => {
    const policy = policyRequestSchema.parse({
      dynamicUserId: "demo-user",
      policyName: "Demo",
      categories: [
        {
          categoryId: "reserve",
          label: "Reserve",
          percentageBps: 10000,
          categoryType: "InternalReserve",
          requiresApproval: false
        },
        {
          categoryId: "future",
          label: "Future",
          percentageBps: 0,
          categoryType: "ManualHold",
          requiresApproval: false
        }
      ],
      approvalRules: []
    });

    const result = validatePolicyInput(policy);
    expect(result.valid).toBe(true);
    expect(result.warnings.map((warning) => warning.code)).toContain("CATEGORY_ZERO_BPS");
  });

  it("accepts custom portfolio model targets", () => {
    const policy = policyRequestSchema.parse({
      dynamicUserId: "demo-user",
      policyName: "Custom portfolio",
      categories: [
        {
          categoryId: "portfolio",
          label: "Portfolio",
          percentageBps: 10000,
          categoryType: "PortfolioAllocation",
          portfolioTarget: { custom: "Employee-defined model" },
          requiresApproval: true
        }
      ],
      approvalRules: []
    });

    const result = validatePolicyInput(policy);
    expect(result.valid).toBe(true);
  });
});
