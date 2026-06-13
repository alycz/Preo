import { z } from "zod";

export const hexAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "expected an EVM address");

export const optionalHexAddressSchema = z.preprocess((value) => (value === "" ? undefined : value), hexAddressSchema.optional());

export const txHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "expected an EVM transaction hash");

export const amountStringSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,6})?$/, "expected a positive decimal amount")
  .refine((value) => Number(value) > 0, "amount must be positive");

export const bootstrapRequestSchema = z.object({
  dynamicUserId: z.string().min(1),
  primaryWalletAddress: optionalHexAddressSchema,
  email: z.string().email().optional()
});

export const bootstrapResponseSchema = z.object({
  preoUserId: z.string(),
  cantonPartyId: z.string(),
  primaryWalletAddress: z.string().optional().nullable(),
  agentWalletAddress: z.string().optional().nullable(),
  hasPolicy: z.boolean(),
  hasCantonProfile: z.boolean()
});

export const flowCheckoutRequestSchema = z.object({
  dynamicUserId: z.string().min(1),
  amount: amountStringSchema,
  currency: z.string().default("USD"),
  purpose: z.string().default("payroll_deposit")
});

export const directDepositRequestSchema = z.object({
  dynamicUserId: z.string().min(1),
  amount: amountStringSchema,
  asset: z.string().default("USDC"),
  evmTxHash: z.string().optional(),
  sourceRef: z.string().optional()
});

export const blinkSessionRequestSchema = z.object({
  dynamicUserId: z.string().min(1),
  amount: amountStringSchema.optional()
});

export const blinkSignPaymentRequestSchema = z.object({
  amount: amountStringSchema,
  chainId: z.number().int().positive(),
  address: hexAddressSchema,
  token: hexAddressSchema,
  callbackScheme: z.null().optional()
});

export const evmVerifyDepositRequestSchema = z.object({
  dynamicUserId: z.string().min(1),
  txHash: txHashSchema,
  chainId: z.number().int().positive().optional(),
  expectedLogIndex: z.number().int().nonnegative().optional(),
  demoAmount: amountStringSchema.optional(),
  sourceRef: z.string().optional()
});

export const executeApprovedActionRequestSchema = z.object({
  dynamicUserId: z.string().min(1),
  pendingActionContractId: z.string().min(1),
  actionId: z.string().min(1),
  cantonPartyId: z.string().min(1),
  toAddress: hexAddressSchema.optional(),
  amount: amountStringSchema,
  asset: z.string().default("USDC"),
  tokenAddress: hexAddressSchema.optional(),
  pendingActionStatus: z.enum(["Pending", "Approved", "Rejected", "Executed"]).optional(),
  actionType: z.string().default("ActionExternalPayment"),
  runId: z.string().optional()
});

export const categoryTypeSchema = z.enum(["InternalReserve", "ExternalPayment", "PortfolioAllocation", "ManualHold"]);
export const actionTypeSchema = z.enum([
  "ActionExternalPayment",
  "ActionPortfolioAllocation",
  "ActionExternalWithdrawal",
  "ActionPolicyChange",
  "ActionNewRecipient",
  "ActionLargeTransfer"
]);
export const portfolioModelSchema = z.enum(["GlobalEquityBasket", "TreasuryYield", "USDCSavings"]);
export const pendingActionStatusValueSchema = z.enum(["Pending", "Approved", "Rejected", "Executed"]);

export const optionalPartySchema = z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional());

export const optionalTextSchema = z.preprocess((value) => (value === "" ? undefined : value), z.string().min(1).optional());

export const percentageBpsSchema = z.coerce.number().int().min(0).max(10000);

export const policyCategorySchema = z.object({
  categoryId: z.string().trim().min(1),
  label: z.string().trim().min(1),
  percentageBps: percentageBpsSchema,
  categoryType: categoryTypeSchema,
  recipientParty: optionalPartySchema,
  externalAddress: optionalTextSchema,
  portfolioTarget: portfolioModelSchema.optional(),
  requiresApproval: z.boolean().default(false)
});

export const approvalRuleSchema = z.object({
  ruleId: z.string().trim().min(1),
  actionType: actionTypeSchema,
  enabled: z.boolean(),
  thresholdAmount: amountStringSchema.optional(),
  appliesToCategoryId: optionalTextSchema,
  description: z.string().default("")
});

export const policyInputSchema = z.object({
  policyName: z.string().trim().min(1),
  categories: z.array(policyCategorySchema).min(1),
  approvalRules: z.array(approvalRuleSchema).default([])
});

export const policyRequestSchema = policyInputSchema.extend({
  dynamicUserId: z.string().min(1)
});

export const policyValidationErrorCodeSchema = z.enum([
  "POLICY_PERCENTAGE_SUM_INVALID",
  "CATEGORY_MISSING_RECIPIENT",
  "CATEGORY_MISSING_PORTFOLIO_TARGET"
]);

export const allocationRunRequestSchema = z.object({
  dynamicUserId: z.string().min(1),
  payrollCreditContractId: z.string().min(1),
  policyContractId: z.string().min(1).optional()
});

export const approvalActionRequestSchema = z.object({
  dynamicUserId: z.string().min(1)
});

export const dynamicUserQuerySchema = z.object({
  dynamicUserId: z.string().min(1)
});

export const partyViewRoleSchema = z.enum(["user", "employer", "recipient", "operator", "other-user"]);

export const demoEmployerPayrollRequestSchema = z.object({
  dynamicUserId: z.string().min(1),
  amount: amountStringSchema.default("2500.00"),
  asset: z.string().default("USDC"),
  payrollRef: z.string().optional()
});

export const demoConfirmDepositRequestSchema = z.object({
  dynamicUserId: z.string().min(1),
  amount: amountStringSchema.default("2500.00"),
  asset: z.string().default("USDC"),
  sourceRef: z.string().optional()
});

export const agentActionStatusSchema = z.enum(["pending", "submitted", "executed", "failed", "simulated"]);
export type AgentActionStatus = z.infer<typeof agentActionStatusSchema>;

export const fundingStatusSchema = z.enum([
  "created",
  "flow_unavailable_use_direct_deposit",
  "awaiting_user_action",
  "settled",
  "verified",
  "failed"
]);
export type FundingStatus = z.infer<typeof fundingStatusSchema>;

export type BootstrapRequest = z.infer<typeof bootstrapRequestSchema>;
export type BootstrapResponse = z.infer<typeof bootstrapResponseSchema>;
export type FlowCheckoutRequest = z.infer<typeof flowCheckoutRequestSchema>;
export type DirectDepositRequest = z.infer<typeof directDepositRequestSchema>;
export type BlinkSessionRequest = z.infer<typeof blinkSessionRequestSchema>;
export type BlinkSignPaymentRequest = z.infer<typeof blinkSignPaymentRequestSchema>;
export type EvmVerifyDepositRequest = z.infer<typeof evmVerifyDepositRequestSchema>;
export type ExecuteApprovedActionRequest = z.infer<typeof executeApprovedActionRequestSchema>;
export type CategoryType = z.infer<typeof categoryTypeSchema>;
export type ActionType = z.infer<typeof actionTypeSchema>;
export type PortfolioModel = z.infer<typeof portfolioModelSchema>;
export type PolicyCategory = z.infer<typeof policyCategorySchema>;
export type ApprovalRule = z.infer<typeof approvalRuleSchema>;
export type PolicyInput = z.infer<typeof policyInputSchema>;
export type PolicyRequest = z.infer<typeof policyRequestSchema>;
export type AllocationRunRequest = z.infer<typeof allocationRunRequestSchema>;
export type PartyViewRole = z.infer<typeof partyViewRoleSchema>;

export type PolicyValidationErrorCode = z.infer<typeof policyValidationErrorCodeSchema>;
export type ApiErrorCode =
  | PolicyValidationErrorCode
  | "FUNDING_NOT_SETTLED"
  | "CANTON_COMMAND_FAILED"
  | "APPROVAL_NOT_FOUND"
  | "ACTION_NOT_APPROVED"
  | "DYNAMIC_WALLET_TX_FAILED"
  | "DEMO_MODE_DISABLED";

export function validatePolicyInput(policy: PolicyInput): { valid: true; errors: [] } | { valid: false; errors: Array<{ code: PolicyValidationErrorCode; message: string; categoryId?: string }> } {
  const errors: Array<{ code: PolicyValidationErrorCode; message: string; categoryId?: string }> = [];
  const totalBps = policy.categories.reduce((sum, category) => sum + category.percentageBps, 0);
  if (totalBps !== 10000) {
    errors.push({
      code: "POLICY_PERCENTAGE_SUM_INVALID",
      message: "Policy category percentages must sum to 10000 basis points"
    });
  }

  for (const category of policy.categories) {
    if (category.categoryType === "ExternalPayment" && !category.recipientParty && !category.externalAddress) {
      errors.push({
        code: "CATEGORY_MISSING_RECIPIENT",
        message: "External payment categories require a recipient party or external address",
        categoryId: category.categoryId
      });
    }
    if (category.categoryType === "PortfolioAllocation" && !category.portfolioTarget) {
      errors.push({
        code: "CATEGORY_MISSING_PORTFOLIO_TARGET",
        message: "Portfolio allocation categories require a portfolio target",
        categoryId: category.categoryId
      });
    }
  }

  return errors.length ? { valid: false, errors } : { valid: true, errors: [] };
}

export function makeDemoTxHash(prefix = "preo"): `0x${string}` {
  const raw = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const hex = Buffer.from(raw).toString("hex").padEnd(64, "0").slice(0, 64);
  return `0x${hex}`;
}
