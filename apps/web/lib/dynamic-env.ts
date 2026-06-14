const placeholderDynamicEnvironmentIds = new Set(["test", "placeholder", "your_environment_id", "your-dynamic-environment-id"]);

export type ClientWalletMode = "mock" | "live" | "none";

export const MOCK_DYNAMIC_IDENTITY = {
  dynamicUserId: "demo-dynamic-user",
  walletAddress: "0x000000000000000000000000000000000000dEaD",
  email: "demo@preo.test"
} as const;

type DynamicEnv = Record<string, string | undefined>;

export function isDemoMode(env: DynamicEnv = process.env) {
  return env.DEMO_MODE === "true";
}

export function getDynamicEnvironmentId(env: DynamicEnv = process.env) {
  const environmentId = env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID?.trim();

  if (!environmentId || placeholderDynamicEnvironmentIds.has(environmentId.toLowerCase()) || environmentId.length < 20) {
    return undefined;
  }

  return environmentId;
}

export function getClientWalletMode(env: DynamicEnv = process.env): ClientWalletMode {
  if (isDemoMode(env)) {
    return "mock";
  }

  return getDynamicEnvironmentId(env) ? "live" : "none";
}

export function getHealthClientWalletMode(env: DynamicEnv = process.env): "mock" | "live" {
  return getClientWalletMode(env) === "mock" ? "mock" : "live";
}

export function isDynamicEnvironmentConfigured(env: DynamicEnv = process.env) {
  return Boolean(getDynamicEnvironmentId(env));
}
