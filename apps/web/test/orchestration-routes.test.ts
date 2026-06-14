import { execSync } from "node:child_process";
import { beforeAll, describe, expect, it, vi } from "vitest";

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

function cantonPartyForDynamicUser(dynamicUserId: string) {
  return `preo-${dynamicUserId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
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

  it("auto-bootstraps a first-time user when starting Flow checkout", async () => {
    const { POST } = await import("../app/api/funding/flow/checkout/route");
    const { prisma } = await import("../lib/prisma");
    const dynamicUserId = `flow-user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const savedEnv = {
      dynamicEnvironmentId: process.env.DYNAMIC_ENVIRONMENT_ID,
      publicDynamicEnvironmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID,
      dynamicAuthToken: process.env.DYNAMIC_AUTH_TOKEN,
      flowCheckoutId: process.env.DYNAMIC_FLOW_CHECKOUT_ID
    };

    delete process.env.DYNAMIC_ENVIRONMENT_ID;
    delete process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID;
    delete process.env.DYNAMIC_AUTH_TOKEN;
    delete process.env.DYNAMIC_FLOW_CHECKOUT_ID;

    try {
      const response = await post(POST as RoutePost, "/api/funding/flow/checkout", {
        dynamicUserId,
        amount: "25.00",
        currency: "USD",
        purpose: "payroll_deposit"
      });

      expect(response.status).toBe(200);
      expect(response.json.status).toBe("flow_unavailable_use_direct_deposit");
      expect(response.json.nextAction).toBe("use_direct_testnet_deposit");
      expect(typeof response.json.fundingIntentId).toBe("string");

      const user = await prisma.user.findUnique({ where: { dynamicUserId } });
      expect(user?.cantonPartyId).toBe(cantonPartyForDynamicUser(dynamicUserId));

      const intent = await prisma.fundingIntent.findUnique({ where: { id: response.json.fundingIntentId as string } });
      expect(intent?.userId).toBe(user?.id);
      expect(intent?.status).toBe("flow_unavailable_use_direct_deposit");
    } finally {
      if (savedEnv.dynamicEnvironmentId === undefined) {
        delete process.env.DYNAMIC_ENVIRONMENT_ID;
      } else {
        process.env.DYNAMIC_ENVIRONMENT_ID = savedEnv.dynamicEnvironmentId;
      }
      if (savedEnv.publicDynamicEnvironmentId === undefined) {
        delete process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID;
      } else {
        process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID = savedEnv.publicDynamicEnvironmentId;
      }
      if (savedEnv.dynamicAuthToken === undefined) {
        delete process.env.DYNAMIC_AUTH_TOKEN;
      } else {
        process.env.DYNAMIC_AUTH_TOKEN = savedEnv.dynamicAuthToken;
      }
      if (savedEnv.flowCheckoutId === undefined) {
        delete process.env.DYNAMIC_FLOW_CHECKOUT_ID;
      } else {
        process.env.DYNAMIC_FLOW_CHECKOUT_ID = savedEnv.flowCheckoutId;
      }
    }
  });

  it("creates a Dynamic Flow transaction when checkout env is configured", async () => {
    const { POST } = await import("../app/api/funding/flow/checkout/route");
    const { prisma } = await import("../lib/prisma");
    const dynamicUserId = `flow-success-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const savedEnv = {
      dynamicEnvironmentId: process.env.DYNAMIC_ENVIRONMENT_ID,
      publicDynamicEnvironmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID,
      dynamicAuthToken: process.env.DYNAMIC_AUTH_TOKEN,
      flowCheckoutId: process.env.DYNAMIC_FLOW_CHECKOUT_ID,
      dynamicApiBaseUrl: process.env.DYNAMIC_API_BASE_URL
    };
    const transactionId = `flow_tx_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          sessionToken: "dct_test_session",
          sessionExpiresAt: "2026-06-14T10:00:00Z",
          transaction: {
            id: transactionId
          }
        }),
        { status: 201, headers: { "content-type": "application/json" } }
      );
    });

    process.env.DYNAMIC_ENVIRONMENT_ID = "env_123";
    delete process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID;
    delete process.env.DYNAMIC_AUTH_TOKEN;
    process.env.DYNAMIC_FLOW_CHECKOUT_ID = "checkout_123";
    process.env.DYNAMIC_API_BASE_URL = "https://dynamic.example/api/v0";
    vi.stubGlobal("fetch", fetchMock);

    try {
      const response = await post(POST as RoutePost, "/api/funding/flow/checkout", {
        dynamicUserId,
        amount: "25.00",
        currency: "USD",
        purpose: "payroll_deposit"
      });

      expect(response.status).toBe(200);
      expect(response.json.status).toBe("awaiting_user_action");
      expect(response.json.nextAction).toBe("start_dynamic_flow_checkout_in_client");
      expect(response.json.transactionId).toBe(transactionId);
      expect(response.json.sessionToken).toBe("dct_test_session");
      expect(response.json.sessionExpiresAt).toBe("2026-06-14T10:00:00Z");
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const intent = await prisma.fundingIntent.findUnique({ where: { id: response.json.fundingIntentId as string } });
      expect(intent?.status).toBe("awaiting_user_action");
      expect(intent?.transactionId).toBe(transactionId);
    } finally {
      vi.unstubAllGlobals();
      if (savedEnv.dynamicEnvironmentId === undefined) {
        delete process.env.DYNAMIC_ENVIRONMENT_ID;
      } else {
        process.env.DYNAMIC_ENVIRONMENT_ID = savedEnv.dynamicEnvironmentId;
      }
      if (savedEnv.publicDynamicEnvironmentId === undefined) {
        delete process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID;
      } else {
        process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID = savedEnv.publicDynamicEnvironmentId;
      }
      if (savedEnv.dynamicAuthToken === undefined) {
        delete process.env.DYNAMIC_AUTH_TOKEN;
      } else {
        process.env.DYNAMIC_AUTH_TOKEN = savedEnv.dynamicAuthToken;
      }
      if (savedEnv.flowCheckoutId === undefined) {
        delete process.env.DYNAMIC_FLOW_CHECKOUT_ID;
      } else {
        process.env.DYNAMIC_FLOW_CHECKOUT_ID = savedEnv.flowCheckoutId;
      }
      if (savedEnv.dynamicApiBaseUrl === undefined) {
        delete process.env.DYNAMIC_API_BASE_URL;
      } else {
        process.env.DYNAMIC_API_BASE_URL = savedEnv.dynamicApiBaseUrl;
      }
    }
  });

  it("falls back to direct deposit when Dynamic Flow transaction creation returns 404", async () => {
    const { POST } = await import("../app/api/funding/flow/checkout/route");
    const { prisma } = await import("../lib/prisma");
    const dynamicUserId = `flow-404-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const savedEnv = {
      dynamicEnvironmentId: process.env.DYNAMIC_ENVIRONMENT_ID,
      publicDynamicEnvironmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID,
      dynamicAuthToken: process.env.DYNAMIC_AUTH_TOKEN,
      flowCheckoutId: process.env.DYNAMIC_FLOW_CHECKOUT_ID,
      dynamicApiBaseUrl: process.env.DYNAMIC_API_BASE_URL
    };

    process.env.DYNAMIC_ENVIRONMENT_ID = "env_123";
    delete process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID;
    delete process.env.DYNAMIC_AUTH_TOKEN;
    process.env.DYNAMIC_FLOW_CHECKOUT_ID = "checkout_123";
    process.env.DYNAMIC_API_BASE_URL = "https://dynamic.example/api/v0";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "not found", status: 404 }), { status: 404 })));

    try {
      const response = await post(POST as RoutePost, "/api/funding/flow/checkout", {
        dynamicUserId,
        amount: "25.00",
        currency: "USD",
        purpose: "payroll_deposit"
      });

      expect(response.status).toBe(200);
      expect(response.json.status).toBe("flow_unavailable_use_direct_deposit");
      expect(response.json.nextAction).toBe("use_direct_testnet_deposit");
      expect(response.json.transactionId).toBeNull();
      expect(response.json.reason).toBe("Dynamic Flow is unavailable for this environment. Use direct testnet deposit.");

      const intent = await prisma.fundingIntent.findUnique({ where: { id: response.json.fundingIntentId as string } });
      expect(intent?.status).toBe("flow_unavailable_use_direct_deposit");
      expect(intent?.transactionId).toBeNull();
      expect(intent?.metadata).toMatchObject({
        flowStatus: "flow_scaffold_ready",
        providerDetail: expect.stringContaining("Dynamic Flow checkout API returned 404")
      });
    } finally {
      vi.unstubAllGlobals();
      if (savedEnv.dynamicEnvironmentId === undefined) {
        delete process.env.DYNAMIC_ENVIRONMENT_ID;
      } else {
        process.env.DYNAMIC_ENVIRONMENT_ID = savedEnv.dynamicEnvironmentId;
      }
      if (savedEnv.publicDynamicEnvironmentId === undefined) {
        delete process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID;
      } else {
        process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID = savedEnv.publicDynamicEnvironmentId;
      }
      if (savedEnv.dynamicAuthToken === undefined) {
        delete process.env.DYNAMIC_AUTH_TOKEN;
      } else {
        process.env.DYNAMIC_AUTH_TOKEN = savedEnv.dynamicAuthToken;
      }
      if (savedEnv.flowCheckoutId === undefined) {
        delete process.env.DYNAMIC_FLOW_CHECKOUT_ID;
      } else {
        process.env.DYNAMIC_FLOW_CHECKOUT_ID = savedEnv.flowCheckoutId;
      }
      if (savedEnv.dynamicApiBaseUrl === undefined) {
        delete process.env.DYNAMIC_API_BASE_URL;
      } else {
        process.env.DYNAMIC_API_BASE_URL = savedEnv.dynamicApiBaseUrl;
      }
    }
  });

  it("auto-bootstraps a first-time user when preparing a Blink session", async () => {
    const { POST } = await import("../app/api/funding/blink/session/route");
    const { prisma } = await import("../lib/prisma");
    const dynamicUserId = `blink-user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const savedEnv = {
      demoMode: process.env.DEMO_MODE,
      settlementChainId: process.env.SETTLEMENT_CHAIN_ID,
      vaultAddress: process.env.PREO_FUNDING_VAULT_ADDRESS,
      tokenAddress: process.env.TESTNET_USDC_ADDRESS
    };

    process.env.DEMO_MODE = "false";
    delete process.env.SETTLEMENT_CHAIN_ID;
    delete process.env.PREO_FUNDING_VAULT_ADDRESS;
    delete process.env.TESTNET_USDC_ADDRESS;

    try {
      const response = await post(POST as RoutePost, "/api/funding/blink/session", {
        dynamicUserId,
        amount: "25.00"
      });

      expect(response.status).toBe(200);
      expect(response.json.status).toBe("awaiting_user_action");
      expect(response.json.nextAction).toBe("open_blink_deposit_or_use_direct_vault_deposit");
      expect(response.json.destinationAddress).toBe("0x0000000000000000000000000000000000001000");
      expect(response.json.tokenAddress).toBe("0x0000000000000000000000000000000000002000");

      const user = await prisma.user.findUnique({ where: { dynamicUserId } });
      expect(user?.cantonPartyId).toBe(cantonPartyForDynamicUser(dynamicUserId));
    } finally {
      if (savedEnv.demoMode === undefined) {
        delete process.env.DEMO_MODE;
      } else {
        process.env.DEMO_MODE = savedEnv.demoMode;
      }
      if (savedEnv.settlementChainId === undefined) {
        delete process.env.SETTLEMENT_CHAIN_ID;
      } else {
        process.env.SETTLEMENT_CHAIN_ID = savedEnv.settlementChainId;
      }
      if (savedEnv.vaultAddress === undefined) {
        delete process.env.PREO_FUNDING_VAULT_ADDRESS;
      } else {
        process.env.PREO_FUNDING_VAULT_ADDRESS = savedEnv.vaultAddress;
      }
      if (savedEnv.tokenAddress === undefined) {
        delete process.env.TESTNET_USDC_ADDRESS;
      } else {
        process.env.TESTNET_USDC_ADDRESS = savedEnv.tokenAddress;
      }
    }
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
