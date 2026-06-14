export type DynamicFlowConfig = {
  environmentId?: string;
  checkoutId?: string;
  authToken?: string;
  apiBaseUrl?: string;
};

const DEFAULT_DYNAMIC_API_BASE = "https://app.dynamicauth.com/api/v0";

export type DynamicFlowCheckoutInput = {
  amount: string;
  currency: string;
  purpose: string;
  userId: string;
};

export type FlowAvailability =
  | { available: true; checkoutId: string }
  | { available: false; reason: "missing_checkout_id" | "missing_environment_id" };

export type DynamicFlowCheckoutResult =
  | {
      status: "flow_transaction_created";
      checkoutId: string;
      transactionId: string;
      sessionToken?: string;
      sessionExpiresAt?: string;
      nextAction: "start_dynamic_flow_checkout_in_client";
      raw?: unknown;
    }
  | {
      status: "flow_scaffold_ready";
      checkoutId: string;
      transactionId: null;
      nextAction: "use_direct_testnet_deposit";
      reason: string;
      providerDetail?: string;
    };

export function getFlowAvailability(config: DynamicFlowConfig): FlowAvailability {
  if (!config.environmentId) {
    return { available: false, reason: "missing_environment_id" };
  }
  if (!config.checkoutId) {
    return { available: false, reason: "missing_checkout_id" };
  }
  return { available: true, checkoutId: config.checkoutId };
}

export function flowTerminalStatus(state?: string | null) {
  return state === "completed" || state === "failed" || state === "cancelled" || state === "expired";
}

export function createDynamicFlowConfigFromEnv(env: NodeJS.ProcessEnv = process.env): DynamicFlowConfig {
  return {
    environmentId: env.DYNAMIC_ENVIRONMENT_ID ?? env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID,
    checkoutId: env.DYNAMIC_FLOW_CHECKOUT_ID,
    authToken: env.DYNAMIC_AUTH_TOKEN,
    apiBaseUrl: env.DYNAMIC_API_BASE_URL
  };
}

export async function createFlowCheckoutTransaction(
  config: DynamicFlowConfig,
  input: DynamicFlowCheckoutInput
): Promise<DynamicFlowCheckoutResult> {
  const availability = getFlowAvailability(config);
  if (!availability.available) {
    throw new Error(`Dynamic Flow unavailable: ${availability.reason}`);
  }

  // Existing Flow checkouts can create transactions through the SDK-scoped
  // endpoint. Checkout management still uses the server auth token elsewhere.
  const baseUrl = (config.apiBaseUrl ?? DEFAULT_DYNAMIC_API_BASE).replace(/\/+$/, "");
  const url = `${baseUrl}/sdk/${config.environmentId}/checkouts/${availability.checkoutId}/transactions`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        memo: {
          purpose: input.purpose,
          userId: input.userId
        }
      })
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        status: "flow_scaffold_ready",
        checkoutId: availability.checkoutId,
        transactionId: null,
        nextAction: "use_direct_testnet_deposit",
        reason: "Dynamic Flow is unavailable for this environment. Use direct testnet deposit.",
        providerDetail: `Dynamic Flow checkout API returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`
      };
    }

    const raw = (await response.json()) as unknown;
    const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const transaction = record.transaction && typeof record.transaction === "object" ? (record.transaction as Record<string, unknown>) : {};
    const transactionId = record.transactionId ?? record.id ?? transaction.id;
    const sessionToken = typeof record.sessionToken === "string" ? record.sessionToken : undefined;
    const sessionExpiresAt = typeof record.sessionExpiresAt === "string" ? record.sessionExpiresAt : undefined;
    if (transactionId) {
      return {
        status: "flow_transaction_created",
        checkoutId: availability.checkoutId,
        transactionId: String(transactionId),
        sessionToken,
        sessionExpiresAt,
        nextAction: "start_dynamic_flow_checkout_in_client",
        raw
      };
    }
  } catch (error) {
    return {
      status: "flow_scaffold_ready",
      checkoutId: availability.checkoutId,
      transactionId: null,
      nextAction: "use_direct_testnet_deposit",
      reason: "Dynamic Flow is unavailable for this environment. Use direct testnet deposit.",
      providerDetail: error instanceof Error ? error.message : String(error)
    };
  }

  return {
    status: "flow_scaffold_ready",
    checkoutId: availability.checkoutId,
    transactionId: null,
    nextAction: "use_direct_testnet_deposit",
    reason: "Dynamic Flow is unavailable for this environment. Use direct testnet deposit.",
    providerDetail: "Dynamic Flow checkout response did not include a transaction id."
  };
}
