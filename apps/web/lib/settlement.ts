import { getAddress, isAddress, keccak256, toHex, type Hex } from "viem";

export type SettlementConfig = {
  chainId: number;
  rpcUrl?: string;
  tokenAddress: `0x${string}`;
  vaultAddress: `0x${string}`;
  demoMode: boolean;
};

const DEMO_TOKEN_ADDRESS = "0x0000000000000000000000000000000000002000";
const DEMO_VAULT_ADDRESS = "0x0000000000000000000000000000000000001000";

function envAddress(value: string | undefined, fallback: string): `0x${string}` {
  const candidate = value || fallback;
  if (!isAddress(candidate)) {
    throw new Error(`Invalid settlement address: ${candidate}`);
  }
  return getAddress(candidate) as `0x${string}`;
}

export function getSettlementConfig(env: NodeJS.ProcessEnv = process.env): SettlementConfig {
  const demoMode = env.DEMO_MODE === "true";
  const chainId = env.SETTLEMENT_CHAIN_ID ? Number(env.SETTLEMENT_CHAIN_ID) : 84532;
  const tokenAddress = envAddress(env.TESTNET_USDC_ADDRESS, demoMode ? DEMO_TOKEN_ADDRESS : "");
  const vaultAddress = envAddress(env.PREO_FUNDING_VAULT_ADDRESS, demoMode ? DEMO_VAULT_ADDRESS : "");
  return {
    chainId,
    rpcUrl: env.SETTLEMENT_RPC_URL,
    tokenAddress,
    vaultAddress,
    demoMode
  };
}

export function preoUserIdHash(preoUserId: string): Hex {
  return keccak256(toHex(preoUserId));
}

export function externalRefHash(ref: string): Hex {
  return keccak256(toHex(ref));
}
