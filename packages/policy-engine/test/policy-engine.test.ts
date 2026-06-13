import { describe, expect, it } from "vitest";
import {
  allocateAtomic,
  balancedWorkerPolicy,
  buildAllocationPlan,
  debtPaydownPolicy,
  type PayrollPolicy,
  requiresApproval,
  validatePolicy
} from "../src/index";

const basePolicy: PayrollPolicy = {
  policyName: "Demo",
  version: 1,
  categories: [
    {
      categoryId: "reserve",
      label: "Reserve",
      percentageBps: 10000,
      categoryType: "InternalReserve",
      requiresApproval: false
    }
  ],
  approvalRules: []
};

describe("policy engine validation", () => {
  it("rejects empty policies", () => {
    const result = validatePolicy({ ...basePolicy, categories: [] });
    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain("POLICY_CATEGORIES_REQUIRED");
  });

  it("rejects percentages that do not sum to 10000", () => {
    const result = validatePolicy({
      ...basePolicy,
      categories: [{ ...basePolicy.categories[0]!, percentageBps: 9000 }]
    });
    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain("POLICY_PERCENTAGE_SUM_INVALID");
  });

  it("accepts arbitrary user-defined categories", () => {
    const result = validatePolicy({
      policyName: "Custom",
      version: 1,
      categories: [
        { categoryId: "mom", label: "Mom", percentageBps: 2500, categoryType: "ExternalPayment", recipientParty: "preo-mom", requiresApproval: false },
        { categoryId: "sidequest", label: "Side Quest", percentageBps: 7500, categoryType: "ManualHold", requiresApproval: false }
      ],
      approvalRules: []
    });
    expect(result).toMatchObject({ ok: true, errors: [] });
  });

  it("rejects duplicate category ids", () => {
    const result = validatePolicy({
      ...basePolicy,
      categories: [
        { ...basePolicy.categories[0]!, percentageBps: 5000 },
        { ...basePolicy.categories[0]!, label: "Reserve 2", percentageBps: 5000 }
      ]
    });
    expect(result.errors.map((error) => error.code)).toContain("CATEGORY_ID_DUPLICATE");
  });

  it("rejects external payments without recipient or address", () => {
    const result = validatePolicy({
      ...basePolicy,
      categories: [{ categoryId: "rent", label: "Rent", percentageBps: 10000, categoryType: "ExternalPayment", requiresApproval: false }]
    });
    expect(result.errors.map((error) => error.code)).toContain("CATEGORY_MISSING_RECIPIENT");
  });

  it("rejects portfolio allocations without a target", () => {
    const result = validatePolicy({
      ...basePolicy,
      categories: [{ categoryId: "portfolio", label: "Portfolio", percentageBps: 10000, categoryType: "PortfolioAllocation", requiresApproval: false }]
    });
    expect(result.errors.map((error) => error.code)).toContain("CATEGORY_MISSING_PORTFOLIO_TARGET");
  });

  it("warns for zero bps categories", () => {
    const result = validatePolicy({
      ...basePolicy,
      categories: [
        { ...basePolicy.categories[0]!, percentageBps: 10000 },
        { categoryId: "later", label: "Later", percentageBps: 0, categoryType: "ManualHold", requiresApproval: false }
      ]
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.map((warning) => warning.code)).toContain("CATEGORY_ZERO_BPS");
  });
});

describe("policy engine allocation", () => {
  it("calculates allocation for 2500 USDC", () => {
    const plan = buildAllocationPlan(
      {
        ...basePolicy,
        categories: [
          { categoryId: "rent", label: "Rent", percentageBps: 3500, categoryType: "ExternalPayment", recipientParty: "preo-recipient", requiresApproval: false },
          { categoryId: "reserve", label: "Reserve", percentageBps: 3500, categoryType: "InternalReserve", requiresApproval: false },
          { categoryId: "portfolio", label: "Portfolio", percentageBps: 3000, categoryType: "PortfolioAllocation", portfolioTarget: "GlobalEquityBasket", requiresApproval: false }
        ]
      },
      { creditId: "credit-1", amount: "2500.00", asset: "USDC", sourceRef: "src" },
      { runId: "run-1" }
    );

    expect(plan.lines.map((line) => line.amount)).toEqual([875, 875, 750]);
    expect(plan.immediatePayments).toHaveLength(1);
    expect(plan.immediateInternalBalances).toHaveLength(1);
    expect(plan.immediatePortfolioAllocations).toHaveLength(1);
    expect(plan.status).toBe("Executed");
  });

  it("handles atomic residual by assigning it to the last category", () => {
    const lines = allocateAtomic(100n, [
      { categoryId: "a", percentageBps: 3333 },
      { categoryId: "b", percentageBps: 3333 },
      { categoryId: "c", percentageBps: 3334 }
    ]);
    expect(lines.map((line) => line.amountUnits)).toEqual([33n, 33n, 34n]);
  });

  it("requires approval by category flag", () => {
    const category = { categoryId: "portfolio", label: "Portfolio", percentageBps: 10000, categoryType: "PortfolioAllocation" as const, portfolioTarget: "GlobalEquityBasket" as const, requiresApproval: true };
    expect(requiresApproval(category, 100, [])).toBe(true);
  });

  it("requires approval by threshold rule", () => {
    const category = { categoryId: "rent", label: "Rent", percentageBps: 10000, categoryType: "ExternalPayment" as const, recipientParty: "preo-recipient", requiresApproval: false };
    expect(requiresApproval(category, 500, [{ ruleId: "large", actionType: "ExternalPayment", enabled: true, thresholdAmount: 400, description: "Large payment" }])).toBe(true);
  });

  it("requires approval for new recipients", () => {
    const category = { categoryId: "family", label: "Family", percentageBps: 10000, categoryType: "ExternalPayment" as const, recipientParty: "preo-family", requiresApproval: false };
    expect(requiresApproval(category, 100, [{ ruleId: "new", actionType: "NewRecipient", enabled: true, description: "New recipient" }], { newRecipientCategoryIds: ["family"] })).toBe(true);
  });

  it("puts manual holds in the manual hold bucket without external action", () => {
    const plan = buildAllocationPlan(
      {
        ...basePolicy,
        categories: [{ categoryId: "spending", label: "Spending", percentageBps: 10000, categoryType: "ManualHold", requiresApproval: false }]
      },
      { creditId: "credit-2", amount: "100.00", asset: "USDC", sourceRef: "src" },
      { runId: "run-2" }
    );
    expect(plan.manualHolds).toHaveLength(1);
    expect(plan.immediatePayments).toHaveLength(0);
    expect(plan.pendingActions).toHaveLength(0);
  });

  it("builds the full demo policy with expected lines", () => {
    const plan = buildAllocationPlan(balancedWorkerPolicy, { creditId: "credit-3", amount: "2500.00", asset: "USDC", sourceRef: "src" }, { runId: "run-3" });
    expect(plan.lines.map((line) => line.categoryId)).toEqual(["rent", "emergency", "portfolio", "family", "spending"]);
    expect(plan.pendingActions.map((action) => action.categoryId)).toContain("portfolio");
  });

  it("does not depend on known category names", () => {
    const plan = buildAllocationPlan(
      {
        policyName: "Random",
        version: 1,
        categories: [
          { categoryId: "alpha-123", label: "Alpha 123", percentageBps: 6000, categoryType: "ManualHold", requiresApproval: false },
          { categoryId: "zeta", label: "Zeta", percentageBps: 4000, categoryType: "InternalReserve", requiresApproval: false }
        ],
        approvalRules: []
      },
      { creditId: "credit-4", amount: "10.00", asset: "USDC", sourceRef: "src" },
      { runId: "run-4" }
    );
    expect(plan.lines.map((line) => line.label)).toEqual(["Alpha 123", "Zeta"]);
  });

  it("exports the debt paydown demo policy as a valid editable example", () => {
    expect(validatePolicy(debtPaydownPolicy).ok).toBe(true);
  });
});
