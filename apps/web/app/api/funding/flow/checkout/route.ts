import { createDynamicFlowConfigFromEnv, getFlowAvailability } from "@preo/dynamic-integration";
import { flowCheckoutRequestSchema } from "@preo/shared";
import { errorResponse, ok, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, flowCheckoutRequestSchema);
    const user = await getRequiredUser(input.dynamicUserId);
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

    const transactionId = `flow-local-${Date.now()}`;
    const intent = await prisma.fundingIntent.create({
      data: {
        userId: user.id,
        provider: "dynamic_flow",
        checkoutId: availability.checkoutId,
        transactionId,
        amount: input.amount,
        token: input.currency,
        status: "awaiting_user_action",
        metadata: { purpose: input.purpose }
      }
    });

    return ok({
      provider: "dynamic_flow",
      fundingIntentId: intent.id,
      checkoutId: availability.checkoutId,
      transactionId,
      status: intent.status,
      nextAction: "start_dynamic_flow_checkout_in_client"
    });
  } catch (error) {
    return errorResponse(error);
  }
}
