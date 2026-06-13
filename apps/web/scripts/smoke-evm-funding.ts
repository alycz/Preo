import { makeDemoTxHash } from "@preo/shared";
import { makeDemoVerifiedVaultDeposit } from "../lib/evm-funding";
import { externalRefHash, getSettlementConfig, preoUserIdHash } from "../lib/settlement";

const config = getSettlementConfig();
const deposit = makeDemoVerifiedVaultDeposit({
  txHash: makeDemoTxHash("evm"),
  config,
  expectedUserHash: preoUserIdHash("preo-smoke-user"),
  amount: "25.00",
  sourceRef: externalRefHash("smoke-evm-funding")
});

console.log(JSON.stringify(deposit, null, 2));
