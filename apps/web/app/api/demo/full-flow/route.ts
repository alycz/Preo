import { z } from "zod";
import { createAgentWalletFromEnv } from "@preo/dynamic-integration";
import { bootstrapRequestSchema, executeApprovedActionRequestSchema } from "@preo/shared";
import { canton } from "@/lib/canton";
import { ensureDemoParties } from "@/lib/demo-parties";
import { errorResponse, ok, parseJson } from "@/lib/http";
import { createPayrollCreditFromFundingIntent, createPolicyForUser, recordCantonContract } from "@/lib/orchestration";
import { prisma } from "@/lib/prisma";
import { cantonPartyForDynamicUser } from "@/lib/users";

export const runtime = "nodejs";

const demoFullFlowRequestSchema = z.object({
  dynamicUserId: z.string().min(1),
  amount: z.string().default("2500.00"),
  primaryWalletAddress: z.string().optional(),
  email: z.string().email().optional()
});

const demoPolicy = {
  policyName: "Judge demo payroll policy",
  categories: [
    {
      categoryId: "rent",
      label: "Rent",
      percentageBps: 3500,
      categoryType: "ExternalPayment" as const,
      recipientParty: "preo-demo-recipient",
      requiresApproval: false
    },
    {
      categoryId: "reserve",
      label: "Emergency Fund",
      percentageBps: 2500,
      categoryType: "InternalReserve" as const,
      requiresApproval: false
    },
    {
      categoryId: "portfolio",
      label: "Portfolio",
      percentageBps: 2500,
      categoryType: "PortfolioAllocation" as const,
      portfolioTarget: { custom: "Preo Demo Balanced Allocation" },
      requiresApproval: true
    },
    {
      categoryId: "spending",
      label: "Spending",
      percentageBps: 1500,
      categoryType: "ManualHold" as const,
      requiresApproval: false
    }
  ],
  approvalRules: [
    {
      ruleId: "portfolio",
      actionType: "ActionPortfolioAllocation" as const,
      enabled: true,
      description: "Ask before portfolio allocation"
    },
    {
      ruleId: "new-recipient",
      actionType: "ActionNewRecipient" as const,
      enabled: true,
      description: "Ask before new recipients"
    }
  ]
};

export async function POST(request: Request) {
  try {
    if (process.env.DEMO_MODE !== "true" && process.env.CANTON_JSON_API_URL) {
      return ok({ error: "DEMO_MODE_DISABLED" }, { status: 403 });
    }

    const input = await parseJson(request, demoFullFlowRequestSchema);
    const agentWallet = createAgentWalletFromEnv();
    const agentWalletAddress = await agentWallet.getAddress();
    const cantonPartyId = cantonPartyForDynamicUser(input.dynamicUserId);
    await canton.allocateParty(cantonPartyId, input.email ?? input.dynamicUserId);
    const parties = await ensureDemoParties();

    const user = await prisma.user.upsert({
      where: { dynamicUserId: input.dynamicUserId },
      update: {
        email: input.email,
        primaryWalletAddress: input.primaryWalletAddress,
        agentWalletAddress
      },
      create: {
        dynamicUserId: input.dynamicUserId,
        email: input.email,
        primaryWalletAddress: input.primaryWalletAddress,
        agentWalletAddress,
        cantonPartyId
      }
    });

    const existingProfiles = await canton.query("Preo.User:UserProfile", { user: user.cantonPartyId }, user.cantonPartyId);
    const profile = existingProfiles[0] ?? (await canton.createUserProfile(user.cantonPartyId, input.email ?? input.dynamicUserId));
    await recordCantonContract(profile, { userId: user.id, partyId: user.cantonPartyId });

    const { contract: policyContract } = await createPolicyForUser(user, demoPolicy);

    const payrollRef = `demo-full-flow-${Date.now()}`;
    const notice = await canton.createEmployerPayrollNotice({
      employer: parties.employer.cantonPartyId,
      employee: user.cantonPartyId,
      grossAmount: input.amount,
      asset: "USDC",
      payrollRef
    });
    await recordCantonContract(notice, { userId: user.id, partyId: parties.employer.cantonPartyId });

    const intent = await prisma.fundingIntent.create({
      data: {
        userId: user.id,
        provider: "demo_employer",
        amount: input.amount,
        token: "USDC",
        externalRef: payrollRef,
        status: "settled",
        metadata: { payrollNoticeContractId: notice.contractId }
      }
    });
    const credit = await createPayrollCreditFromFundingIntent(intent.id, { sourceRef: payrollRef });

    const allocation = await canton.runAllocation({
      user: user.cantonPartyId,
      payrollCreditContractId: credit.contractId,
      policyContractId: policyContract.contractId
    });
    await Promise.all([
      recordCantonContract(allocation.run, { userId: user.id, partyId: user.cantonPartyId }),
      ...allocation.balances.map((contract) => recordCantonContract(contract, { userId: user.id, partyId: user.cantonPartyId })),
      ...allocation.pendingActions.map((contract) => recordCantonContract(contract, { userId: user.id, partyId: user.cantonPartyId })),
      ...allocation.payments.map((contract) => recordCantonContract(contract, { userId: user.id, partyId: user.cantonPartyId })),
      ...allocation.portfolioAllocations.map((contract) => recordCantonContract(contract, { userId: user.id, partyId: user.cantonPartyId }))
    ]);

    const pending = allocation.pendingActions.find((action) => action.payload.status === "Pending") ?? null;
    const approved = pending ? await canton.approvePendingAction(pending.contractId, user.cantonPartyId) : null;
    if (approved) {
      await recordCantonContract(approved, { userId: user.id, partyId: user.cantonPartyId });
    }

    let executedAction: Record<string, unknown> | null = null;
    if (approved) {
      const payload = approved.payload as Record<string, unknown>;
      const executionInput = executeApprovedActionRequestSchema.parse({
        dynamicUserId: input.dynamicUserId,
        pendingActionContractId: approved.contractId,
        actionId: String(payload.actionId ?? approved.contractId),
        cantonPartyId: user.cantonPartyId,
        amount: String(payload.amount ?? "0"),
        asset: String(payload.asset ?? "USDC"),
        pendingActionStatus: "Approved",
        actionType: String(payload.actionType ?? "ActionPortfolioAllocation"),
        runId: String(payload.actionId ?? approved.contractId).split(":")[0]
      });
      const txHash = await agentWallet.signMessage(`Preo approved action ${executionInput.actionId}`);
      const agentAction = await prisma.agentAction.create({
        data: {
          userId: user.id,
          actionType: executionInput.actionType,
          status: "simulated",
          dynamicWalletAddress: agentWalletAddress,
          evmTxHash: txHash,
          pendingActionId: approved.contractId,
          amount: executionInput.amount,
          asset: executionInput.asset
        }
      });
      const executed = await canton.executeApprovedAction({
        user: user.cantonPartyId,
        pendingActionContractId: approved.contractId,
        runId: executionInput.runId ?? executionInput.actionId.split(":")[0] ?? executionInput.actionId,
        evmTxHash: txHash
      });
      const executedContract = await canton.getPendingAction(executed.contractId, user.cantonPartyId);
      if (executedContract) {
        await recordCantonContract(executedContract, { userId: user.id, partyId: user.cantonPartyId });
      }
      await prisma.agentAction.update({
        where: { id: agentAction.id },
        data: { cantonContractId: executed.contractId }
      });
      executedAction = {
        agentActionId: agentAction.id,
        status: "simulated",
        evmTxHash: txHash,
        cantonContractId: executed.contractId,
        cantonLive: executed.live
      };
    }

    const bootstrap = bootstrapRequestSchema.parse({
      dynamicUserId: input.dynamicUserId,
      primaryWalletAddress: input.primaryWalletAddress,
      email: input.email
    });

    return ok({
      bootstrap: {
        preoUserId: user.id,
        cantonPartyId: user.cantonPartyId,
        primaryWalletAddress: bootstrap.primaryWalletAddress ?? user.primaryWalletAddress,
        agentWalletAddress,
        hasPolicy: true,
        hasCantonProfile: true
      },
      policyContractId: policyContract.contractId,
      payrollNoticeContractId: notice.contractId,
      cantonCreditContractId: credit.contractId,
      allocationRunContractId: allocation.run.contractId,
      approvedActionContractId: approved?.contractId ?? null,
      executedAction,
      nextPath: "/privacy-demo"
    });
  } catch (error) {
    return errorResponse(error);
  }
}
