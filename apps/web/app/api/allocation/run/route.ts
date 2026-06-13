import { allocationRunRequestSchema } from "@preo/shared";
import { errorResponse, ok, parseJson } from "@/lib/http";
import { recordCantonContract } from "@/lib/orchestration";
import { getRequiredUser } from "@/lib/users";
import { canton } from "@/lib/canton";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, allocationRunRequestSchema);
    const user = await getRequiredUser(input.dynamicUserId);
    const result = await canton.runAllocation({
      user: user.cantonPartyId,
      payrollCreditContractId: input.payrollCreditContractId,
      policyContractId: input.policyContractId
    });

    await Promise.all([
      recordCantonContract(result.run, { userId: user.id, partyId: user.cantonPartyId }),
      ...result.balances.map((contract) => recordCantonContract(contract, { userId: user.id, partyId: user.cantonPartyId })),
      ...result.pendingActions.map((contract) => recordCantonContract(contract, { userId: user.id, partyId: user.cantonPartyId })),
      ...result.payments.map((contract) => recordCantonContract(contract, { userId: user.id, partyId: user.cantonPartyId })),
      ...result.portfolioAllocations.map((contract) => recordCantonContract(contract, { userId: user.id, partyId: user.cantonPartyId }))
    ]);

    return ok({
      runId: (result.run.payload as { runId?: string }).runId,
      status: (result.run.payload as { status?: string }).status,
      allocationRunContractId: result.run.contractId,
      lines: result.lines,
      balances: result.balances,
      pendingActions: result.pendingActions,
      payments: result.payments,
      portfolioAllocations: result.portfolioAllocations
    });
  } catch (error) {
    return errorResponse(error);
  }
}

