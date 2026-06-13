import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics, keccak256, toHex, type Log, type TransactionReceipt } from "viem";
import { decodeVaultFundingLog, selectVerifiedVaultDeposit, preoFundingVaultEvents } from "../lib/evm-funding";
import type { SettlementConfig } from "../lib/settlement";

const config: SettlementConfig = {
  chainId: 84532,
  tokenAddress: "0x0000000000000000000000000000000000002000",
  vaultAddress: "0x0000000000000000000000000000000000001000",
  demoMode: true
};

function depositLog(userHash = keccak256(toHex("preo-user"))): Log {
  const amount = 25_000_000n;
  const externalRef = keccak256(toHex("ref"));
  const topics = encodeEventTopics({
    abi: preoFundingVaultEvents,
    eventName: "PreoDepositReceived",
    args: {
      preoUserIdHash: userHash,
      sender: "0x0000000000000000000000000000000000003000",
      token: config.tokenAddress
    }
  });

  return {
    address: config.vaultAddress,
    topics,
    data: encodeAbiParameters(
      [
        { name: "amount", type: "uint256" },
        { name: "externalRef", type: "bytes32" }
      ],
      [amount, externalRef]
    ),
    blockHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    blockNumber: 1n,
    transactionHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
    transactionIndex: 0,
    logIndex: 4,
    removed: false
  } as Log;
}

describe("EVM funding verifier helpers", () => {
  it("decodes Preo funding vault deposit logs", () => {
    const decoded = decodeVaultFundingLog(depositLog(), config);

    expect(decoded?.eventName).toBe("PreoDepositReceived");
    expect(decoded?.amount).toBe("25");
    expect(decoded?.logIndex).toBe(4);
    expect(decoded?.tokenAddress).toBe(config.tokenAddress);
  });

  it("selects only logs for the expected Preo user hash", () => {
    const expectedUserHash = keccak256(toHex("preo-user"));
    const receipt = {
      logs: [depositLog(keccak256(toHex("other-user"))), depositLog(expectedUserHash)]
    } as TransactionReceipt;

    expect(selectVerifiedVaultDeposit(receipt, config, expectedUserHash)?.preoUserIdHash).toBe(expectedUserHash);
    expect(selectVerifiedVaultDeposit(receipt, config, expectedUserHash, 3)).toBeNull();
  });
});
