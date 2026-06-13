import { describe, expect, it } from "vitest";
import { CantonClient } from "../src/index";

describe("CantonClient", () => {
  it("returns demo payroll credit ids without a live JSON API", async () => {
    const client = new CantonClient({ demoMode: true });
    const result = await client.createPayrollCredit({
      user: "preo-user",
      amount: "2500.00",
      asset: "USDC",
      sourceRef: "demo-source"
    });
    expect(result.live).toBe(false);
    expect(result.contractId).toContain("demo-payroll-credit-demo-source");
  });
});
