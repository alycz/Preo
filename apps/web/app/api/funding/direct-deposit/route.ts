import { directDepositRequestSchema, makeDemoTxHash } from "@preo/shared";
import { canton } from "@/lib/canton";
import { errorResponse, ok, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, directDepositRequestSchema);
    const user = await getRequiredUser(input.dynamicUserId);
    const sourceRef = input.sourceRef ?? `direct-${Date.now()}`;
    const settlementTxHash = input.evmTxHash ?? makeDemoTxHash("direct");
    const credit = await canton.createPayrollCredit({
      user: user.cantonPartyId,
      amount: input.amount,
      asset: input.asset,
      sourceRef,
      evmTxHash: settlementTxHash
    });

    const intent = await prisma.fundingIntent.create({
      data: {
        userId: user.id,
        provider: "direct_testnet",
        amount: input.amount,
        token: input.asset,
        status: "settled",
        settlementTxHash,
        cantonCreditContractId: credit.contractId,
        metadata: { sourceRef, cantonLive: credit.live }
      }
    });

    return ok({
      provider: "direct_testnet",
      fundingIntentId: intent.id,
      status: intent.status,
      settlementTxHash,
      cantonCreditContractId: credit.contractId,
      nextAction: "run_payroll_allocation"
    });
  } catch (error) {
    return errorResponse(error);
  }
}
