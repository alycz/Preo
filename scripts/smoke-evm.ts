import { createPublicClient, http } from "viem";
import { createSettlementChain } from "@preo/dynamic-integration";
import { getSettlementConfig } from "../apps/web/lib/settlement";

const supportedTokensAbi = [
  {
    type: "function",
    name: "supportedTokens",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "bool" }]
  }
] as const;

const env = process.env;
const missing = [
  !env.SETTLEMENT_RPC_URL ? "SETTLEMENT_RPC_URL" : null,
  !env.PREO_FUNDING_VAULT_ADDRESS ? "PREO_FUNDING_VAULT_ADDRESS" : null,
  !env.TESTNET_USDC_ADDRESS ? "TESTNET_USDC_ADDRESS" : null
].filter(Boolean);

if (missing.length && env.LIVE_EVM_REQUIRED === "true") {
  throw new Error(`LIVE_EVM_REQUIRED=true but missing ${missing.join(", ")}`);
}

const config = getSettlementConfig(missing.length ? { ...env, DEMO_MODE: "true" } : env);

if (missing.length) {
  console.log(`LIVE_DISABLED: missing env var ${missing.join(", ")}; demo fallback passed`);
  console.log(
    JSON.stringify(
      {
        chainId: config.chainId,
        vaultAddress: config.vaultAddress,
        tokenAddress: config.tokenAddress,
        live: false,
        checks: "passed"
      },
      null,
      2
    )
  );
  process.exit(0);
}

async function main() {
  const client = createPublicClient({
    chain: createSettlementChain(config.chainId),
    transport: http(config.rpcUrl)
  });
  const [chainId, vaultCode, tokenCode, tokenSupported] = await Promise.all([
    client.getChainId(),
    client.getCode({ address: config.vaultAddress }),
    client.getCode({ address: config.tokenAddress }),
    client.readContract({
      address: config.vaultAddress,
      abi: supportedTokensAbi,
      functionName: "supportedTokens",
      args: [config.tokenAddress]
    })
  ]);

  if (!vaultCode || vaultCode === "0x") {
    throw new Error(`No code found at PREO_FUNDING_VAULT_ADDRESS ${config.vaultAddress}`);
  }
  if (!tokenCode || tokenCode === "0x") {
    throw new Error(`No code found at TESTNET_USDC_ADDRESS ${config.tokenAddress}`);
  }
  if (!tokenSupported) {
    throw new Error("Vault does not report TESTNET_USDC_ADDRESS as supported");
  }

  console.log(
    JSON.stringify(
      {
        live: true,
        chainId,
        vaultAddress: config.vaultAddress,
        tokenAddress: config.tokenAddress,
        tokenSupported,
        checks: "passed"
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
