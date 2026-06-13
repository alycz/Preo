import fs from "node:fs";
import path from "node:path";
import { createAgentWalletFromEnv } from "@preo/dynamic-integration";

type Row = {
  integration: string;
  status: "ready" | "missing" | "demo";
  detail: string;
};

function missing(names: string[]) {
  return names.filter((name) => !process.env[name]);
}

async function agentWalletDetail() {
  if (process.env.DYNAMIC_AGENT_WALLET_METADATA_JSON) {
    try {
      return `dynamic-metadata ${await createAgentWalletFromEnv(process.env).getAddress()}`;
    } catch (error) {
      return `dynamic-metadata configured but failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  if (process.env.DYNAMIC_AGENT_PRIVATE_KEY) {
    return `private-key ${await createAgentWalletFromEnv(process.env).getAddress()}`;
  }
  return "demo wallet";
}

async function main() {
  const rows: Row[] = [];
  const cantonMissing = missing(["CANTON_JSON_API_URL", "CANTON_PACKAGE_ID"]);
  rows.push({
    integration: "Canton",
    status: cantonMissing.length ? "missing" : "ready",
    detail: cantonMissing.length ? `missing ${cantonMissing.join(", ")}` : "JSON API and package ID present"
  });

const dynamicLoginMissing = missing(["NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID"]);
rows.push({
  integration: "Dynamic login",
  status: dynamicLoginMissing.length ? "missing" : "ready",
  detail: dynamicLoginMissing.length ? `missing ${dynamicLoginMissing.join(", ")}` : "public environment configured"
});

  rows.push({
    integration: "Dynamic agent wallet",
    status: process.env.DYNAMIC_AGENT_WALLET_METADATA_JSON || process.env.DYNAMIC_AGENT_PRIVATE_KEY ? "ready" : "demo",
    detail: await agentWalletDetail()
  });

const flowMissing = missing(["DYNAMIC_ENVIRONMENT_ID", "DYNAMIC_AUTH_TOKEN", "DYNAMIC_FLOW_CHECKOUT_ID"]);
rows.push({
  integration: "Dynamic Flow",
  status: flowMissing.length ? "missing" : "ready",
  detail: flowMissing.length ? `missing ${flowMissing.join(", ")}` : "checkout env present"
});

const blinkMissing = missing(["BLINK_MERCHANT_ID", "BLINK_MERCHANT_PRIVATE_KEY"]);
rows.push({
  integration: "Blink",
  status: blinkMissing.length ? "missing" : "ready",
  detail: blinkMissing.length ? `missing ${blinkMissing.join(", ")}` : "merchant and signer key present"
});

const evmMissing = missing(["SETTLEMENT_RPC_URL", "TESTNET_USDC_ADDRESS", "PREO_FUNDING_VAULT_ADDRESS"]);
rows.push({
  integration: "EVM",
  status: evmMissing.length ? "missing" : "ready",
  detail: evmMissing.length ? `missing ${evmMissing.join(", ")}` : "RPC, token, and vault present"
});

rows.push({
  integration: "DB",
  status: process.env.DATABASE_URL ? "ready" : "missing",
  detail: process.env.DATABASE_URL ? "DATABASE_URL present" : "missing DATABASE_URL"
});

rows.push({
  integration: "Daml DAR",
  status: fs.existsSync(path.join(process.cwd(), "daml", ".daml", "dist", "preo-0.0.1.dar")) ? "ready" : "missing",
  detail: "daml/.daml/dist/preo-0.0.1.dar"
});

rows.push({
  integration: "Contracts artifact",
  status: fs.existsSync(path.join(process.cwd(), "contracts", "deployments", "preo-funding-vault.json")) ? "ready" : "missing",
  detail: "contracts/deployments/preo-funding-vault.json"
});

  console.table(rows);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
