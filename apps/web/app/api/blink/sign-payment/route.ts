import { blinkSignPaymentRequestSchema } from "@preo/shared";
import { createBlinkSignedPayload } from "@/lib/blink";
import { errorResponse, ok, parseJson } from "@/lib/http";
import { getSettlementConfig } from "@/lib/settlement";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, blinkSignPaymentRequestSchema);
    const config = getSettlementConfig();

    if (input.chainId !== config.chainId) {
      return ok({ error: `Unsupported settlement chain ${input.chainId}` }, { status: 400 });
    }
    if (input.token.toLowerCase() !== config.tokenAddress.toLowerCase()) {
      return ok({ error: "Unsupported settlement token" }, { status: 400 });
    }
    if (input.address.toLowerCase() !== config.vaultAddress.toLowerCase()) {
      return ok({ error: "Blink destination must be the Preo funding vault" }, { status: 400 });
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
