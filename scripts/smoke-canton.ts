import { createCantonClientFromEnv, resetCantonDemoState } from "@preo/canton-client";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function visible(view: Record<string, unknown>, template: string) {
  const contracts = view[template];
  return Array.isArray(contracts) ? contracts : [];
}

async function main() {
  const env = process.env;
  const canton = createCantonClientFromEnv(env);
  const health = await canton.health();

if (canton.isLive) {
  console.log(JSON.stringify({ health }, null, 2));
  process.exit(health.ok ? 0 : 1);
}

if (env.LIVE_CANTON_REQUIRED === "true") {
  throw new Error("LIVE_CANTON_REQUIRED=true but Canton live env is not configured");
}

if (!env.CANTON_JSON_API_URL || !env.CANTON_PACKAGE_ID) {
  const missing = [
    !env.CANTON_JSON_API_URL ? "CANTON_JSON_API_URL" : null,
    !env.CANTON_PACKAGE_ID ? "CANTON_PACKAGE_ID" : null
  ].filter(Boolean);
  console.log(`LIVE_DISABLED: missing env var ${missing.join(", ")}; demo fallback passed`);
}

resetCantonDemoState();

const user = await canton.allocateParty("preo-smoke-user", "Preo Smoke User");
const employer = await canton.allocateParty(env.CANTON_EMPLOYER_PARTY ?? "preo-smoke-employer", "Preo Smoke Employer");
const recipient = await canton.allocateParty(env.CANTON_RECIPIENT_PARTY ?? "preo-smoke-recipient", "Preo Smoke Recipient");
const operator = await canton.allocateParty(env.CANTON_OPERATOR_PARTY ?? "preo-smoke-operator", "Preo Smoke Operator");
const other = await canton.allocateParty(env.CANTON_OTHER_USER_PARTY ?? "preo-smoke-other", "Preo Smoke Other");

await canton.createUserProfile(user, "Preo Smoke User");
const policy = await canton.createPayrollPolicy(user, {
  policyName: "Smoke payroll policy",
  categories: [
    {
      categoryId: "rent",
      label: "Rent",
      percentageBps: 3500,
      categoryType: "ExternalPayment",
      recipientParty: recipient,
      requiresApproval: false
    },
    {
      categoryId: "reserve",
      label: "Emergency Fund",
      percentageBps: 2000,
      categoryType: "InternalReserve",
      requiresApproval: false
    },
    {
      categoryId: "portfolio",
      label: "Portfolio",
      percentageBps: 3000,
      categoryType: "PortfolioAllocation",
      portfolioTarget: "GlobalEquityBasket",
      requiresApproval: true
    },
    {
      categoryId: "spending",
      label: "Spending",
      percentageBps: 1500,
      categoryType: "ManualHold",
      requiresApproval: false
    }
  ]
});

await canton.createEmployerPayrollNotice({
  employer,
  employee: user,
  grossAmount: "2500.00",
  asset: "USDC",
  payrollRef: "smoke-payroll"
});
const credit = await canton.createPayrollCredit({
  user,
  amount: "2500.00",
  asset: "USDC",
  sourceRef: "smoke-settlement"
});
const allocation = await canton.runAllocation({
  user,
  policyContractId: policy.contractId,
  payrollCreditContractId: credit.contractId,
  runId: "smoke-run"
});
await canton.createOperatorAuditEvent({
  operator,
  userAlias: "smoke-user",
  eventType: "smoke.canton",
  status: "passed",
  referenceHash: "smoke-run"
});

const [userView, employerView, recipientView, operatorView, otherView] = await Promise.all([
  canton.partyView(user),
  canton.partyView(employer),
  canton.partyView(recipient),
  canton.partyView(operator),
  canton.partyView(other)
]);

assert(visible(userView, "Preo.Policy:PayrollPolicy").length === 1, "user should see payroll policy");
assert(visible(userView, "Preo.Allocation:CategoryBalance").length === 2, "user should see private balances");
assert(visible(employerView, "Preo.Payroll:EmployerPayrollNotice").length === 1, "employer should see payroll notice");
assert(visible(employerView, "Preo.Policy:PayrollPolicy").length === 0, "employer must not see policy");
assert(visible(recipientView, "Preo.Payment:PaymentReceipt").length === 1, "recipient should see payment receipt");
assert(visible(operatorView, "Preo.Audit:OperatorAuditEvent").length === 1, "operator should see audit metadata");
assert(visible(otherView, "Preo.Policy:PayrollPolicy").length === 0, "other user must see no private policy");

  console.log(
    JSON.stringify(
      {
        health,
        parties: { user, employer, recipient, operator, other },
        contracts: {
          policy: policy.contractId,
          credit: credit.contractId,
          allocationRun: allocation.run.contractId
        },
        counts: {
          user: Object.fromEntries(Object.entries(userView).map(([template, contracts]) => [template, Array.isArray(contracts) ? contracts.length : 0])),
          employer: Object.fromEntries(Object.entries(employerView).map(([template, contracts]) => [template, Array.isArray(contracts) ? contracts.length : 0])),
          recipient: Object.fromEntries(Object.entries(recipientView).map(([template, contracts]) => [template, Array.isArray(contracts) ? contracts.length : 0])),
          operator: Object.fromEntries(Object.entries(operatorView).map(([template, contracts]) => [template, Array.isArray(contracts) ? contracts.length : 0])),
          other: Object.fromEntries(Object.entries(otherView).map(([template, contracts]) => [template, Array.isArray(contracts) ? contracts.length : 0]))
        },
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
