import { afterEach, describe, expect, it, vi } from "vitest";
import { createFlowCheckoutTransaction, getFlowAvailability } from "../src/flow";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Flow availability", () => {
  it("requires Dynamic environment and checkout id", () => {
    expect(getFlowAvailability({}).available).toBe(false);
    expect(getFlowAvailability({ environmentId: "env", checkoutId: "checkout" }).available).toBe(true);
  });
});

describe("createFlowCheckoutTransaction", () => {
  it("creates transactions through the SDK checkout endpoint", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          sessionToken: "dct_session",
          sessionExpiresAt: "2026-06-14T10:00:00Z",
          transaction: {
            id: "tx_123"
          }
        }),
        { status: 201, headers: { "content-type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createFlowCheckoutTransaction(
      {
        environmentId: "env_123",
        checkoutId: "checkout_123",
        authToken: "dyn_secret",
        apiBaseUrl: "https://dynamic.example/api/v0"
      },
      {
        amount: "25.00",
        currency: "USD",
        purpose: "payroll_deposit",
        userId: "user_123"
      }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    if (!firstCall) {
      throw new Error("fetch was not called");
    }
    const [url, init] = firstCall;
    expect(String(url)).toBe("https://dynamic.example/api/v0/sdk/env_123/checkouts/checkout_123/transactions");
    expect(init?.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(String(init?.body))).toEqual({
      amount: "25.00",
      currency: "USD",
      memo: {
        purpose: "payroll_deposit",
        userId: "user_123"
      }
    });
    expect(result).toMatchObject({
      status: "flow_transaction_created",
      checkoutId: "checkout_123",
      transactionId: "tx_123",
      sessionToken: "dct_session",
      sessionExpiresAt: "2026-06-14T10:00:00Z",
      nextAction: "start_dynamic_flow_checkout_in_client"
    });
  });

  it("returns a direct-deposit fallback when Dynamic returns 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "not found", status: 404 }), { status: 404 }))
    );

    const result = await createFlowCheckoutTransaction(
      {
        environmentId: "env_123",
        checkoutId: "checkout_123",
        apiBaseUrl: "https://dynamic.example/api/v0"
      },
      {
        amount: "25.00",
        currency: "USD",
        purpose: "payroll_deposit",
        userId: "user_123"
      }
    );

    expect(result).toMatchObject({
      status: "flow_scaffold_ready",
      checkoutId: "checkout_123",
      transactionId: null,
      nextAction: "use_direct_testnet_deposit",
      reason: "Dynamic Flow is unavailable for this environment. Use direct testnet deposit."
    });
    expect("providerDetail" in result ? result.providerDetail : "").toContain("Dynamic Flow checkout API returned 404");
  });
});
