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
  | { available: false; reason: "missing_checkout_id" | "missing_auth_token" | "missing_environment_id" };

export type DynamicFlowCheckoutResult =
  | {
      status: "flow_transaction_created";
      checkoutId: string;
      transactionId: string;
      nextAction: "start_dynamic_flow_checkout_in_client";
      raw?: unknown;
    }
  | {
      status: "flow_scaffold_ready";
      checkoutId: string;
      transactionId: null;
      nextAction: "add Dynamic Flow checkout credentials or use direct testnet deposit";
      reason: string;
    };

export function getFlowAvailability(config: DynamicFlowConfig): FlowAvailability {
  if (!config.environmentId) {
    return { available: false, reason: "missing_environment_id" };
  }
  if (!config.authToken) {
    return { available: false, reason: "missing_auth_token" };
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

  // Dynamic Flow checkouts are created server-to-server over REST — there is no
  // npm package to import. Call the checkout transactions endpoint directly and
  // fall back to a direct deposit if the API is unreachable or misconfigured.
  const baseUrl = (config.apiBaseUrl ?? DEFAULT_DYNAMIC_API_BASE).replace(/\/+$/, "");
  const url = `${baseUrl}/environments/${config.environmentId}/checkouts/${availability.checkoutId}/transactions`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.authToken}`
      },
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        purpose: input.purpose,
        userId: input.userId
      })
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Dynamic Flow checkout API returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }

    const raw = (await response.json()) as unknown;
    const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const transaction = record.transaction && typeof record.transaction === "object" ? (record.transaction as Record<string, unknown>) : {};
    const transactionId = record.transactionId ?? record.id ?? transaction.id;
    if (transactionId) {
      return {
        status: "flow_transaction_created",
        checkoutId: availability.checkoutId,
        transactionId: String(transactionId),
        nextAction: "start_dynamic_flow_checkout_in_client",
        raw
      };
    }
  } catch (error) {
    return {
      status: "flow_scaffold_ready",
      checkoutId: availability.checkoutId,
      transactionId: null,
      nextAction: "add Dynamic Flow checkout credentials or use direct testnet deposit",
      reason: error instanceof Error ? error.message : String(error)
    };
  }

  return {
    status: "flow_scaffold_ready",
    checkoutId: availability.checkoutId,
    transactionId: null,
    nextAction: "add Dynamic Flow checkout credentials or use direct testnet deposit",
    reason: "Dynamic Flow checkout response did not include a transaction id."
  };
}
