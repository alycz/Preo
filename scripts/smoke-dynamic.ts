import { createAgentWalletFromEnv, createDynamicFlowConfigFromEnv, getFlowAvailability, parseAssetUnits } from "@preo/dynamic-integration";

const env = process.env;
const flow = getFlowAvailability(createDynamicFlowConfigFromEnv(env));

if (!flow.available) {
  const missingFlowEnv =
    flow.reason === "missing_environment_id"
      ? "DYNAMIC_ENVIRONMENT_ID or NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID"
      : flow.reason === "missing_auth_token"
        ? "DYNAMIC_AUTH_TOKEN"
        : "DYNAMIC_FLOW_CHECKOUT_ID";
  console.log(`LIVE_DISABLED: missing env var ${missingFlowEnv}; demo fallback passed`);
} else {
  console.log(`Dynamic Flow configured with checkout ${flow.checkoutId}`);
}

async function main() {
  const wallet = createAgentWalletFromEnv(env);
  const address = await wallet.getAddress();
  const signature = await wallet.signMessage("Preo Dynamic smoke test");
  const mode = env.DYNAMIC_AGENT_WALLET_METADATA_JSON
    ? "dynamic-metadata"
    : env.DYNAMIC_AGENT_PRIVATE_KEY
      ? "private-key"
      : "demo";

  let tx: unknown = null;
  if (env.LIVE_DYNAMIC_TX === "true") {
    if (!env.SETTLEMENT_RPC_URL) {
      throw new Error("LIVE_DYNAMIC_TX=true requires SETTLEMENT_RPC_URL");
    }
    tx = await wallet.sendNative(address, 0n);
  } else if (mode === "demo") {
    console.log("LIVE_DISABLED: missing env var DYNAMIC_AGENT_PRIVATE_KEY or DYNAMIC_AGENT_WALLET_METADATA_JSON; demo fallback passed");
  } else {
    const units = parseAssetUnits("0.000001", "USDC");
    console.log(`Dynamic wallet signing path ready; set LIVE_DYNAMIC_TX=true to send a live transaction. Smallest USDC smoke amount would be ${units}.`);
  }

  console.log(
    JSON.stringify(
      {
        dynamicPublicEnvPresent: Boolean(env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID),
        dynamicServerEnvPresent: Boolean(env.DYNAMIC_ENVIRONMENT_ID && env.DYNAMIC_AUTH_TOKEN),
        flow,
        agentWalletMode: mode,
        agentWalletAddress: address,
        signaturePreview: signature.slice(0, 32),
        tx
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
