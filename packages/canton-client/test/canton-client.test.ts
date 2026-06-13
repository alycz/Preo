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
    expect(result.contractId).toContain("demo-preo-payroll-payrollcredit");
  });

  it("runs demo policy allocation and approval visibility", async () => {
    const client = new CantonClient({ demoMode: true });
    const user = `preo-user-${Date.now()}`;
    await client.allocateParty(user, "User");
    await client.allocateParty("preo-recipient", "Recipient");
    const policy = await client.createPayrollPolicy(user, {
      policyName: "Demo policy",
      categories: [
        {
          categoryId: "rent",
          label: "Rent",
          percentageBps: 5000,
          categoryType: "ExternalPayment",
          recipientParty: "preo-recipient",
          requiresApproval: false
        },
        {
          categoryId: "portfolio",
          label: "Portfolio",
          percentageBps: 5000,
          categoryType: "PortfolioAllocation",
          portfolioTarget: "GlobalEquityBasket",
          requiresApproval: true
        }
      ]
    });
    const credit = await client.createPayrollCredit({
      user,
      amount: "1000.00",
      asset: "USDC",
      sourceRef: "demo-allocation-source"
    });

    const allocation = await client.runAllocation({
      user,
      payrollCreditContractId: credit.contractId,
      policyContractId: policy.contractId,
      runId: "demo-run"
    });

    expect(allocation.balances).toHaveLength(2);
    expect(allocation.pendingActions).toHaveLength(1);
    expect((await client.partyView("preo-recipient"))["Preo.Payment:PaymentReceipt"]).toHaveLength(1);
    expect((await client.partyView("preo-recipient"))["Preo.Policy:PayrollPolicy"]).toHaveLength(0);

    const approved = await client.approvePendingAction(allocation.pendingActions[0]!.contractId, user);
    expect(approved.payload).toMatchObject({ status: "Approved" });
  });
});
