import crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import type { BlinkSignPaymentRequest } from "@preo/shared";

export type BlinkSignedPayload = {
  merchantId: string;
  payload: string;
  signature: string;
  preview: {
    amount: number;
    chainId: number;
    address: string;
    token: string;
    idempotencyKey: string;
    signatureTimestamp: string;
    demoMode: boolean;
  };
};

type BlinkSigningOptions = {
  merchantId?: string;
  privateKeyPem?: string;
  demoMode?: boolean;
  now?: Date;
  idempotencyKey?: string;
};

export function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function privateKeyFromOptions(options: BlinkSigningOptions) {
  if (options.privateKeyPem) {
    return crypto.createPrivateKey(options.privateKeyPem.replace(/\\n/g, "\n"));
  }

  if (!options.demoMode) {
    throw new Error("BLINK_MERCHANT_PRIVATE_KEY is required outside demo mode");
  }

  const { privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "prime256v1"
  });
  return privateKey;
}

export function createBlinkSignedPayload(
  input: BlinkSignPaymentRequest,
  options: BlinkSigningOptions = {}
): BlinkSignedPayload {
  const merchantId = options.merchantId || (options.demoMode ? "demo-blink-merchant" : undefined);
  if (!merchantId) {
    throw new Error("BLINK_MERCHANT_ID is required outside demo mode");
  }

  const signatureTimestamp = (options.now ?? new Date()).toISOString();
  const payloadObject = {
    amount: input.amount,
    chainId: input.chainId,
    address: input.address,
    token: input.token,
    callbackScheme: input.callbackScheme ?? null,
    idempotencyKey: options.idempotencyKey ?? randomUUID(),
    signatureTimestamp,
    version: input.version,
    ...(input.reference ? { reference: input.reference } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {})
  };
  const payload = base64url(JSON.stringify(payloadObject));
  const privateKey = privateKeyFromOptions(options);
  const signature = crypto.sign("sha256", Buffer.from(payload), privateKey).toString("base64url");

  return {
    merchantId,
    payload,
    signature,
    preview: {
      amount: payloadObject.amount,
      chainId: payloadObject.chainId,
      address: payloadObject.address,
      token: payloadObject.token,
      idempotencyKey: payloadObject.idempotencyKey,
      signatureTimestamp,
      demoMode: Boolean(options.demoMode && !options.privateKeyPem)
    }
  };
}
