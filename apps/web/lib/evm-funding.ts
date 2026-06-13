import { createPublicClient, decodeEventLog, formatUnits, getAddress, http, parseUnits, type Hex, type Log, type TransactionReceipt } from "viem";
import { createSettlementChain } from "@preo/dynamic-integration";
import type { SettlementConfig } from "./settlement";

export const preoFundingVaultEvents = [
  {
    type: "event",
    name: "PreoDepositReceived",
    inputs: [
      { name: "preoUserIdHash", type: "bytes32", indexed: true },
      { name: "sender", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "externalRef", type: "bytes32", indexed: false }
    ]
  },
  {
    type: "event",
    name: "PayrollDepositRecorded",
    inputs: [
      { name: "preoUserIdHash", type: "bytes32", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "payrollRef", type: "bytes32", indexed: false },
      { name: "recordedBy", type: "address", indexed: true }
    ]
  }
] as const;

export type VerifiedVaultDeposit = {
  eventName: "PreoDepositReceived" | "PayrollDepositRecorded";
  chainId: number;
  txHash: Hex;
  logIndex: number;
  vaultAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  preoUserIdHash: Hex;
  amount: string;
  amountUnits: string;
  externalRef: Hex;
  sender?: `0x${string}`;
  recordedBy?: `0x${string}`;
};

function normalizeLogIndex(log: Pick<Log, "logIndex">) {
  return typeof log.logIndex === "number" ? log.logIndex : Number(log.logIndex);
}

export function decodeVaultFundingLog(log: Log, config: SettlementConfig): VerifiedVaultDeposit | null {
  if (getAddress(log.address) !== config.vaultAddress) {
    return null;
  }

  try {
    const decoded = decodeEventLog({
      abi: preoFundingVaultEvents,
      data: log.data,
      topics: log.topics
    });

    if (decoded.eventName === "PreoDepositReceived") {
      const args = decoded.args;
      const tokenAddress = getAddress(args.token) as `0x${string}`;
      if (tokenAddress !== config.tokenAddress) {
        return null;
      }
      return {
        eventName: decoded.eventName,
        chainId: config.chainId,
        txHash: log.transactionHash!,
        logIndex: normalizeLogIndex(log),
        vaultAddress: config.vaultAddress,
        tokenAddress,
        preoUserIdHash: args.preoUserIdHash,
        amount: formatUnits(args.amount, 6),
        amountUnits: args.amount.toString(),
        externalRef: args.externalRef,
        sender: getAddress(args.sender) as `0x${string}`
      };
    }

    const args = decoded.args;
    const tokenAddress = getAddress(args.token) as `0x${string}`;
    if (tokenAddress !== config.tokenAddress) {
      return null;
    }
    return {
      eventName: decoded.eventName,
      chainId: config.chainId,
      txHash: log.transactionHash!,
      logIndex: normalizeLogIndex(log),
      vaultAddress: config.vaultAddress,
      tokenAddress,
      preoUserIdHash: args.preoUserIdHash,
      amount: formatUnits(args.amount, 6),
      amountUnits: args.amount.toString(),
      externalRef: args.payrollRef,
      recordedBy: getAddress(args.recordedBy) as `0x${string}`
    };
  } catch {
    return null;
  }
}

export function selectVerifiedVaultDeposit(
  receipt: TransactionReceipt,
  config: SettlementConfig,
  expectedUserHash: Hex,
  expectedLogIndex?: number
) {
  for (const log of receipt.logs) {
    if (expectedLogIndex !== undefined && normalizeLogIndex(log) !== expectedLogIndex) {
      continue;
    }
    const decoded = decodeVaultFundingLog(log, config);
    if (decoded && decoded.preoUserIdHash.toLowerCase() === expectedUserHash.toLowerCase()) {
      return decoded;
    }
  }
  return null;
}

export async function getReceiptDeposit(
  txHash: Hex,
  config: SettlementConfig,
  expectedUserHash: Hex,
  expectedLogIndex?: number
) {
  if (!config.rpcUrl) {
    throw new Error("SETTLEMENT_RPC_URL is required to verify live EVM deposits");
  }
  const client = createPublicClient({
    chain: createSettlementChain(config.chainId),
    transport: http(config.rpcUrl)
  });
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  return selectVerifiedVaultDeposit(receipt, config, expectedUserHash, expectedLogIndex);
}

export function makeDemoVerifiedVaultDeposit(input: {
  txHash: Hex;
  config: SettlementConfig;
  expectedUserHash: Hex;
  amount: string;
  sourceRef: Hex;
  logIndex?: number;
}): VerifiedVaultDeposit {
  return {
    eventName: "PreoDepositReceived",
    chainId: input.config.chainId,
    txHash: input.txHash,
    logIndex: input.logIndex ?? 0,
    vaultAddress: input.config.vaultAddress,
    tokenAddress: input.config.tokenAddress,
    preoUserIdHash: input.expectedUserHash,
    amount: input.amount,
    amountUnits: parseUnits(input.amount, 6).toString(),
    externalRef: input.sourceRef,
    sender: "0x000000000000000000000000000000000000dE10"
  };
}
