"use client";

import { DynamicAuthButton } from "./DynamicAuthButton";
import { useEffect, useMemo, useState } from "react";
import type { BootstrapResponse, CategoryType, PortfolioModel } from "@preo/shared";
import { useAppWallet } from "../wallet-context";

type LogEntry = {
  label: string;
  payload: unknown;
};

type Identity = {
  dynamicConfigured: boolean;
  dynamicUserId: string;
  walletAddress: string;
  email?: string;
  signedIn: boolean;
};

type CategoryDraft = {
  categoryId: string;
  label: string;
  percentageBps: number;
  categoryType: CategoryType;
  recipientParty?: string;
  externalAddress?: string;
  portfolioTarget?: PortfolioModel;
  requiresApproval: boolean;
};

const DEFAULT_CATEGORIES: CategoryDraft[] = [
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
];

function getWalletAddress(primaryWallet: unknown): string | undefined {
  if (!primaryWallet || typeof primaryWallet !== "object") {
    return undefined;
  }
  const candidate = primaryWallet as { address?: string };
  return candidate.address;
}

function contractId(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  return (value as { contractId?: string }).contractId;
}

export function Dashboard() {
  const appWallet = useAppWallet();

  if (appWallet.mode === "mock") {
    return (
      <DashboardCore
        identity={{
          dynamicConfigured: false,
          dynamicUserId: appWallet.mockIdentity.dynamicUserId,
          walletAddress: appWallet.mockIdentity.walletAddress,
          email: appWallet.mockIdentity.email,
          signedIn: true
        }}
      />
    );
  }

  if (!appWallet.dynamicConfigured) {
    return (
      <DashboardCore
        identity={{
          dynamicConfigured: false,
          dynamicUserId: "demo-dynamic-user",
          walletAddress: "",
          signedIn: true
        }}
      />
    );
  }

  return <DynamicDashboard />;
}

function DynamicDashboard() {
  const dynamic = { user: undefined, primaryWallet: undefined } as any;
  const identity: Identity = {
    dynamicConfigured: true,
    dynamicUserId: dynamic.user?.userId ?? "demo-dynamic-user",
    walletAddress: getWalletAddress(dynamic.primaryWallet) ?? "",
    email: dynamic.user?.email,
    signedIn: Boolean(dynamic.user)
  };

  return <DashboardCore identity={identity} />;
}

function DashboardCore({ identity }: { identity: Identity }) {
  const [amount, setAmount] = useState("2500.00");
  const [actionAmount, setActionAmount] = useState("750.00");
  const [toAddress, setToAddress] = useState("");
  const [vaultTxHash, setVaultTxHash] = useState("");
  const [lastBlinkRef, setLastBlinkRef] = useState("");
  const [policyName, setPolicyName] = useState("June payroll policy");
  const [categories, setCategories] = useState<CategoryDraft[]>(DEFAULT_CATEGORIES);
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [policyContractId, setPolicyContractId] = useState("");
  const [creditContractId, setCreditContractId] = useState("");
  const [approvedActionId, setApprovedActionId] = useState("");
  const [pendingActions, setPendingActions] = useState<Array<{ contractId: string; payload: Record<string, unknown> }>>([]);
  const [dashboard, setDashboard] = useState<unknown>(null);
  const [viewRole, setViewRole] = useState("user");
  const [partyView, setPartyView] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const { dynamicConfigured, dynamicUserId, walletAddress } = identity;
  const isSignedIn = identity.signedIn || !dynamicConfigured;
  const bpsTotal = categories.reduce((sum, category) => sum + Number(category.percentageBps || 0), 0);

  const statusLabel = useMemo(() => {
    if (!dynamicConfigured) {
      return "Demo auth";
    }
    return identity.signedIn ? "Signed in with Dynamic" : "Dynamic sign-in required";
  }, [identity.signedIn, dynamicConfigured]);

  function append(label: string, payload: unknown) {
    setLogs((current) => [{ label, payload }, ...current].slice(0, 14));
  }

  async function requestJson(path: string, init?: RequestInit) {
    setBusy(true);
    try {
      const response = await fetch(path, init);
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.code ? `${json.code}: ${json.error}` : json.error ?? `Request failed: ${response.status}`);
      }
      append(path, json);
      return json;
    } catch (error) {
      append(`${path} error`, error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function postJson(path: string, payload: unknown) {
    return requestJson(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  async function getJson(path: string) {
    return requestJson(path);
  }

  async function bootstrapUser() {
    const response = await postJson("/api/me/bootstrap", {
      dynamicUserId,
      primaryWalletAddress: walletAddress,
      email: identity.email
    });
    setBootstrap(response);
  }

  async function savePolicy() {
    const response = await postJson("/api/policy", {
      dynamicUserId,
      policyName,
      categories,
      approvalRules: [
        {
          ruleId: "portfolio-approval",
          actionType: "ActionPortfolioAllocation",
          enabled: true,
          appliesToCategoryId: "portfolio",
          description: "User approval required before portfolio allocation"
        }
      ]
    });
    setPolicyContractId(response.policyContractId);
  }

  async function sendDemoPayroll() {
    const response = await postJson("/api/demo/employer/send-payroll", {
      dynamicUserId,
      amount,
      asset: "USDC"
    });
    setCreditContractId(response.cantonCreditContractId);
  }

  async function startFlow() {
    await postJson("/api/funding/flow/checkout", {
      dynamicUserId,
      amount,
      currency: "USD",
      purpose: "payroll_deposit"
    });
  }

  async function directDeposit() {
    const response = await postJson("/api/funding/direct-deposit", {
      dynamicUserId,
      amount,
      asset: "USDC",
      sourceRef: `direct-demo-${Date.now()}`
    });
    setCreditContractId(response.cantonCreditContractId);
  }

  async function prepareBlinkDeposit() {
    const session = (await postJson("/api/funding/blink/session", {
      dynamicUserId,
      amount
    })) as {
      chainId: number;
      tokenAddress: string;
      destinationAddress: string;
      externalRef?: string;
    };
    if (session.externalRef) {
      setLastBlinkRef(session.externalRef);
    }
    await postJson("/api/blink/sign-payment", {
      amount: Number(amount),
      chainId: session.chainId,
      address: session.destinationAddress,
      token: session.tokenAddress,
      callbackScheme: null,
      url: "https://pay-sandbox.blink.cash",
      version: "v1",
      reference: session.externalRef,
      metadata: session.externalRef
        ? {
            externalRef: session.externalRef
          }
        : undefined
    });
  }

  async function verifyVaultDeposit() {
    const response = await postJson("/api/funding/evm/verify-deposit", {
      dynamicUserId,
      txHash: vaultTxHash,
      sourceRef: lastBlinkRef || undefined,
      demoAmount: amount
    });
    setCreditContractId(response.cantonCreditContractId);
  }

  async function runAllocation() {
    const response = await postJson("/api/allocation/run", {
      dynamicUserId,
      payrollCreditContractId: creditContractId,
      policyContractId: policyContractId || undefined
    });
    setPendingActions(response.pendingActions ?? []);
    await refreshDashboard();
  }

  async function refreshApprovals() {
    const response = await getJson(`/api/approvals?dynamicUserId=${encodeURIComponent(dynamicUserId)}`);
    setPendingActions(response.approvals ?? []);
  }

  async function approveFirstAction() {
    const pending = pendingActions.find((action) => action.payload.status === "Pending") ?? pendingActions[0];
    if (!pending) {
      return;
    }
    const response = await postJson(`/api/approvals/${pending.contractId}/approve`, { dynamicUserId });
    const approvedId = contractId(response.approval);
    if (approvedId) {
      setApprovedActionId(approvedId);
    }
    await refreshApprovals();
  }

  async function executeAgentAction() {
    const approved = pendingActions.find((action) => action.payload.status === "Approved");
    const pendingActionContractId = approvedActionId || approved?.contractId || "demo-pending-action";
    await postJson("/api/agent/execute-approved-action", {
      dynamicUserId,
      pendingActionContractId,
      actionId: String(approved?.payload.actionId ?? "demo-run:external"),
      cantonPartyId: bootstrap?.cantonPartyId ?? `preo-${dynamicUserId}`,
      toAddress: toAddress || undefined,
      amount: String(approved?.payload.amount ?? actionAmount),
      asset: "USDC",
      pendingActionStatus: "Approved",
      actionType: String(approved?.payload.actionType ?? "ActionPortfolioAllocation"),
      runId: String(approved?.payload.actionId ?? "demo-run:external").split(":")[0]
    });
    await refreshDashboard();
  }

  async function refreshDashboard() {
    const response = await getJson(`/api/dashboard?dynamicUserId=${encodeURIComponent(dynamicUserId)}`);
    setDashboard(response);
  }

  async function loadPartyView(role = viewRole) {
    const response = await getJson(`/api/views/${role}?dynamicUserId=${encodeURIComponent(dynamicUserId)}`);
    setPartyView(response);
  }

  function updateCategory(index: number, patch: Partial<CategoryDraft>) {
    setCategories((current) => current.map((category, categoryIndex) => (categoryIndex === index ? { ...category, ...patch } : category)));
  }

  useEffect(() => {
    if (isSignedIn && !bootstrap) {
      void bootstrapUser();
    }
  }, [isSignedIn, dynamicUserId, walletAddress, bootstrap]);

  return (
    <main>
      <div className="topbar">
        <div className="brand">
          <h1>Preo</h1>
          <p>Privacy-first payroll allocation with Dynamic onboarding, Canton accounting, and agent execution.</p>
        </div>
        <div className="stack">
          {dynamicConfigured || walletAddress ? <DynamicAuthButton /> : <span className="status warn">Dynamic env missing</span>}
          <span className={isSignedIn ? "status ok" : "status warn"}>{statusLabel}</span>
        </div>
      </div>

      <div className="grid">
        <section className="panel stack">
          <h2>Account</h2>
          <div className="row">
            <span className="muted">Dynamic user</span>
            <span className="code">{dynamicUserId}</span>
          </div>
          <div className="row">
            <span className="muted">Canton party</span>
            <span className="code">{bootstrap?.cantonPartyId ?? "pending bootstrap"}</span>
          </div>
          <div className="row">
            <span className="muted">Agent wallet</span>
            <span className="code">{bootstrap?.agentWalletAddress ?? "demo wallet"}</span>
          </div>
          <button onClick={bootstrapUser} disabled={busy || !isSignedIn}>
            Bootstrap account
          </button>
        </section>

        <section className="panel stack">
          <h2>Policy</h2>
          <label className="stack">
            <span className="muted">Policy name</span>
            <input value={policyName} onChange={(event) => setPolicyName(event.target.value)} />
          </label>
          <div className={bpsTotal === 10000 ? "status ok" : "status warn"}>{bpsTotal} / 10000 bps</div>
          <div className="stack">
            {categories.map((category, index) => (
              <div className="mini" key={category.categoryId}>
                <input value={category.label} onChange={(event) => updateCategory(index, { label: event.target.value })} />
                <input
                  value={category.percentageBps}
                  onChange={(event) => updateCategory(index, { percentageBps: Number(event.target.value) })}
                  inputMode="numeric"
                />
                <select value={category.categoryType} onChange={(event) => updateCategory(index, { categoryType: event.target.value as CategoryType })}>
                  <option>InternalReserve</option>
                  <option>ExternalPayment</option>
                  <option>PortfolioAllocation</option>
                  <option>ManualHold</option>
                </select>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={category.requiresApproval}
                    onChange={(event) => updateCategory(index, { requiresApproval: event.target.checked })}
                  />
                  Approval
                </label>
              </div>
            ))}
          </div>
          <button onClick={savePolicy} disabled={busy || !isSignedIn || bpsTotal !== 10000}>
            Save policy
          </button>
          <span className="code">{policyContractId || "No policy contract yet"}</span>
        </section>

        <section className="panel stack">
          <h2>Funding</h2>
          <label className="stack">
            <span className="muted">Payroll amount</span>
            <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
          </label>
          <div className="row wrap">
            <button onClick={sendDemoPayroll} disabled={busy || !isSignedIn}>
              Demo employer payroll
            </button>
            <button className="secondary" onClick={startFlow} disabled={busy || !isSignedIn}>
              Dynamic Flow
            </button>
            <button className="secondary" onClick={directDeposit} disabled={busy || !isSignedIn}>
              Direct deposit
            </button>
          </div>
          <button className="secondary" onClick={prepareBlinkDeposit} disabled={busy || !isSignedIn}>
            Prepare Blink deposit
          </button>
          <label className="stack">
            <span className="muted">Vault deposit tx hash</span>
            <input value={vaultTxHash} onChange={(event) => setVaultTxHash(event.target.value)} placeholder="0x..." />
          </label>
          <button className="secondary" onClick={verifyVaultDeposit} disabled={busy || !isSignedIn || !vaultTxHash}>
            Verify vault deposit
          </button>
          <span className="code">{creditContractId || "No payroll credit yet"}</span>
        </section>

        <section className="panel stack">
          <h2>Allocation + Approvals</h2>
          <button onClick={runAllocation} disabled={busy || !isSignedIn || !creditContractId}>
            Run allocation
          </button>
          <div className="row wrap">
            <button className="secondary" onClick={refreshApprovals} disabled={busy || !isSignedIn}>
              Refresh approvals
            </button>
            <button className="secondary" onClick={approveFirstAction} disabled={busy || pendingActions.length === 0}>
              Approve first
            </button>
          </div>
          <label className="stack">
            <span className="muted">Recipient EVM address for external execution</span>
            <input value={toAddress} onChange={(event) => setToAddress(event.target.value)} placeholder="0x..." />
          </label>
          <label className="stack">
            <span className="muted">Fallback action amount</span>
            <input value={actionAmount} onChange={(event) => setActionAmount(event.target.value)} inputMode="decimal" />
          </label>
          <button onClick={executeAgentAction} disabled={busy || !isSignedIn}>
            Execute approved action
          </button>
          <pre className="code compact">{JSON.stringify(pendingActions, null, 2)}</pre>
        </section>

        <section className="panel stack">
          <h2>Dashboard</h2>
          <button onClick={refreshDashboard} disabled={busy || !isSignedIn}>
            Refresh dashboard
          </button>
          <pre className="code compact">{JSON.stringify(dashboard, null, 2)}</pre>
        </section>

        <section className="panel stack">
          <h2>Party Views</h2>
          <select
            value={viewRole}
            onChange={(event) => {
              setViewRole(event.target.value);
              void loadPartyView(event.target.value);
            }}
          >
            <option value="user">User</option>
            <option value="employer">Employer</option>
            <option value="recipient">Recipient</option>
            <option value="operator">Operator</option>
            <option value="other-user">Other User</option>
          </select>
          <button className="secondary" onClick={() => loadPartyView()} disabled={busy || !isSignedIn}>
            Load party view
          </button>
          <pre className="code compact">{JSON.stringify(partyView, null, 2)}</pre>
        </section>

        <section className="panel stack full">
          <h2>Activity</h2>
          <div className="log stack">
            {logs.length === 0 ? <span className="muted">No activity yet.</span> : null}
            {logs.map((entry, index) => (
              <div key={`${entry.label}-${index}`}>
                <strong>{entry.label}</strong>
                <pre className="code">{JSON.stringify(entry.payload, null, 2)}</pre>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
