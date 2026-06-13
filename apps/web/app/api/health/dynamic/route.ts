import { createAgentWalletFromEnv, createDynamicFlowConfigFromEnv, getFlowAvailability } from "@preo/dynamic-integration";
import { ok } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const env = process.env;
  const warnings: string[] = [];
  const flowAvailability = getFlowAvailability(createDynamicFlowConfigFromEnv(env));
  if (!flowAvailability.available) {
    warnings.push(`Dynamic Flow disabled: ${flowAvailability.reason}`);
  }

  const agentWalletMode = env.DYNAMIC_AGENT_WALLET_METADATA_JSON
    ? "dynamic-metadata"
    : env.DYNAMIC_AGENT_PRIVATE_KEY
      ? "private-key"
      : "demo";

  let agentWalletAddress: string | null = null;
  try {
    agentWalletAddress = await createAgentWalletFromEnv(env).getAddress();
  } catch (error) {
    warnings.push(`Agent wallet failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return ok({
    dynamicPublicEnvPresent: Boolean(env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID),
    dynamicServerEnvPresent: Boolean(env.DYNAMIC_ENVIRONMENT_ID && env.DYNAMIC_AUTH_TOKEN),
    flowCheckoutIdPresent: Boolean(env.DYNAMIC_FLOW_CHECKOUT_ID),
    flowUsable: flowAvailability.available,
    flowAvailability,
    agentWalletMode,
    agentWalletAddress,
    warnings
  });
}
