"use client";

import { DynamicWidget, useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useEffect, useMemo, useState } from "react";
import type { BootstrapResponse } from "@preo/shared";

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

function getWalletAddress(primaryWallet: unknown): string | undefined {
  if (!primaryWallet || typeof primaryWallet !== "object") {
    return undefined;
  }
  const candidate = primaryWallet as { address?: string };
  return candidate.address;
}

export function Dashboard() {
  const dynamicConfigured = Boolean(process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID);

  if (!dynamicConfigured) {
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
  const dynamic = useDynamicContext();
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
  const [toAddress, setToAddress] = useState("");
  const [actionAmount, setActionAmount] = useState("25.00");
  const [vaultTxHash, setVaultTxHash] = useState("");
  const [lastBlinkRef, setLastBlinkRef] = useState("");
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const { dynamicConfigured, dynamicUserId, walletAddress } = identity;
  const isSignedIn = identity.signedIn || !dynamicConfigured;

  const statusLabel = useMemo(() => {
    if (!dynamicConfigured) {
      return "Demo auth";
    }
    return identity.signedIn ? "Signed in with Dynamic" : "Dynamic sign-in required";
  }, [identity.signedIn, dynamicConfigured]);

  function append(label: string, payload: unknown) {
    setLogs((current) => [{ label, payload }, ...current].slice(0, 12));
  }

  async function postJson(path: string, payload: unknown) {
    setBusy(true);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? `Request failed: ${response.status}`);
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

  async function bootstrapUser() {
    const response = await postJson("/api/me/bootstrap", {
      dynamicUserId,
      primaryWalletAddress: walletAddress,
      email: identity.email
    });
    setBootstrap(response);
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
    await postJson("/api/funding/direct-deposit", {
      dynamicUserId,
      amount,
      asset: "USDC",
      sourceRef: `direct-demo-${Date.now()}`
    });
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
      amount,
      chainId: session.chainId,
      address: session.destinationAddress,
      token: session.tokenAddress,
      callbackScheme: null
    });
  }

  async function verifyVaultDeposit() {
    await postJson("/api/funding/evm/verify-deposit", {
      dynamicUserId,
      txHash: vaultTxHash,
      sourceRef: lastBlinkRef || undefined,
      demoAmount: amount
    });
  }

  async function executeAgentAction() {
    await postJson("/api/agent/execute-approved-action", {
      dynamicUserId,
      pendingActionContractId: "demo-pending-action",
      actionId: "demo-run:external",
      cantonPartyId: bootstrap?.cantonPartyId ?? `preo-${dynamicUserId}`,
      toAddress: toAddress || undefined,
      amount: actionAmount,
      asset: "USDC",
      pendingActionStatus: "Approved",
      actionType: "ActionExternalPayment",
      runId: "demo-run"
    });
  }

  useEffect(() => {
    if (isSignedIn && !bootstrap) {
      void bootstrapUser();
    }
    // Run only when identity materially changes.
  }, [isSignedIn, dynamicUserId, walletAddress, bootstrap]);

  return (
    <main>
      <div className="topbar">
        <div className="brand">
          <h1>Preo</h1>
          <p>Privacy-first payroll allocation with Dynamic onboarding and agent execution.</p>
        </div>
        <div className="stack">
          {dynamicConfigured ? <DynamicWidget /> : <span className="status warn">Dynamic env missing</span>}
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
            <span className="muted">Primary wallet</span>
            <span className="code">{walletAddress || "not connected"}</span>
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
          <h2>Funding</h2>
          <label className="stack">
            <span className="muted">Payroll amount</span>
            <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
          </label>
          <div className="row">
            <button onClick={startFlow} disabled={busy || !isSignedIn}>
              Start Dynamic Flow
            </button>
            <button className="secondary" onClick={directDeposit} disabled={busy || !isSignedIn}>
              Direct testnet deposit
            </button>
          </div>
          <div className="row">
            <button onClick={prepareBlinkDeposit} disabled={busy || !isSignedIn}>
              Prepare Blink deposit
            </button>
            <span className="status ok">Blink secondary</span>
          </div>
          <label className="stack">
            <span className="muted">Vault deposit tx hash</span>
            <input value={vaultTxHash} onChange={(event) => setVaultTxHash(event.target.value)} placeholder="0x..." />
          </label>
          <button className="secondary" onClick={verifyVaultDeposit} disabled={busy || !isSignedIn || !vaultTxHash}>
            Verify vault deposit
          </button>
        </section>

        <section className="panel stack">
          <h2>Agent Execution</h2>
          <label className="stack">
            <span className="muted">Recipient EVM address</span>
            <input value={toAddress} onChange={(event) => setToAddress(event.target.value)} placeholder="0x..." />
          </label>
          <label className="stack">
            <span className="muted">Approved amount</span>
            <input value={actionAmount} onChange={(event) => setActionAmount(event.target.value)} inputMode="decimal" />
          </label>
          <button onClick={executeAgentAction} disabled={busy || !isSignedIn}>
            Execute approved action
          </button>
        </section>

        <section className="panel stack">
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
