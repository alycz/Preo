import fs from "node:fs";
import path from "node:path";

const required = ["CANTON_PACKAGE_ID", "CANTON_JSON_API_URL"] as const;
const missing = required.filter((name) => !process.env[name]);

if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  console.error("Set them after uploading daml/.daml/dist/preo-0.0.1.dar to Canton DevNet.");
  process.exit(1);
}

const artifact = {
  network: "canton-devnet",
  packageId: process.env.CANTON_PACKAGE_ID,
  jsonApiUrl: process.env.CANTON_JSON_API_URL,
  dar: ".daml/dist/preo-0.0.1.dar",
  deployedAt: new Date().toISOString(),
  notes: "Updated by scripts/update-canton-deployment.ts after uploading the DAR to Canton DevNet or sponsor-approved test environment."
};

const outputPath = path.join(process.cwd(), "daml", "deployments", "canton-devnet.json");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ wrote: outputPath, artifact }, null, 2));
