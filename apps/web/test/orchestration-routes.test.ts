import { execSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

process.env.DEMO_MODE = "true";
process.env.DATABASE_URL ??= "file:./dev.db";

type RoutePost = (request: Request, context?: never) => Promise<Response>;
type RouteGet = (request: Request) => Promise<Response>;

async function post(route: RoutePost, path: string, body: unknown, context?: never) {
  const response = await route(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }),
    context
  );
  return {
    status: response.status,
    json: (await response.json()) as Record<string, unknown>
  };
}

async function get(route: RouteGet, path: string) {
  const response = await route(new Request(`http://localhost${path}`));
  return {
    status: response.status,
    json: (await response.json()) as Record<string, unknown>
  };
}

function visible(view: Record<string, unknown>, template: string) {
  return ((view.visibleContracts as Record<string, unknown[]> | undefined)?.[template] ?? []) as unknown[];
}

describe("backend orchestration routes", () => {
  beforeAll(() => {
    execSync("pnpm --filter @preo/web exec prisma db push", { stdio: "pipe" });
  });

  it("returns typed validation errors for invalid policies", async () => {
    const [{ POST: bootstrap }, { POST }] = await Promise.all([import("../app/api/me/bootstrap/route"), import("../app/api/policy/route")]);
    const dynamicUserId = `invalid-policy-${Date.now()}`;
    await post(bootstrap as RoutePost, "/api/me/bootstrap", { dynamicUserId });
    const response = await post(POST as RoutePost, "/api/policy", {
      dynamicUserId,
      policyName: "Bad policy",
      categories: [
        {
          categoryId: "external",
          label: "External",
          percentageBps: 9000,
          categoryType: "ExternalPayment",
          requiresApproval: false
        }
      ],
      approvalRules: []
    });

    expect(response.status).toBe(422);
    expect(response.json.code).toBe("POLICY_PERCENTAGE_SUM_INVALID");
  });

  it("runs the demo payroll flow and enforces party visibility", async () => {
    const [{ POST: bootstrap }, { POST: createPolicy }, { POST: sendPayroll }, { POST: runAllocation }, approvalsRoute, approveRoute, executeRoute, userRoute, employerRoute, recipientRoute, operatorRoute, otherRoute] =
      await Promise.all([
        import("../app/api/me/bootstrap/route"),
        import("../app/api/policy/route"),
        import("../app/api/demo/employer/send-payroll/route"),
        import("../app/api/allocation/run/route"),
        import("../app/api/approvals/route"),
        import("../app/api/approvals/[id]/approve/route"),
        import("../app/api/agent/execute-approved-action/route"),
        import("../app/api/views/user/route"),
        import("../app/api/views/employer/route"),
        import("../app/api/views/recipient/route"),
        import("../app/api/views/operator/route"),
        import("../app/api/views/other-user/route")
      ]);

    const dynamicUserId = `route-user-${Date.now()}`;
    const boot = await post(bootstrap as RoutePost, "/api/me/bootstrap", { dynamicUserId });
    expect(boot.status).toBe(200);

    const policy = await post(createPolicy as RoutePost, "/api/policy", {
      dynamicUserId,
      policyName: "Route policy",
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
          categoryId: "reserve",
          label: "Reserve",
          percentageBps: 3500,
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
        }
      ],
      approvalRules: []
    });
    expect(policy.status).toBe(200);

    const payroll = await post(sendPayroll as RoutePost, "/api/demo/employer/send-payroll", { dynamicUserId, amount: "1000.00" });
    expect(payroll.status).toBe(200);

    const allocation = await post(runAllocation as RoutePost, "/api/allocation/run", {
      dynamicUserId,
      payrollCreditContractId: payroll.json.cantonCreditContractId,
      policyContractId: policy.json.policyContractId
    });
    expect(allocation.status).toBe(200);
    expect(allocation.json.pendingActions).toHaveLength(1);

    const approvals = await get(approvalsRoute.GET as RouteGet, `/api/approvals?dynamicUserId=${dynamicUserId}`);
    const pending = (approvals.json.approvals as Array<{ contractId: string; payload: { status: string; actionId: string; amount: string; actionType: string } }>).find(
      (approval) => approval.payload.status === "Pending"
    );
    expect(pending).toBeTruthy();

    const approved = await approveRoute.POST(
      new Request(`http://localhost/api/approvals/${pending!.contractId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dynamicUserId })
      }),
      { params: Promise.resolve({ id: pending!.contractId }) }
    );
    const approvedJson = (await approved.json()) as { approval: { contractId: string; payload: { actionId: string; amount: string; actionType: string } } };
    expect(approved.status).toBe(200);

    const executed = await post(executeRoute.POST as RoutePost, "/api/agent/execute-approved-action", {
      dynamicUserId,
      pendingActionContractId: approvedJson.approval.contractId,
      actionId: approvedJson.approval.payload.actionId,
      cantonPartyId: boot.json.cantonPartyId,
      amount: approvedJson.approval.payload.amount,
      asset: "USDC",
      pendingActionStatus: "Approved",
      actionType: approvedJson.approval.payload.actionType,
      runId: approvedJson.approval.payload.actionId.split(":")[0]
    });
    expect(executed.status).toBe(200);

    const [user, employer, recipient, operator, other] = await Promise.all([
      get(userRoute.GET as RouteGet, `/api/views/user?dynamicUserId=${dynamicUserId}`),
      get(employerRoute.GET as RouteGet, `/api/views/employer?dynamicUserId=${dynamicUserId}`),
      get(recipientRoute.GET as RouteGet, `/api/views/recipient?dynamicUserId=${dynamicUserId}`),
      get(operatorRoute.GET as RouteGet, `/api/views/operator?dynamicUserId=${dynamicUserId}`),
      get(otherRoute.GET as RouteGet, `/api/views/other-user?dynamicUserId=${dynamicUserId}`)
    ]);

    expect(visible(user.json, "Preo.Policy:PayrollPolicy")).toHaveLength(1);
    expect(visible(user.json, "Preo.Allocation:CategoryBalance")).toHaveLength(1);
    expect(visible(employer.json, "Preo.Payroll:EmployerPayrollNotice")).toHaveLength(1);
    expect(visible(employer.json, "Preo.Policy:PayrollPolicy")).toHaveLength(0);
    expect(visible(recipient.json, "Preo.Payment:PaymentReceipt")).toHaveLength(1);
    expect(visible(operator.json, "Preo.Audit:OperatorAuditEvent").length).toBeGreaterThanOrEqual(1);
    expect(visible(other.json, "Preo.Policy:PayrollPolicy")).toHaveLength(0);
    expect(visible(other.json, "Preo.Allocation:CategoryBalance")).toHaveLength(0);
  });

  it("runs the full guided demo flow", async () => {
    const [{ POST: fullFlow }, userRoute, employerRoute, recipientRoute, operatorRoute, otherRoute] = await Promise.all([
      import("../app/api/demo/full-flow/route"),
      import("../app/api/views/user/route"),
      import("../app/api/views/employer/route"),
      import("../app/api/views/recipient/route"),
      import("../app/api/views/operator/route"),
      import("../app/api/views/other-user/route")
    ]);

    const dynamicUserId = `full-flow-user-${Date.now()}`;
    const response = await post(fullFlow as RoutePost, "/api/demo/full-flow", { dynamicUserId, amount: "1500.00" });

    expect(response.status).toBe(200);
    expect(response.json.policyContractId).toBeTruthy();
    expect(response.json.cantonCreditContractId).toBeTruthy();
    expect(response.json.approvedActionContractId).toBeTruthy();
    expect(response.json.executedAction).toMatchObject({ status: "simulated" });

    const [user, employer, recipient, operator, other] = await Promise.all([
      get(userRoute.GET as RouteGet, `/api/views/user?dynamicUserId=${dynamicUserId}`),
      get(employerRoute.GET as RouteGet, `/api/views/employer?dynamicUserId=${dynamicUserId}`),
      get(recipientRoute.GET as RouteGet, `/api/views/recipient?dynamicUserId=${dynamicUserId}`),
      get(operatorRoute.GET as RouteGet, `/api/views/operator?dynamicUserId=${dynamicUserId}`),
      get(otherRoute.GET as RouteGet, `/api/views/other-user?dynamicUserId=${dynamicUserId}`)
    ]);

    expect(visible(user.json, "Preo.Policy:PayrollPolicy")).toHaveLength(1);
    expect(visible(user.json, "Preo.Portfolio:PortfolioAllocation")).toHaveLength(1);
    expect(visible(employer.json, "Preo.Payroll:EmployerPayrollNotice").length).toBeGreaterThanOrEqual(1);
    expect(visible(recipient.json, "Preo.Payment:PaymentReceipt").length).toBeGreaterThanOrEqual(1);
    expect(visible(operator.json, "Preo.Audit:OperatorAuditEvent").length).toBeGreaterThanOrEqual(1);
    expect(visible(other.json, "Preo.Policy:PayrollPolicy")).toHaveLength(0);
  });
});
