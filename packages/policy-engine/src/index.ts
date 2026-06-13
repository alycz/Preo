export type CategoryType = "InternalReserve" | "ExternalPayment" | "PortfolioAllocation" | "ManualHold";

export type ActionType = "ExternalPayment" | "PortfolioAllocation" | "ExternalWithdrawal" | "PolicyChange" | "NewRecipient" | "LargeTransfer";

export type DamlActionType =
  | "ActionExternalPayment"
  | "ActionPortfolioAllocation"
  | "ActionExternalWithdrawal"
  | "ActionPolicyChange"
  | "ActionNewRecipient"
  | "ActionLargeTransfer";

export type PortfolioModel = "GlobalEquityBasket" | "TreasuryYield" | "USDCSavings" | { custom: string };

export interface CategoryRule {
  categoryId: string;
  label: string;
  percentageBps: number;
  categoryType: CategoryType;
  recipientParty?: string;
  externalAddress?: string;
  portfolioTarget?: PortfolioModel;
  requiresApproval: boolean;
}

export interface ApprovalRule {
  ruleId: string;
  actionType: ActionType;
  enabled: boolean;
  thresholdAmount?: number;
  appliesToCategoryId?: string;
  description: string;
}

export interface PayrollPolicy {
  policyName: string;
  categories: CategoryRule[];
  approvalRules: ApprovalRule[];
  version: number;
}

export interface PayrollCredit {
  creditId: string;
  amount: number | string;
  asset: string;
  sourceRef: string;
}

export interface AllocationLine {
  categoryId: string;
  label: string;
  categoryType: CategoryType;
  percentageBps: number;
  amount: number;
  asset: string;
  requiresApproval: boolean;
  recipientParty?: string;
  externalAddress?: string;
  portfolioTarget?: PortfolioModel;
  reason: string;
}

export interface PendingActionDraft {
  actionId: string;
  actionType: ActionType;
  categoryId: string;
  label: string;
  amount: number;
  asset: string;
  recipientParty?: string;
  externalAddress?: string;
  portfolioTarget?: PortfolioModel;
  reason: string;
}

export interface AllocationPlan {
  runId: string;
  payrollAmount: number;
  asset: string;
  lines: AllocationLine[];
  immediateInternalBalances: AllocationLine[];
  pendingActions: PendingActionDraft[];
  immediatePayments: AllocationLine[];
  immediatePortfolioAllocations: AllocationLine[];
  manualHolds: AllocationLine[];
  status: "Executed" | "PartiallyPendingApproval";
}

export interface ValidationMessage {
  code: string;
  message: string;
  path: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
}

export interface AllocationContext {
  runId?: string;
  assetDecimals?: number;
  newRecipientCategoryIds?: string[];
}

export interface AgentActionEvent {
  type:
    | "policy_loaded"
    | "payroll_received"
    | "allocation_calculated"
    | "approval_created"
    | "payment_executed"
    | "portfolio_allocated";
  title: string;
  description: string;
  metadata: Record<string, unknown>;
}

export interface AtomicAllocationLine {
  categoryId: string;
  amountUnits: bigint;
}

const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const DAML_TO_ENGINE_ACTION: Record<DamlActionType, ActionType> = {
  ActionExternalPayment: "ExternalPayment",
  ActionPortfolioAllocation: "PortfolioAllocation",
  ActionExternalWithdrawal: "ExternalWithdrawal",
  ActionPolicyChange: "PolicyChange",
  ActionNewRecipient: "NewRecipient",
  ActionLargeTransfer: "LargeTransfer"
};
const ENGINE_TO_DAML_ACTION: Record<ActionType, DamlActionType> = {
  ExternalPayment: "ActionExternalPayment",
  PortfolioAllocation: "ActionPortfolioAllocation",
  ExternalWithdrawal: "ActionExternalWithdrawal",
  PolicyChange: "ActionPolicyChange",
  NewRecipient: "ActionNewRecipient",
  LargeTransfer: "ActionLargeTransfer"
};

export function actionTypeFromDaml(actionType: string): ActionType {
  return DAML_TO_ENGINE_ACTION[actionType as DamlActionType] ?? (actionType as ActionType);
}

export function actionTypeToDaml(actionType: ActionType): DamlActionType {
  return ENGINE_TO_DAML_ACTION[actionType];
}

export function categoryActionType(categoryType: CategoryType): ActionType {
  switch (categoryType) {
    case "ExternalPayment":
      return "ExternalPayment";
    case "PortfolioAllocation":
      return "PortfolioAllocation";
    case "ManualHold":
      return "ExternalWithdrawal";
    case "InternalReserve":
      return "LargeTransfer";
  }
}

export function assetDecimals(asset: string): number {
  const normalized = asset.toUpperCase();
  if (normalized === "USDC" || normalized === "USDT" || normalized === "USD") {
    return 6;
  }
  if (normalized === "ETH" || normalized === "WETH") {
    return 18;
  }
  return 2;
}

export function validatePolicy(policy: PayrollPolicy): ValidationResult {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];
  const categories = Array.isArray(policy.categories) ? policy.categories : [];
  const approvalRules = Array.isArray(policy.approvalRules) ? policy.approvalRules : [];

  if (!policy.policyName || !policy.policyName.trim()) {
    errors.push({ code: "POLICY_NAME_REQUIRED", message: "Policy name is required", path: "policyName" });
  }

  if (categories.length === 0) {
    errors.push({ code: "POLICY_CATEGORIES_REQUIRED", message: "Policy must include at least one category", path: "categories" });
  }
  if (categories.length > 20) {
    warnings.push({ code: "POLICY_CATEGORY_COUNT_HIGH", message: "More than 20 categories may be hard to review in the demo UI", path: "categories" });
  }

  const categoryIds = new Set<string>();
  let totalBps = 0;
  categories.forEach((category, index) => {
    const path = `categories[${index}]`;
    if (!category.categoryId || !category.categoryId.trim()) {
      errors.push({ code: "CATEGORY_ID_REQUIRED", message: "Category id is required", path: `${path}.categoryId` });
    } else if (categoryIds.has(category.categoryId)) {
      errors.push({ code: "CATEGORY_ID_DUPLICATE", message: "Category ids must be unique", path: `${path}.categoryId` });
    } else {
      categoryIds.add(category.categoryId);
    }

    if (!category.label || !category.label.trim()) {
      errors.push({ code: "CATEGORY_LABEL_REQUIRED", message: "Category label is required", path: `${path}.label` });
    }
    if (!Number.isInteger(category.percentageBps) || category.percentageBps < 0) {
      errors.push({ code: "CATEGORY_PERCENTAGE_INVALID", message: "Category percentage must be a non-negative integer basis point value", path: `${path}.percentageBps` });
    } else {
      totalBps += category.percentageBps;
      if (category.percentageBps === 0) {
        warnings.push({ code: "CATEGORY_ZERO_BPS", message: "Category has 0 bps and will receive no allocation", path: `${path}.percentageBps` });
      }
    }

    if (category.categoryType === "ExternalPayment" && !category.recipientParty && !category.externalAddress) {
      errors.push({ code: "CATEGORY_MISSING_RECIPIENT", message: "External payment categories require a recipient party or external address", path });
    }
    if (category.categoryType === "PortfolioAllocation" && !category.portfolioTarget) {
      errors.push({ code: "CATEGORY_MISSING_PORTFOLIO_TARGET", message: "Portfolio allocation categories require a portfolio target", path: `${path}.portfolioTarget` });
    }
    if (category.externalAddress && !EVM_ADDRESS_PATTERN.test(category.externalAddress)) {
      errors.push({ code: "CATEGORY_EXTERNAL_ADDRESS_INVALID", message: "External address must be a valid EVM address", path: `${path}.externalAddress` });
    }
  });

  if (categories.length > 0 && totalBps !== 10000) {
    errors.push({ code: "POLICY_PERCENTAGE_SUM_INVALID", message: "Policy category percentages must sum to 10000 basis points", path: "categories" });
  }

  const approvalRuleIds = new Set<string>();
  approvalRules.forEach((rule, index) => {
    const path = `approvalRules[${index}]`;
    if (!rule.ruleId || !rule.ruleId.trim()) {
      errors.push({ code: "APPROVAL_RULE_ID_REQUIRED", message: "Approval rule id is required", path: `${path}.ruleId` });
    } else if (approvalRuleIds.has(rule.ruleId)) {
      errors.push({ code: "APPROVAL_RULE_ID_DUPLICATE", message: "Approval rule ids must be unique", path: `${path}.ruleId` });
    } else {
      approvalRuleIds.add(rule.ruleId);
    }
    if (rule.thresholdAmount !== undefined && (!Number.isFinite(rule.thresholdAmount) || rule.thresholdAmount < 0)) {
      errors.push({ code: "APPROVAL_RULE_THRESHOLD_INVALID", message: "Approval rule threshold must be non-negative", path: `${path}.thresholdAmount` });
    }
  });

  return { ok: errors.length === 0, errors, warnings };
}

export function allocateAtomic(totalUnits: bigint, categories: Pick<CategoryRule, "categoryId" | "percentageBps">[]): AtomicAllocationLine[] {
  let allocated = 0n;
  return categories.map((category, index) => {
    const isLast = index === categories.length - 1;
    const amountUnits = isLast ? totalUnits - allocated : (totalUnits * BigInt(category.percentageBps)) / 10000n;
    allocated += amountUnits;
    return { categoryId: category.categoryId, amountUnits };
  });
}

export function allocateDecimal(amount: number | string, categories: Pick<CategoryRule, "categoryId" | "percentageBps">[], decimals = 6): Array<{ categoryId: string; amount: number }> {
  const totalUnits = parseAmountToUnits(amount, decimals);
  return allocateAtomic(totalUnits, categories).map((line) => ({ categoryId: line.categoryId, amount: unitsToNumber(line.amountUnits, decimals) }));
}

export function requiresApproval(category: CategoryRule, allocationAmount: number, approvalRules: ApprovalRule[], context: AllocationContext = {}): boolean {
  if (category.requiresApproval) {
    return true;
  }

  const actionType = categoryActionType(category.categoryType);
  const newRecipientCategoryIds = new Set(context.newRecipientCategoryIds ?? []);
  return approvalRules.some((rule) => {
    if (!rule.enabled) {
      return false;
    }
    const categoryMatches = !rule.appliesToCategoryId || rule.appliesToCategoryId === category.categoryId;
    if (!categoryMatches) {
      return false;
    }
    if (rule.actionType === "NewRecipient") {
      return newRecipientCategoryIds.has(category.categoryId);
    }
    if (rule.actionType !== actionType) {
      return false;
    }
    return rule.thresholdAmount === undefined || allocationAmount >= rule.thresholdAmount;
  });
}

export function buildAllocationPlan(policy: PayrollPolicy, credit: PayrollCredit, context: AllocationContext = {}): AllocationPlan {
  const validation = validatePolicy(policy);
  if (!validation.ok) {
    throw new Error(`Invalid payroll policy: ${validation.errors[0]?.message ?? "validation failed"}`);
  }

  const decimals = context.assetDecimals ?? assetDecimals(credit.asset);
  const payrollAmount = unitsToNumber(parseAmountToUnits(credit.amount, decimals), decimals);
  const runId = context.runId ?? `run-${credit.creditId}`;
  const amounts = new Map(allocateDecimal(credit.amount, policy.categories, decimals).map((line) => [line.categoryId, line.amount]));

  const lines: AllocationLine[] = policy.categories.map((category) => {
    const amount = amounts.get(category.categoryId) ?? 0;
    const lineRequiresApproval = requiresApproval(category, amount, policy.approvalRules, context);
    return {
      categoryId: category.categoryId,
      label: category.label,
      categoryType: category.categoryType,
      percentageBps: category.percentageBps,
      amount,
      asset: credit.asset,
      requiresApproval: lineRequiresApproval,
      recipientParty: category.recipientParty,
      externalAddress: category.externalAddress,
      portfolioTarget: category.portfolioTarget,
      reason: allocationReason(category, credit.amount)
    };
  });

  const immediateInternalBalances: AllocationLine[] = [];
  const immediatePayments: AllocationLine[] = [];
  const immediatePortfolioAllocations: AllocationLine[] = [];
  const manualHolds: AllocationLine[] = [];
  const pendingActions: PendingActionDraft[] = [];

  for (const line of lines) {
    if (line.requiresApproval) {
      pendingActions.push({
        actionId: `${runId}:${line.categoryId}`,
        actionType: categoryActionType(line.categoryType),
        categoryId: line.categoryId,
        label: line.label,
        amount: line.amount,
        asset: line.asset,
        recipientParty: line.recipientParty,
        externalAddress: line.externalAddress,
        portfolioTarget: line.portfolioTarget,
        reason: approvalReason(line)
      });
      continue;
    }
    if (line.categoryType === "InternalReserve") {
      immediateInternalBalances.push(line);
    } else if (line.categoryType === "ExternalPayment") {
      immediatePayments.push(line);
    } else if (line.categoryType === "PortfolioAllocation") {
      immediatePortfolioAllocations.push(line);
    } else {
      manualHolds.push(line);
    }
  }

  return {
    runId,
    payrollAmount,
    asset: credit.asset,
    lines,
    immediateInternalBalances,
    pendingActions,
    immediatePayments,
    immediatePortfolioAllocations,
    manualHolds,
    status: pendingActions.length > 0 ? "PartiallyPendingApproval" : "Executed"
  };
}

export function buildAgentActionEvents(plan: AllocationPlan): AgentActionEvent[] {
  const events: AgentActionEvent[] = [
    {
      type: "policy_loaded",
      title: "Policy loaded",
      description: "Loaded the active payroll policy for deterministic execution.",
      metadata: { runId: plan.runId }
    },
    {
      type: "payroll_received",
      title: "Payroll received",
      description: `Received ${formatAmount(plan.payrollAmount)} ${plan.asset} for allocation.`,
      metadata: { runId: plan.runId, amount: plan.payrollAmount, asset: plan.asset }
    },
    {
      type: "allocation_calculated",
      title: "Allocation calculated",
      description: `Calculated ${plan.lines.length} allocation lines from the active policy.`,
      metadata: { runId: plan.runId, lineCount: plan.lines.length, status: plan.status }
    }
  ];

  for (const pending of plan.pendingActions) {
    events.push({
      type: "approval_created",
      title: `Approval requested for ${pending.label}`,
      description: pending.reason,
      metadata: { runId: plan.runId, actionId: pending.actionId, categoryId: pending.categoryId, amount: pending.amount, asset: pending.asset }
    });
  }
  for (const payment of plan.immediatePayments) {
    events.push({
      type: "payment_executed",
      title: `Payment prepared for ${payment.label}`,
      description: `Prepared payment for ${payment.label} because your policy routes ${formatBps(payment.percentageBps)} to this category.`,
      metadata: { runId: plan.runId, categoryId: payment.categoryId, amount: payment.amount, asset: payment.asset }
    });
  }
  for (const portfolio of plan.immediatePortfolioAllocations) {
    events.push({
      type: "portfolio_allocated",
      title: `Portfolio allocation prepared for ${portfolio.label}`,
      description: `Prepared portfolio allocation for ${portfolio.label} because your policy routes ${formatBps(portfolio.percentageBps)} to this category.`,
      metadata: { runId: plan.runId, categoryId: portfolio.categoryId, amount: portfolio.amount, asset: portfolio.asset }
    });
  }

  return events;
}

export const balancedWorkerPolicy: PayrollPolicy = {
  policyName: "Balanced Worker",
  version: 1,
  categories: [
    { categoryId: "rent", label: "Rent", percentageBps: 3500, categoryType: "ExternalPayment", recipientParty: "preo-demo-recipient", requiresApproval: false },
    { categoryId: "emergency", label: "Emergency Fund", percentageBps: 2000, categoryType: "InternalReserve", requiresApproval: false },
    { categoryId: "portfolio", label: "Portfolio", percentageBps: 3000, categoryType: "PortfolioAllocation", portfolioTarget: "GlobalEquityBasket", requiresApproval: true },
    { categoryId: "family", label: "Family Support", percentageBps: 1000, categoryType: "ExternalPayment", recipientParty: "preo-family-recipient", requiresApproval: false },
    { categoryId: "spending", label: "Spending", percentageBps: 500, categoryType: "ManualHold", requiresApproval: false }
  ],
  approvalRules: [
    { ruleId: "new-recipient", actionType: "NewRecipient", enabled: true, description: "Ask before sending to a new recipient" },
    { ruleId: "portfolio", actionType: "PortfolioAllocation", enabled: true, description: "Ask before investing payroll" }
  ]
};

export const debtPaydownPolicy: PayrollPolicy = {
  policyName: "Debt Paydown",
  version: 1,
  categories: [
    { categoryId: "rent", label: "Rent", percentageBps: 3500, categoryType: "ExternalPayment", recipientParty: "preo-demo-recipient", requiresApproval: false },
    { categoryId: "debt", label: "Debt Paydown", percentageBps: 2500, categoryType: "ExternalPayment", recipientParty: "preo-debt-recipient", requiresApproval: false },
    { categoryId: "emergency", label: "Emergency Fund", percentageBps: 1500, categoryType: "InternalReserve", requiresApproval: false },
    { categoryId: "portfolio", label: "Portfolio", percentageBps: 1000, categoryType: "PortfolioAllocation", portfolioTarget: "TreasuryYield", requiresApproval: true },
    { categoryId: "spending", label: "Spending", percentageBps: 1500, categoryType: "ManualHold", requiresApproval: false }
  ],
  approvalRules: [{ ruleId: "new-recipient", actionType: "NewRecipient", enabled: true, description: "Ask before sending to a new recipient" }]
};

function parseAmountToUnits(amount: number | string, decimals: number): bigint {
  const text = String(amount).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new Error(`Invalid amount: ${text}`);
  }
  const [whole = "0", fraction = ""] = text.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(paddedFraction || "0");
}

function unitsToNumber(units: bigint, decimals: number): number {
  const divisor = 10n ** BigInt(decimals);
  const whole = units / divisor;
  const fraction = units % divisor;
  if (fraction === 0n) {
    return Number(whole);
  }
  return Number(`${whole}.${fraction.toString().padStart(decimals, "0")}`);
}

function allocationReason(category: CategoryRule, payrollAmount: number | string): string {
  return `Allocated ${formatBps(category.percentageBps)} of this payroll to ${category.label} because your active policy assigns ${category.percentageBps} bps to this category.`;
}

function approvalReason(line: AllocationLine): string {
  if (line.categoryType === "ExternalPayment") {
    return `Created an approval request for ${line.label} before sending ${formatAmount(line.amount)} ${line.asset}.`;
  }
  if (line.categoryType === "PortfolioAllocation") {
    return `Created an approval request for ${line.label} before allocating ${formatAmount(line.amount)} ${line.asset} to the portfolio.`;
  }
  return `Created an approval request for ${line.label} before applying this allocation.`;
}

function formatBps(bps: number): string {
  const percent = bps / 100;
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

function formatAmount(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}
