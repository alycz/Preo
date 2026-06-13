import { createPublicClient, createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createSettlementChain } from "@preo/dynamic-integration";
import { externalRefHash, getSettlementConfig, preoUserIdHash } from "../apps/web/lib/settlement";

const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  }
] as const;

const vaultAbi = [
  {
    type: "function",
    name: "depositFor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "preoUserIdHash", type: "bytes32" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "externalRef", type: "bytes32" }
    ],
    outputs: []
  }
] as const;

const env = process.env;
const privateKey = env.DYNAMIC_AGENT_PRIVATE_KEY ?? env.DEPLOYER_PRIVATE_KEY;
if (!privateKey) {
  throw new Error("DYNAMIC_AGENT_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY is required");
}
if (!env.PREO_USER_ID) {
  throw new Error("PREO_USER_ID is required");
}

const config = getSettlementConfig(env);
if (!config.rpcUrl) {
  throw new Error("SETTLEMENT_RPC_URL is required");
}

async function main() {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const chain = createSettlementChain(config.chainId);
  const publicClient = createPublicClient({ chain, transport: http(config.rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(config.rpcUrl) });
  const amount = parseUnits(env.AMOUNT ?? "25.00", 6);
  const userHash = preoUserIdHash(env.PREO_USER_ID);
  const externalRef = externalRefHash(env.EXTERNAL_REF ?? `preo-demo-direct-${Date.now()}`);

  try {
    const mintHash = await walletClient.writeContract({
      address: config.tokenAddress,
      abi: erc20Abi,
      functionName: "mint",
      args: [account.address, amount]
    });
    await publicClient.waitForTransactionReceipt({ hash: mintHash });
    console.log(`Minted mock USDC: ${mintHash}`);
  } catch (error) {
    console.log(`Skipping mint; token may not be MockUSDC or signer is not owner: ${error instanceof Error ? error.message : String(error)}`);
  }

  const approveHash = await walletClient.writeContract({
    address: config.tokenAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [config.vaultAddress, amount]
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  const depositHash = await walletClient.writeContract({
    address: config.vaultAddress,
    abi: vaultAbi,
    functionName: "depositFor",
    args: [userHash, config.tokenAddress, amount, externalRef]
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: depositHash });

  console.log(
    JSON.stringify(
      {
        sender: account.address,
        approveHash,
        depositHash,
        blockNumber: receipt.blockNumber.toString(),
        preoUserIdHash: userHash,
        externalRef,
        amountUnits: amount.toString()
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
