import { blinkSessionRequestSchema } from "@preo/shared";
import { errorResponse, ok, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { externalRefHash, getSettlementConfig, preoUserIdHash } from "@/lib/settlement";
import { getRequiredUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, blinkSessionRequestSchema);
    const user = await getRequiredUser(input.dynamicUserId);
    const config = getSettlementConfig();
    const amount = input.amount ?? "250.00";
    const externalRef = `blink-${user.id}-${Date.now()}`;
    const externalRefBytes32 = externalRefHash(externalRef);

    const intent = await prisma.fundingIntent.create({
      data: {
        userId: user.id,
        provider: "blink",
        amount,
        token: "USDC",
        chainId: config.chainId,
        tokenAddress: config.tokenAddress,
        destinationAddress: config.vaultAddress,
        externalRef,
        status: "awaiting_user_action",
        metadata: {
          signerPath: "/api/blink/sign-payment",
          preoUserIdHash: preoUserIdHash(user.id),
          externalRefBytes32,
          demoMode: config.demoMode
        }
      }
    });

    return ok({
      provider: "blink",
      fundingIntentId: intent.id,
      merchantId: process.env.NEXT_PUBLIC_BLINK_MERCHANT_ID || process.env.BLINK_MERCHANT_ID || "demo-blink-merchant",
      signerPath: "/api/blink/sign-payment",
      chainId: config.chainId,
      tokenAddress: config.tokenAddress,
      destinationAddress: config.vaultAddress,
      amount,
      preoUserIdHash: preoUserIdHash(user.id),
      externalRef,
      externalRefBytes32,
      status: intent.status,
      nextAction: "open_blink_deposit_or_use_direct_vault_deposit"
    });
  } catch (error) {
    return errorResponse(error);
  }
}
