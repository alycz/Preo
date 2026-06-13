import fs from "node:fs";
import path from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import { createAgentWalletFromEnv } from "@preo/dynamic-integration";

const env = process.env;

async function main() {
  if (!env.DYNAMIC_AGENT_PRIVATE_KEY) {
    console.log("DYNAMIC_AGENT_PRIVATE_KEY is not set. Add a burner key to verify the fallback wallet path.");
    console.log("For true Dynamic server-wallet mode, create/import a server wallet in Dynamic and set:");
    console.log("DYNAMIC_AGENT_WALLET_METADATA_JSON, DYNAMIC_AGENT_KEY_SHARES_JSON, DYNAMIC_AGENT_WALLET_PASSWORD, DYNAMIC_ENVIRONMENT_ID.");
    return;
  }

  const account = privateKeyToAccount(env.DYNAMIC_AGENT_PRIVATE_KEY as `0x${string}`);
  console.log(`Burner fallback address: ${account.address}`);

  if (!env.DYNAMIC_ENVIRONMENT_ID) {
    console.log("DYNAMIC_ENVIRONMENT_ID is not set, so automated Dynamic import is skipped.");
    console.log("Set DYNAMIC_AGENT_PRIVATE_KEY as the fallback path or import this key in Dynamic manually.");
    return;
  }

  try {
    const wallet = createAgentWalletFromEnv({
      ...env,
      DEMO_MODE: "false",
      DYNAMIC_AGENT_WALLET_ADDRESS: account.address
    });
    const address = await wallet.getAddress();
    const signature = await wallet.signMessage("Preo Dynamic wallet preparation");
    const localPath = path.join(process.cwd(), ".dynamic-agent-wallet.local.json");
    fs.writeFileSync(
      localPath,
      `${JSON.stringify(
        {
          address,
          mode: env.DYNAMIC_AGENT_WALLET_METADATA_JSON ? "dynamic-metadata" : "private-key",
          signaturePreview: signature.slice(0, 32),
          createdAt: new Date().toISOString()
        },
        null,
        2
      )}\n`
    );
    console.log(`Wallet signing verified. Wrote non-secret local summary to ${localPath}.`);
  } catch (error) {
    console.log("Dynamic SDK import/signing could not be fully automated in this environment.");
    console.log(error instanceof Error ? error.message : String(error));
    console.log("Manual fallback: keep DYNAMIC_AGENT_PRIVATE_KEY for judging, or import the burner key in Dynamic and paste metadata/key shares into env.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
