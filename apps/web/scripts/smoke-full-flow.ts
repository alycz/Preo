import { createCantonClientFromEnv } from "@preo/canton-client";
import { createAgentWalletFromEnv } from "@preo/dynamic-integration";

const canton = createCantonClientFromEnv();
const wallet = createAgentWalletFromEnv();
const agentAddress = await wallet.getAddress();
const credit = await canton.createPayrollCredit({
  user: "preo-smoke-user",
  amount: "2500.00",
  asset: "USDC",
  sourceRef: `smoke-${Date.now()}`,
  evmTxHash: "0x736d6f6b652d66756c6c2d666c6f77000000000000000000000000000000"
});

console.log(JSON.stringify({ agentAddress, payrollCreditContractId: credit.contractId, cantonLive: credit.live }, null, 2));
