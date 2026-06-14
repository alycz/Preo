import { createBlinkSignedPayload } from "../lib/blink";
import { getSettlementConfig } from "../lib/settlement";

const config = getSettlementConfig();
const signed = createBlinkSignedPayload(
  {
    amount: 25,
    chainId: config.chainId,
    address: config.vaultAddress,
    token: config.tokenAddress,
    callbackScheme: null,
    url: "https://pay-sandbox.blink.cash",
    version: "v1",
    reference: "web-smoke-blink",
    metadata: { source: "web-smoke" }
  },
  {
    merchantId: process.env.BLINK_MERCHANT_ID,
    privateKeyPem: process.env.BLINK_MERCHANT_PRIVATE_KEY,
    demoMode: config.demoMode
  }
);

console.log(
  JSON.stringify(
    {
      merchantId: signed.merchantId,
      payloadPreview: signed.payload.slice(0, 24),
      signaturePreview: signed.signature.slice(0, 24),
      preview: signed.preview
    },
    null,
    2
  )
);
