import { errorResponse, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ transactionId: string }> }) {
  try {
    const { transactionId } = await context.params;
    const intent = await prisma.fundingIntent.findUnique({ where: { transactionId } });
    if (!intent) {
      return ok({ error: "Funding intent not found" }, { status: 404 });
    }
    return ok({
      provider: intent.provider,
      fundingIntentId: intent.id,
      checkoutId: intent.checkoutId,
      transactionId: intent.transactionId,
      status: intent.status,
      settlementTxHash: intent.settlementTxHash,
      cantonCreditContractId: intent.cantonCreditContractId
    });
  } catch (error) {
    return errorResponse(error);
  }
}
