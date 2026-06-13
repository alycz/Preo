import { demoConfirmDepositRequestSchema, makeDemoTxHash } from "@preo/shared";
import { errorResponse, ok, parseJson } from "@/lib/http";
import { createPayrollCreditFromFundingIntent } from "@/lib/orchestration";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (process.env.DEMO_MODE !== "true" && process.env.CANTON_JSON_API_URL) {
      return ok({ error: "DEMO_MODE_DISABLED" }, { status: 403 });
    }

    const input = await parseJson(request, demoConfirmDepositRequestSchema);
    const user = await getRequiredUser(input.dynamicUserId);
    const sourceRef = input.sourceRef ?? `demo-confirmed-${Date.now()}`;
    const settlementTxHash = makeDemoTxHash("demo-payroll");
    const intent = await prisma.fundingIntent.create({
      data: {
        userId: user.id,
        provider: "demo_employer",
        amount: input.amount,
        token: input.asset,
        externalRef: sourceRef,
        status: "settled",
        settlementTxHash
      }
    });
    const credit = await createPayrollCreditFromFundingIntent(intent.id, { sourceRef, evmTxHash: settlementTxHash });

    return ok({
      fundingIntentId: intent.id,
      settlementTxHash,
      cantonCreditContractId: credit.contractId,
      duplicate: credit.duplicate,
      nextAction: "run_payroll_allocation"
    });
  } catch (error) {
    return errorResponse(error);
  }
}

