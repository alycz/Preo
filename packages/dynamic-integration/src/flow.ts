export type DynamicFlowConfig = {
  environmentId?: string;
  checkoutId?: string;
  authToken?: string;
};

export type FlowAvailability =
  | { available: true; checkoutId: string }
  | { available: false; reason: "missing_checkout_id" | "missing_auth_token" | "missing_environment_id" };

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
    authToken: env.DYNAMIC_AUTH_TOKEN
  };
}
