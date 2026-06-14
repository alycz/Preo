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

function privateKeyFromRawHex(hex: string): crypto.KeyObject | undefined {
  // A bare 32-byte EC scalar (optionally 0x-prefixed) is the most common way a
  // merchant signing key gets stored. Node can't import a raw scalar directly,
  // so derive the public point with ECDH and build a JWK. Try P-256 first
  // (matches the demo key) then secp256k1 (EVM-style merchant keys).
  const clean = hex.trim().replace(/^0x/i, "");
  if (!/^[0-9a-f]{64}$/i.test(clean)) {
    return undefined;
  }
  const d = Buffer.from(clean, "hex");
  for (const curve of ["prime256v1", "secp256k1"] as const) {
    try {
      const ecdh = crypto.createECDH(curve);
      ecdh.setPrivateKey(d);
      const pub = ecdh.getPublicKey(); // uncompressed: 0x04 || x(32) || y(32)
      const crv = curve === "prime256v1" ? "P-256" : "secp256k1";
      return crypto.createPrivateKey({
        key: {
          kty: "EC",
          crv,
          d: d.toString("base64url"),
          x: pub.subarray(1, 33).toString("base64url"),
          y: pub.subarray(33, 65).toString("base64url")
        },
        format: "jwk"
      });
    } catch {
      // try next curve
    }
  }
  return undefined;
}

function loadPrivateKey(rawValue: string) {
  // Normalize the most common ways a PEM gets mangled when stored in an env var:
  // literal "\n" escape sequences, surrounding quotes, and CRLF line endings.
  const normalized = rawValue
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\r\\n|\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();

  const attempts: Array<() => crypto.KeyObject> = [];

  if (normalized.includes("-----BEGIN")) {
    // Standard PEM (either real newlines or now-restored escaped newlines).
    attempts.push(() => crypto.createPrivateKey(normalized));
  } else {
    // Raw hex EC scalar (e.g. "0x…" or 64 hex chars) — the most common merchant
    // key format and the source of the ASN.1 "not enough data" error when it is
    // mistakenly decoded as base64 DER.
    const fromHex = privateKeyFromRawHex(normalized);
    if (fromHex) {
      attempts.push(() => fromHex);
    }
    // No PEM armor — also treat it as base64/base64url-encoded DER and try the
    // common PKCS#8 and SEC1 (EC) encodings.
    const der = Buffer.from(normalized.replace(/\s+/g, ""), "base64");
    attempts.push(() => crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" }));
    attempts.push(() => crypto.createPrivateKey({ key: der, format: "der", type: "sec1" }));
  }

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return attempt();
    } catch (error) {
      lastError = error;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `BLINK_MERCHANT_PRIVATE_KEY could not be parsed. Provide a PKCS#8 PEM (-----BEGIN PRIVATE KEY-----) ` +
      `or base64-encoded DER private key. Underlying error: ${detail}`
  );
}

function privateKeyFromOptions(options: BlinkSigningOptions) {
  if (options.privateKeyPem) {
    return loadPrivateKey(options.privateKeyPem);
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
