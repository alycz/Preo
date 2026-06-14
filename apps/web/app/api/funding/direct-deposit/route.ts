import { directDepositRequestSchema, makeDemoTxHash } from "@preo/shared";
import { errorResponse, ok, parseJson } from "@/lib/http";
import { createPayrollCreditFromFundingIntent } from "@/lib/orchestration";
import { prisma } from "@/lib/prisma";
import { ensureBootstrappedUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, directDepositRequestSchema);
    const { user } = await ensureBootstrappedUser({ dynamicUserId: input.dynamicUserId });
    const sourceRef = input.sourceRef ?? `direct-${Date.now()}`;
    const settlementTxHash = input.evmTxHash ?? makeDemoTxHash("direct");
    const intent = await prisma.fundingIntent.create({
      data: {
        userId: user.id,
        provider: "direct_testnet",
        amount: input.amount,
        token: input.asset,
        status: "settled",
        settlementTxHash,
        metadata: { sourceRef }
      }
    });
    const credit = await createPayrollCreditFromFundingIntent(intent.id, { sourceRef, evmTxHash: settlementTxHash });

    return ok({
      provider: "direct_testnet",
      fundingIntentId: intent.id,
      status: intent.status,
      settlementTxHash,
      cantonCreditContractId: credit.contractId,
      duplicate: credit.duplicate,
      nextAction: "run_payroll_allocation"
    });
  } catch (error) {
    return errorResponse(error);
  }
}
