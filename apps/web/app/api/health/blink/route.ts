import { ok } from "@/lib/http";
import { getSettlementConfig } from "@/lib/settlement";

export const runtime = "nodejs";

export async function GET() {
  const env = process.env;
  const merchantIdPresent = Boolean(env.BLINK_MERCHANT_ID);
  const privateKeyPresent = Boolean(env.BLINK_MERCHANT_PRIVATE_KEY);
  const publicMerchantIdPresent = Boolean(env.NEXT_PUBLIC_BLINK_MERCHANT_ID);
  const warnings: string[] = [];

  let settlementReady = true;
  try {
    getSettlementConfig(env);
  } catch (error) {
    settlementReady = false;
    warnings.push(`Settlement config incomplete: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!merchantIdPresent) {
    warnings.push("BLINK_MERCHANT_ID is missing");
  }
  if (!privateKeyPresent) {
    warnings.push("BLINK_MERCHANT_PRIVATE_KEY is missing");
  }

  return ok({
    merchantIdPresent,
    privateKeyPresent,
    publicMerchantIdPresent,
    mode: merchantIdPresent && privateKeyPresent ? "live" : "demo",
    signerReady: settlementReady && (merchantIdPresent && privateKeyPresent || env.DEMO_MODE === "true"),
    warnings
  });
}
