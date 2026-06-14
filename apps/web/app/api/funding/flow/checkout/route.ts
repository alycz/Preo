import { createDynamicFlowConfigFromEnv, createFlowCheckoutTransaction, getFlowAvailability } from "@preo/dynamic-integration";
import { flowCheckoutRequestSchema } from "@preo/shared";
import { errorResponse, ok, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { ensureBootstrappedUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, flowCheckoutRequestSchema);
    const { user } = await ensureBootstrappedUser({ dynamicUserId: input.dynamicUserId, requireCantonProfile: false });
    const config = createDynamicFlowConfigFromEnv();
    const availability = getFlowAvailability(config);

    if (!availability.available) {
      const intent = await prisma.fundingIntent.create({
        data: {
          userId: user.id,
          provider: "dynamic_flow",
          amount: input.amount,
          token: input.currency,
          status: "flow_unavailable_use_direct_deposit",
          metadata: { reason: availability.reason, purpose: input.purpose }
        }
      });

      return ok({
        provider: "dynamic_flow",
        fundingIntentId: intent.id,
        checkoutId: null,
        transactionId: null,
        status: intent.status,
        nextAction: "use_direct_testnet_deposit",
        reason: availability.reason
      });
    }

    const checkout = await createFlowCheckoutTransaction(config, {
      amount: input.amount,
      currency: input.currency,
      purpose: input.purpose,
      userId: user.id
    });
    const metadata: Record<string, unknown> = { purpose: input.purpose, flowStatus: checkout.status };
    if ("reason" in checkout) {
      metadata.reason = checkout.reason;
    }
    if ("providerDetail" in checkout && checkout.providerDetail) {
      metadata.providerDetail = checkout.providerDetail;
    }
    if ("sessionExpiresAt" in checkout && checkout.sessionExpiresAt) {
      metadata.sessionExpiresAt = checkout.sessionExpiresAt;
    }

    const intent = await prisma.fundingIntent.create({
      data: {
        userId: user.id,
        provider: "dynamic_flow",
        checkoutId: availability.checkoutId,
        transactionId: checkout.transactionId,
        amount: input.amount,
        token: input.currency,
        status: checkout.status === "flow_transaction_created" ? "awaiting_user_action" : "flow_unavailable_use_direct_deposit",
        metadata
      }
    });

    return ok({
      provider: "dynamic_flow",
      fundingIntentId: intent.id,
      checkoutId: availability.checkoutId,
      transactionId: checkout.transactionId,
      status: intent.status,
      nextAction: checkout.nextAction,
      sessionToken: "sessionToken" in checkout ? checkout.sessionToken : undefined,
      sessionExpiresAt: "sessionExpiresAt" in checkout ? checkout.sessionExpiresAt : undefined,
      reason: "reason" in checkout ? checkout.reason : undefined
    });
  } catch (error) {
    return errorResponse(error);
  }
}
