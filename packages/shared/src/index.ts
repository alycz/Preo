import { z } from "zod";

export const hexAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "expected an EVM address");

export const optionalHexAddressSchema = z.union([hexAddressSchema, z.literal(""), z.undefined()]).transform((value) => {
  return value === "" ? undefined : value;
});

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

export const agentActionStatusSchema = z.enum(["pending", "submitted", "executed", "failed", "simulated"]);
export type AgentActionStatus = z.infer<typeof agentActionStatusSchema>;

export const fundingStatusSchema = z.enum([
  "created",
  "flow_unavailable_use_direct_deposit",
  "awaiting_user_action",
  "settled",
  "failed"
]);
export type FundingStatus = z.infer<typeof fundingStatusSchema>;

export type BootstrapRequest = z.infer<typeof bootstrapRequestSchema>;
export type BootstrapResponse = z.infer<typeof bootstrapResponseSchema>;
export type FlowCheckoutRequest = z.infer<typeof flowCheckoutRequestSchema>;
export type DirectDepositRequest = z.infer<typeof directDepositRequestSchema>;
export type ExecuteApprovedActionRequest = z.infer<typeof executeApprovedActionRequestSchema>;

export function makeDemoTxHash(prefix = "preo"): `0x${string}` {
  const raw = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const hex = Buffer.from(raw).toString("hex").padEnd(64, "0").slice(0, 64);
  return `0x${hex}`;
}
