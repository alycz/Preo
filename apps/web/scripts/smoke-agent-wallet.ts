import { createAgentWalletFromEnv } from "@preo/dynamic-integration";

const wallet = createAgentWalletFromEnv();
const address = await wallet.getAddress();
const signature = await wallet.signMessage("Preo smoke test");

console.log(JSON.stringify({ address, signaturePreview: signature.slice(0, 24) }, null, 2));
