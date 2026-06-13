import { createAgentWalletFromEnv, createDynamicFlowConfigFromEnv, getFlowAvailability } from "@preo/dynamic-integration";
import { canton } from "@/lib/canton";
import { ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getSettlementConfig } from "@/lib/settlement";

export const runtime = "nodejs";

async function databaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

async function settlementHealth() {
  try {
    const config = getSettlementConfig();
    return {
      ok: Boolean(config.demoMode || (config.rpcUrl && config.tokenAddress && config.vaultAddress)),
      demoMode: config.demoMode,
      chainId: config.chainId,
      rpcUrlPresent: Boolean(config.rpcUrl),
      tokenAddressPresent: Boolean(config.tokenAddress),
      vaultAddressPresent: Boolean(config.vaultAddress)
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function GET() {
  const env = process.env;
  const [database, cantonHealth, settlement] = await Promise.all([databaseHealth(), canton.health().catch((error) => ({ ok: false, message: error instanceof Error ? error.message : String(error) })), settlementHealth()]);
  const flowAvailability = getFlowAvailability(createDynamicFlowConfigFromEnv(env));
  let agentWalletAddress: string | null = null;
  try {
    agentWalletAddress = await createAgentWalletFromEnv(env).getAddress();
  } catch {
    agentWalletAddress = null;
  }

  const dynamic = {
    ok: Boolean(env.DEMO_MODE === "true" || env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID || env.DYNAMIC_AGENT_PRIVATE_KEY || env.DYNAMIC_AGENT_WALLET_METADATA_JSON),
    publicEnvPresent: Boolean(env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID),
    serverEnvPresent: Boolean(env.DYNAMIC_ENVIRONMENT_ID && env.DYNAMIC_AUTH_TOKEN),
    flowUsable: flowAvailability.available,
    agentWalletMode: env.DYNAMIC_AGENT_WALLET_METADATA_JSON ? "dynamic-metadata" : env.DYNAMIC_AGENT_PRIVATE_KEY ? "private-key" : "demo",
    agentWalletAddress
  };
  const blink = {
    ok: Boolean(env.DEMO_MODE === "true" || (env.BLINK_MERCHANT_ID && env.BLINK_MERCHANT_PRIVATE_KEY)),
    merchantIdPresent: Boolean(env.BLINK_MERCHANT_ID),
    privateKeyPresent: Boolean(env.BLINK_MERCHANT_PRIVATE_KEY)
  };

  return ok({
    app: "ok",
    demoMode: env.DEMO_MODE === "true",
    database,
    canton: cantonHealth,
    dynamic,
    blink,
    settlement
  });
}
