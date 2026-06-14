import { blinkSignPaymentRequestSchema } from "@preo/shared";
import { createBlinkSignedPayload } from "@/lib/blink";
import { errorResponse, ok, parseJson } from "@/lib/http";
import { getFundingSettlementConfig } from "@/lib/settlement";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, blinkSignPaymentRequestSchema);
    const config = getFundingSettlementConfig();

    if (input.chainId !== config.chainId) {
      return errorResponse(new Error(`Unsupported settlement chain ${input.chainId}`), 400);
    }
    if (input.token.toLowerCase() !== config.tokenAddress.toLowerCase()) {
      return errorResponse(new Error("Unsupported settlement token"), 400);
    }
    if (input.address.toLowerCase() !== config.vaultAddress.toLowerCase()) {
      return errorResponse(new Error("Blink destination must be the Preo funding vault"), 400);
    }

    const signed = createBlinkSignedPayload(input, {
      merchantId: process.env.BLINK_MERCHANT_ID,
      privateKeyPem: process.env.BLINK_MERCHANT_PRIVATE_KEY,
      demoMode: config.demoMode
    });

    return ok(signed, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
