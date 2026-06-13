import type { Prisma } from "@prisma/client";
import type { CantonContract, PolicyCategoryInput } from "@preo/canton-client";
import type { PolicyInput } from "@preo/shared";
import { validatePolicyInput } from "@preo/shared";
import { canton } from "./canton";
import { getDemoParty } from "./demo-parties";
import { prisma } from "./prisma";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400
  ) {
    super(message);
  }
}

export function jsonPayload(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function recordCantonContract(contract: CantonContract, input: { userId?: string; partyId: string; status?: "active" | "archived" }) {
  await prisma.cantonContract.upsert({
    where: { contractId: contract.contractId },
    update: {
      userId: input.userId,
      templateId: contract.templateId,
      partyId: input.partyId,
      status: input.status ?? "active",
      payload: jsonPayload(contract.payload),
      archivedAt: input.status === "archived" ? new Date() : null
    },
    create: {
      userId: input.userId,
      contractId: contract.contractId,
      templateId: contract.templateId,
      partyId: input.partyId,
      status: input.status ?? "active",
      payload: jsonPayload(contract.payload),
      archivedAt: input.status === "archived" ? new Date() : null
    }
  });
}

export function assertValidPolicy(policy: PolicyInput) {
  const result = validatePolicyInput(policy);
  if (!result.valid) {
    const first = result.errors[0] ?? {
      code: "POLICY_PERCENTAGE_SUM_INVALID",
      message: "Policy is invalid"
    };
    throw new ApiError(first.code, first.message, 422);
  }
  return result;
}

export function toCantonCategories(categories: PolicyInput["categories"]): PolicyCategoryInput[] {
  return categories.map((category) => ({
    categoryId: category.categoryId,
    label: category.label,
    percentageBps: category.percentageBps,
    categoryType: category.categoryType,
    recipientParty: category.recipientParty,
    externalAddress: category.externalAddress,
    portfolioTarget: category.portfolioTarget,
    requiresApproval: category.requiresApproval
  }));
}

export async function createPolicyForUser(user: { id: string; cantonPartyId: string }, input: PolicyInput) {
  assertValidPolicy(input);

  const latest = await prisma.policyCache.findFirst({
    where: { userId: user.id },
    orderBy: { version: "desc" }
  });
  const version = (latest?.version ?? 0) + 1;

  await prisma.policyCache.updateMany({
    where: { userId: user.id, active: true },
    data: { active: false }
  });

  const contract = await canton.createPayrollPolicy(user.cantonPartyId, {
    policyName: input.policyName,
    categories: toCantonCategories(input.categories),
    approvalRules: input.approvalRules,
    version
  });

  await recordCantonContract(contract, { userId: user.id, partyId: user.cantonPartyId });
  const cache = await prisma.policyCache.create({
    data: {
      userId: user.id,
      cantonContractId: contract.contractId,
      version,
      policyName: input.policyName,
      categories: jsonPayload(input.categories),
      approvalRules: jsonPayload(input.approvalRules),
      active: true
    }
  });

  return { contract, cache };
}

export async function getActivePolicyForUser(user: { id: string; cantonPartyId: string }) {
  const cache = await prisma.policyCache.findFirst({
    where: { userId: user.id, active: true },
    orderBy: { version: "desc" }
  });
  const contract = cache ? await canton.getActivePayrollPolicy(user.cantonPartyId, cache.cantonContractId) : await canton.getActivePayrollPolicy(user.cantonPartyId);
  return { cache, contract };
}

export async function createPayrollCreditFromFundingIntent(fundingIntentId: string, input?: { sourceRef?: string; evmTxHash?: string }) {
  const intent = await prisma.fundingIntent.findUnique({ where: { id: fundingIntentId }, include: { user: true } });
  if (!intent) {
    throw new ApiError("FUNDING_NOT_SETTLED", "Funding intent not found", 404);
  }
  if (intent.cantonCreditContractId) {
    return {
      duplicate: true,
      contractId: intent.cantonCreditContractId,
      fundingIntent: intent,
      live: false
    };
  }

  const sourceRef =
    input?.sourceRef ??
    intent.transactionId ??
    intent.externalRef ??
    (intent.chainId && intent.settlementTxHash && intent.logIndex !== null ? `${intent.chainId}:${intent.settlementTxHash}:${intent.logIndex}` : undefined) ??
    `${intent.provider}:${intent.id}`;

  const existing = await prisma.fundingIntent.findFirst({
    where: {
      id: { not: intent.id },
      userId: intent.userId,
      cantonCreditContractId: { not: null },
      OR: [{ transactionId: intent.transactionId }, { externalRef: sourceRef }, { settlementTxHash: input?.evmTxHash ?? intent.settlementTxHash }]
    }
  });
  if (existing?.cantonCreditContractId) {
    const updated = await prisma.fundingIntent.update({
      where: { id: intent.id },
      data: {
        status: "settled",
        cantonCreditContractId: existing.cantonCreditContractId,
        externalRef: sourceRef,
        settlementTxHash: input?.evmTxHash ?? intent.settlementTxHash
      },
      include: { user: true }
    });
    return {
      duplicate: true,
      contractId: existing.cantonCreditContractId,
      fundingIntent: updated,
      live: false
    };
  }

  const credit = await canton.createPayrollCredit({
    user: intent.user.cantonPartyId,
    amount: intent.amount,
    asset: intent.token,
    sourceRef,
    flowTransactionId: intent.provider === "dynamic_flow" ? intent.transactionId ?? undefined : undefined,
    evmTxHash: input?.evmTxHash ?? intent.settlementTxHash ?? undefined
  });

  await recordCantonContract(
    {
      contractId: credit.contractId,
      templateId: "Preo.Payroll:PayrollCredit",
      payload: {
        user: intent.user.cantonPartyId,
        amount: intent.amount,
        asset: intent.token,
        sourceRef,
        evmTxHash: input?.evmTxHash ?? intent.settlementTxHash ?? null
      }
    },
    { userId: intent.userId, partyId: intent.user.cantonPartyId }
  );

  const operator = await getDemoParty("operator");
  const audit = await canton.createOperatorAuditEvent({
    operator: operator.cantonPartyId,
    userAlias: intent.user.id,
    eventType: "PayrollCreditCreated",
    status: "credited",
    referenceHash: sourceRef
  });
  await recordCantonContract(audit, { partyId: operator.cantonPartyId });

  const fundingIntent = await prisma.fundingIntent.update({
    where: { id: intent.id },
    data: {
      status: "settled",
      externalRef: sourceRef,
      settlementTxHash: input?.evmTxHash ?? intent.settlementTxHash,
      cantonCreditContractId: credit.contractId
    },
    include: { user: true }
  });

  return {
    duplicate: false,
    contractId: credit.contractId,
    fundingIntent,
    live: credit.live
  };
}
