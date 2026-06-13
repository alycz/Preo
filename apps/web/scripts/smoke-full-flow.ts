import { execSync } from "node:child_process";
import { POST as bootstrap } from "../app/api/me/bootstrap/route";
import { POST as createPolicy } from "../app/api/policy/route";
import { POST as sendPayroll } from "../app/api/demo/employer/send-payroll/route";
import { POST as runAllocation } from "../app/api/allocation/run/route";
import { GET as listApprovals } from "../app/api/approvals/route";
import { POST as approveAction } from "../app/api/approvals/[id]/approve/route";
import { POST as executeAction } from "../app/api/agent/execute-approved-action/route";
import { GET as userView } from "../app/api/views/user/route";
import { GET as employerView } from "../app/api/views/employer/route";
import { GET as recipientView } from "../app/api/views/recipient/route";
import { GET as operatorView } from "../app/api/views/operator/route";
import { GET as otherUserView } from "../app/api/views/other-user/route";

process.env.DEMO_MODE = "true";
process.env.DATABASE_URL ??= "file:./dev.db";

execSync("pnpm --filter @preo/web exec prisma db push", { stdio: "inherit" });

async function post(route: (request: Request, context?: never) => Promise<Response>, path: string, body: unknown) {
  const response = await route(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }) as never
  );
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`${path} failed: ${JSON.stringify(json)}`);
  }
  return json as Record<string, unknown>;
}

async function get(route: (request: Request) => Promise<Response>, path: string) {
  const response = await route(new Request(`http://localhost${path}`));
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`${path} failed: ${JSON.stringify(json)}`);
  }
  return json as Record<string, unknown>;
}

function visible(view: Record<string, unknown>, template: string) {
  const contracts = view.visibleContracts as Record<string, unknown[]> | undefined;
  return contracts?.[template] ?? [];
}

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const dynamicUserId = `smoke-user-${Date.now()}`;
const boot = await post(bootstrap as never, "/api/me/bootstrap", { dynamicUserId, email: "smoke@preo.test" });
const cantonPartyId = String(boot.cantonPartyId);

const policy = await post(createPolicy as never, "/api/policy", {
  dynamicUserId,
  policyName: "Smoke payroll policy",
  categories: [
    {
      categoryId: "rent",
      label: "Rent",
      percentageBps: 3500,
      categoryType: "ExternalPayment",
      recipientParty: "preo-demo-recipient",
      requiresApproval: false
    },
    {
      categoryId: "emergency",
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
  ],
  approvalRules: []
});

const payroll = await post(sendPayroll as never, "/api/demo/employer/send-payroll", {
  dynamicUserId,
  amount: "2500.00",
  asset: "USDC"
});

const allocation = await post(runAllocation as never, "/api/allocation/run", {
  dynamicUserId,
  payrollCreditContractId: payroll.cantonCreditContractId,
  policyContractId: policy.policyContractId
});
assert(Array.isArray(allocation.balances) && allocation.balances.length === 4, "allocation should create four balances");
assert(Array.isArray(allocation.pendingActions) && allocation.pendingActions.length === 1, "allocation should create one pending approval");

const approvals = await get(listApprovals, `/api/approvals?dynamicUserId=${dynamicUserId}`);
const pending = (approvals.approvals as Array<{ contractId: string; payload: { status: string; actionId: string; amount: string; actionType: string } }>).find(
  (approval) => approval.payload.status === "Pending"
);
assert(pending, "pending approval not found");
const pendingApproval = pending as { contractId: string; payload: { status: string; actionId: string; amount: string; actionType: string } };

const approvedResponse = await approveAction(
  new Request(`http://localhost/api/approvals/${pendingApproval.contractId}/approve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dynamicUserId })
  }),
  { params: Promise.resolve({ id: pendingApproval.contractId }) }
);
const approved = await approvedResponse.json();
if (!approvedResponse.ok) {
  throw new Error(`approve failed: ${JSON.stringify(approved)}`);
}
const approvedContract = approved.approval as { contractId: string; payload: { actionId: string; amount: string; actionType: string } };

await post(executeAction as never, "/api/agent/execute-approved-action", {
  dynamicUserId,
  pendingActionContractId: approvedContract.contractId,
  actionId: approvedContract.payload.actionId,
  cantonPartyId,
  amount: approvedContract.payload.amount,
  asset: "USDC",
  pendingActionStatus: "Approved",
  actionType: approvedContract.payload.actionType,
  runId: approvedContract.payload.actionId.split(":")[0]
});

const [user, employer, recipient, operator, other] = await Promise.all([
  get(userView, `/api/views/user?dynamicUserId=${dynamicUserId}`),
  get(employerView, `/api/views/employer?dynamicUserId=${dynamicUserId}`),
  get(recipientView, `/api/views/recipient?dynamicUserId=${dynamicUserId}`),
  get(operatorView, `/api/views/operator?dynamicUserId=${dynamicUserId}`),
  get(otherUserView, `/api/views/other-user?dynamicUserId=${dynamicUserId}`)
]);

assert(visible(user, "Preo.Policy:PayrollPolicy").length === 1, "user should see policy");
assert(visible(user, "Preo.Allocation:CategoryBalance").length === 4, "user should see balances");
assert(visible(employer, "Preo.Payroll:EmployerPayrollNotice").length === 1, "employer should see notice");
assert(visible(employer, "Preo.Policy:PayrollPolicy").length === 0, "employer must not see policy");
assert(visible(recipient, "Preo.Payment:PaymentReceipt").length === 1, "recipient should see only their receipt");
assert(visible(operator, "Preo.Audit:OperatorAuditEvent").length >= 1, "operator should see audit metadata");
assert(visible(other, "Preo.Policy:PayrollPolicy").length === 0, "other user must not see policy");
assert(visible(other, "Preo.Allocation:CategoryBalance").length === 0, "other user must not see balances");

console.log(
  JSON.stringify(
    {
      dynamicUserId,
      cantonPartyId,
      policyContractId: policy.policyContractId,
      payrollCreditContractId: payroll.cantonCreditContractId,
      allocationRunContractId: allocation.allocationRunContractId,
      approvedActionContractId: approvedContract.contractId,
      checks: "passed"
    },
    null,
    2
  )
);
