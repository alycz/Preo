import { createBlinkSignedPayload } from "../apps/web/lib/blink";
import { getSettlementConfig } from "../apps/web/lib/settlement";

const env = process.env;
const config = getSettlementConfig(env);
const missing = [
  !env.BLINK_MERCHANT_ID ? "BLINK_MERCHANT_ID" : null,
  !env.BLINK_MERCHANT_PRIVATE_KEY ? "BLINK_MERCHANT_PRIVATE_KEY" : null
].filter(Boolean);

if (missing.length && env.LIVE_BLINK_REQUIRED === "true") {
  throw new Error(`LIVE_BLINK_REQUIRED=true but missing ${missing.join(", ")}`);
}
if (missing.length) {
  console.log(`LIVE_DISABLED: missing env var ${missing.join(", ")}; demo fallback passed`);
}

const signed = createBlinkSignedPayload(
  {
    amount: 25,
    chainId: config.chainId,
    address: config.vaultAddress,
    token: config.tokenAddress,
    callbackScheme: null,
    url: "https://pay-sandbox.blink.cash",
    version: "v1",
    reference: "smoke-blink",
    metadata: { source: "root-smoke" }
  },
  {
    merchantId: env.BLINK_MERCHANT_ID,
    privateKeyPem: env.BLINK_MERCHANT_PRIVATE_KEY,
    demoMode: config.demoMode || missing.length > 0
  }
);

console.log(
  JSON.stringify(
    {
      merchantId: signed.merchantId,
      payloadPresent: signed.payload.length > 0,
      signaturePresent: signed.signature.length > 0,
      payloadPreview: signed.payload.slice(0, 24),
      signaturePreview: signed.signature.slice(0, 24),
      preview: signed.preview
    },
    null,
    2
  )
);
