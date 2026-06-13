import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { errorResponse, ok } from "@/lib/http";
import { createPayrollCreditFromFundingIntent } from "@/lib/orchestration";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function verifySignature(rawBody: string, signature: string | null) {
  const secret = process.env.DYNAMIC_WEBHOOK_SECRET;
  if (!secret) {
    return process.env.DEMO_MODE === "true";
  }
  if (!signature) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const normalized = signature.replace(/^sha256=/, "");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(normalized));
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const data = payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : {};
    const signatureValid = verifySignature(rawBody, request.headers.get("x-dynamic-signature"));
    const eventType = String(payload.type ?? payload.eventType ?? "dynamic.flow.unknown");
    const eventId = payload.id ? String(payload.id) : undefined;

    const webhook = await prisma.webhookEvent.create({
      data: {
        provider: "dynamic_flow",
        eventType,
        eventId,
        payload: payload as Prisma.InputJsonValue,
        signatureValid
      }
    });

    if (!signatureValid) {
      return ok({ received: true, signatureValid: false }, { status: 202 });
    }

    const transactionId = String(payload.transactionId ?? data.transactionId ?? "");
    const settlementState = String(payload.settlementState ?? data.settlementState ?? "");
    const settlementTxHash = payload.settlementTxHash ? String(payload.settlementTxHash) : undefined;

    if (transactionId && settlementState === "completed") {
      const intent = await prisma.fundingIntent.findUnique({ where: { transactionId }, include: { user: true } });
      if (intent && !intent.cantonCreditContractId) {
        await prisma.fundingIntent.update({
          where: { id: intent.id },
          data: {
            status: "settled",
            settlementTxHash
          }
        });
        await createPayrollCreditFromFundingIntent(intent.id, { sourceRef: transactionId, evmTxHash: settlementTxHash });
      }
    }

    await prisma.webhookEvent.update({ where: { id: webhook.id }, data: { processedAt: new Date() } });
    return ok({ received: true, signatureValid });
  } catch (error) {
    return errorResponse(error);
  }
}
