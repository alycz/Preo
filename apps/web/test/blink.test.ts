import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { POST } from "../app/api/blink/sign-payment/route";
import { createBlinkSignedPayload } from "../lib/blink";

const payment = {
  amount: 25,
  chainId: 84532,
  address: "0x0000000000000000000000000000000000001000",
  token: "0x0000000000000000000000000000000000002000",
  callbackScheme: null,
  url: "https://pay-sandbox.blink.cash",
  version: "v1",
  reference: "test-payment",
  metadata: { invoiceId: "INV-456" }
};

describe("Blink signing", () => {
  it("returns a payload, signature, preview, and no private key material", () => {
    const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const signed = createBlinkSignedPayload(payment, {
      merchantId: "merchant",
      privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      now: new Date("2026-06-13T12:00:00.000Z"),
      idempotencyKey: "00000000-0000-4000-8000-000000000000"
    });

    expect(signed.merchantId).toBe("merchant");
    expect(signed.payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(signed.signature).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(signed.preview.amount).toBe(25);
    expect(signed.preview.signatureTimestamp).toBe("2026-06-13T12:00:00.000Z");
    expect(JSON.stringify(signed)).not.toContain("PRIVATE KEY");
  });

  it("sets no-store headers on signer responses", async () => {
    process.env.DEMO_MODE = "true";
    process.env.SETTLEMENT_CHAIN_ID = "84532";
    process.env.PREO_FUNDING_VAULT_ADDRESS = payment.address;
    process.env.TESTNET_USDC_ADDRESS = payment.token;

    const response = await POST(
      new Request("http://localhost/api/blink/sign-payment", {
        method: "POST",
        body: JSON.stringify(payment)
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const json = (await response.json()) as Record<string, unknown>;
    expect(json).toHaveProperty("payload");
    expect(json).not.toHaveProperty("privateKey");
  });

  it("falls back to demo signing when settlement env is missing", async () => {
    const savedEnv = {
      demoMode: process.env.DEMO_MODE,
      settlementChainId: process.env.SETTLEMENT_CHAIN_ID,
      vaultAddress: process.env.PREO_FUNDING_VAULT_ADDRESS,
      tokenAddress: process.env.TESTNET_USDC_ADDRESS,
      merchantId: process.env.BLINK_MERCHANT_ID,
      merchantPrivateKey: process.env.BLINK_MERCHANT_PRIVATE_KEY
    };

    process.env.DEMO_MODE = "false";
    delete process.env.SETTLEMENT_CHAIN_ID;
    delete process.env.PREO_FUNDING_VAULT_ADDRESS;
    delete process.env.TESTNET_USDC_ADDRESS;
    delete process.env.BLINK_MERCHANT_ID;
    delete process.env.BLINK_MERCHANT_PRIVATE_KEY;

    try {
      const response = await POST(
        new Request("http://localhost/api/blink/sign-payment", {
          method: "POST",
          body: JSON.stringify(payment)
        })
      );

      expect(response.status).toBe(200);
      const json = (await response.json()) as { merchantId?: string; preview?: { demoMode?: boolean } };
      expect(json.merchantId).toBe("demo-blink-merchant");
      expect(json.preview?.demoMode).toBe(true);
    } finally {
      if (savedEnv.demoMode === undefined) {
        delete process.env.DEMO_MODE;
      } else {
        process.env.DEMO_MODE = savedEnv.demoMode;
      }
      if (savedEnv.settlementChainId === undefined) {
        delete process.env.SETTLEMENT_CHAIN_ID;
      } else {
        process.env.SETTLEMENT_CHAIN_ID = savedEnv.settlementChainId;
      }
      if (savedEnv.vaultAddress === undefined) {
        delete process.env.PREO_FUNDING_VAULT_ADDRESS;
      } else {
        process.env.PREO_FUNDING_VAULT_ADDRESS = savedEnv.vaultAddress;
      }
      if (savedEnv.tokenAddress === undefined) {
        delete process.env.TESTNET_USDC_ADDRESS;
      } else {
        process.env.TESTNET_USDC_ADDRESS = savedEnv.tokenAddress;
      }
      if (savedEnv.merchantId === undefined) {
        delete process.env.BLINK_MERCHANT_ID;
      } else {
        process.env.BLINK_MERCHANT_ID = savedEnv.merchantId;
      }
      if (savedEnv.merchantPrivateKey === undefined) {
        delete process.env.BLINK_MERCHANT_PRIVATE_KEY;
      } else {
        process.env.BLINK_MERCHANT_PRIVATE_KEY = savedEnv.merchantPrivateKey;
      }
    }
  });
});
