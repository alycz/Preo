import { demoEmployerPayrollRequestSchema } from "@preo/shared";
import { canton } from "@/lib/canton";
import { ensureDemoParties } from "@/lib/demo-parties";
import { errorResponse, ok, parseJson } from "@/lib/http";
import { createPayrollCreditFromFundingIntent, recordCantonContract } from "@/lib/orchestration";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (process.env.DEMO_MODE !== "true" && process.env.CANTON_JSON_API_URL) {
      return ok({ error: "DEMO_MODE_DISABLED" }, { status: 403 });
    }

    const input = await parseJson(request, demoEmployerPayrollRequestSchema);
    const user = await getRequiredUser(input.dynamicUserId);
    const parties = await ensureDemoParties();
    const payrollRef = input.payrollRef ?? `demo-payroll-${Date.now()}`;
    const notice = await canton.createEmployerPayrollNotice({
      employer: parties.employer.cantonPartyId,
      employee: user.cantonPartyId,
      grossAmount: input.amount,
      asset: input.asset,
      payrollRef
    });
    await recordCantonContract(notice, { userId: user.id, partyId: parties.employer.cantonPartyId });

    const intent = await prisma.fundingIntent.create({
      data: {
        userId: user.id,
        provider: "demo_employer",
        amount: input.amount,
        token: input.asset,
        externalRef: payrollRef,
        status: "settled",
        metadata: { payrollNoticeContractId: notice.contractId }
      }
    });
    const credit = await createPayrollCreditFromFundingIntent(intent.id, { sourceRef: payrollRef });

    return ok({
      payrollNoticeContractId: notice.contractId,
      fundingIntentId: intent.id,
      cantonCreditContractId: credit.contractId,
      duplicate: credit.duplicate,
      nextAction: "run_payroll_allocation"
    });
  } catch (error) {
    return errorResponse(error);
  }
}

