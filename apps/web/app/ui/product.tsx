"use client";

import { DynamicWidget, useDynamicContext } from "@dynamic-labs/sdk-react-core";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  approveAction,
  bootstrapMe,
  createBlinkSession,
  createDirectDeposit,
  createFlowCheckout,
  executeApprovedAction,
  getAgentActions,
  getApprovals,
  getDashboard,
  getPartyView,
  getPolicy,
  getPortfolio,
  rejectAction,
  resetDemo,
  runAllocation,
  runDemoFullFlow,
  savePolicy,
  sendDemoPayroll,
  signBlinkPayment,
  validatePolicy,
  verifyVaultDeposit,
  type ApiValidationResult,
  type ApprovalRule,
  type CategoryType,
  type ContractSnapshot,
  type DashboardResponse,
  type PartyViewResponse,
  type PolicyCategory,
  type PolicyInput,
  type PortfolioModel
} from "@/lib/api";
import type { BootstrapResponse, PartyViewRole } from "@preo/shared";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/policy", label: "Policy" },
  { href: "/fund", label: "Fund Payroll" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/approvals", label: "Approvals" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/privacy-demo", label: "Privacy Demo" }
];

const exampleCategories: PolicyCategory[] = [
  { categoryId: "rent", label: "Rent", percentageBps: 3500, categoryType: "ExternalPayment", recipientParty: "preo-demo-recipient", requiresApproval: false },
  { categoryId: "reserve", label: "Emergency Fund", percentageBps: 2500, categoryType: "InternalReserve", requiresApproval: false },
  { categoryId: "portfolio", label: "Portfolio", percentageBps: 2500, categoryType: "PortfolioAllocation", portfolioTarget: "GlobalEquityBasket", requiresApproval: true },
  { categoryId: "spending", label: "Spending", percentageBps: 1500, categoryType: "ManualHold", requiresApproval: false }
];

const roleVisibility: Record<PartyViewRole, { canSee: string[]; cannotSee: string[] }> = {
  user: {
    canSee: ["PayrollPolicy", "PayrollCredit", "CategoryBalance", "AllocationRun", "PendingAction", "PortfolioAllocation", "PaymentReceipt"],
    cannotSee: ["Other users' salary records"]
  },
  employer: {
    canSee: ["EmployerPayrollNotice"],
    cannotSee: ["Policy", "category balances", "approvals", "portfolio allocation"]
  },
  recipient: {
    canSee: ["PaymentReceipt addressed to this party"],
    cannotSee: ["Salary amount", "policy", "other recipients", "portfolio"]
  },
  operator: {
    canSee: ["OperatorAuditEvent metadata"],
    cannotSee: ["Private category details", "balances", "policy percentages"]
  },
  "other-user": {
    canSee: ["No Preo payroll contracts for this user"],
    cannotSee: ["Everything about the employee payroll flow"]
  }
};

type Identity = {
  dynamicConfigured: boolean;
  dynamicUserId: string;
  walletAddress?: string;
  email?: string;
  signedIn: boolean;
};

type AsyncState = {
  busy: boolean;
  error: string;
  message: string;
};

function getWalletAddress(primaryWallet: unknown): string | undefined {
  if (!primaryWallet || typeof primaryWallet !== "object") {
    return undefined;
  }
  return (primaryWallet as { address?: string }).address;
}

const defaultIdentity: Identity = {
  dynamicConfigured: Boolean(process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID),
  dynamicUserId: "demo-dynamic-user",
  signedIn: !process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID
};
const IdentityContext = createContext<Identity>(defaultIdentity);
const IdentitySetterContext = createContext<(identity: Identity) => void>(() => {});

function usePreoIdentity(): Identity {
  return useContext(IdentityContext);
}

function PreoIdentityProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<Identity>(defaultIdentity);
  return (
    <IdentityContext.Provider value={identity}>
      <IdentitySetterContext.Provider value={setIdentity}>
        <DynamicIdentityBridge />
        {children}
      </IdentitySetterContext.Provider>
    </IdentityContext.Provider>
  );
}

function DynamicIdentityBridge() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID) {
    return null;
  }
  return <DynamicIdentityBridgeInner />;
}

function DynamicIdentityBridgeInner() {
  const dynamic = useDynamicContext();
  const setIdentity = useContext(IdentitySetterContext);
  const dynamicConfigured = Boolean(process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID);
  useEffect(() => {
    setIdentity({
      dynamicConfigured,
      dynamicUserId: dynamic.user?.userId ?? "demo-dynamic-user",
      walletAddress: getWalletAddress(dynamic.primaryWallet),
      email: dynamic.user?.email,
      signedIn: Boolean(dynamic.user) || !dynamicConfigured
    });
  }, [dynamic.primaryWallet, dynamic.user, dynamicConfigured, setIdentity]);
  return null;
}

function DynamicAuthWidget() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <StatusPill>Dynamic</StatusPill>;
  }
  return <DynamicWidget />;
}

function useAsyncState(): [AsyncState, <T>(action: () => Promise<T>, success?: string) => Promise<T | undefined>, (message: string) => void] {
  const [state, setState] = useState<AsyncState>({ busy: false, error: "", message: "" });
  async function run<T>(action: () => Promise<T>, success = "Done") {
    setState({ busy: true, error: "", message: "" });
    try {
      const result = await action();
      setState({ busy: false, error: "", message: success });
      return result;
    } catch (error) {
      setState({ busy: false, error: error instanceof Error ? error.message : String(error), message: "" });
      return undefined;
    }
  }
  return [state, run, (message: string) => setState((current) => ({ ...current, message }))];
}

function useSavedDemoState() {
  const [policyContractId, setPolicyContractIdState] = useState("");
  const [creditContractId, setCreditContractIdState] = useState("");
  const [cantonPartyId, setCantonPartyIdState] = useState("");

  useEffect(() => {
    setPolicyContractIdState(localStorage.getItem("preo.policyContractId") ?? "");
    setCreditContractIdState(localStorage.getItem("preo.creditContractId") ?? "");
    setCantonPartyIdState(localStorage.getItem("preo.cantonPartyId") ?? "");
  }, []);

  function setPolicyContractId(value: string) {
    setPolicyContractIdState(value);
    localStorage.setItem("preo.policyContractId", value);
  }
  function setCreditContractId(value: string) {
    setCreditContractIdState(value);
    localStorage.setItem("preo.creditContractId", value);
  }
  function setCantonPartyId(value: string) {
    setCantonPartyIdState(value);
    localStorage.setItem("preo.cantonPartyId", value);
  }
  function clear() {
    ["preo.policyContractId", "preo.creditContractId", "preo.cantonPartyId"].forEach((key) => localStorage.removeItem(key));
    setPolicyContractIdState("");
    setCreditContractIdState("");
    setCantonPartyIdState("");
  }
  return { policyContractId, creditContractId, cantonPartyId, setPolicyContractId, setCreditContractId, setCantonPartyId, clear };
}

function amount(value: unknown) {
  const number = Number(String(value ?? "0"));
  return Number.isFinite(number) ? number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : String(value ?? "");
}

function bps(value: unknown) {
  return `${(Number(value ?? 0) / 100).toFixed(0)}%`;
}

function displayPortfolioModel(value: unknown) {
  if (!value) {
    return "Unassigned";
  }
  if (typeof value === "object") {
    const record = value as { custom?: unknown; tag?: string; value?: unknown };
    if (record.custom) {
      return `Custom: ${String(record.custom)}`;
    }
    if (record.tag === "CustomPortfolio") {
      return `Custom: ${String(record.value ?? "")}`;
    }
  }
  return String(value)
    .replace("GlobalEquityBasket", "Global Equity Basket")
    .replace("TreasuryYield", "Treasury Yield")
    .replace("USDCSavings", "USDC Savings");
}

function payloadOf(contract: ContractSnapshot | undefined | null) {
  return (contract?.payload ?? {}) as Record<string, unknown>;
}

function StatusPill({ tone = "neutral", children }: { tone?: "neutral" | "ok" | "warn" | "danger"; children: React.ReactNode }) {
  return <span className={`status ${tone}`}>{children}</span>;
}

function Notice({ state }: { state: AsyncState }) {
  if (!state.error && !state.message) {
    return null;
  }
  return <div className={state.error ? "notice danger" : "notice ok"}>{state.error || state.message}</div>;
}

function PageHeader({ eyebrow, title, children, actions }: { eyebrow: string; title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{children}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </section>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="code compact">{JSON.stringify(value, null, 2)}</pre>;
}

function ContractTable({ contracts, empty = "No visible contracts." }: { contracts: ContractSnapshot[]; empty?: string }) {
  if (!contracts.length) {
    return <div className="empty">{empty}</div>;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Template</th>
            <th>Contract</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((contract) => (
            <tr key={contract.contractId}>
              <td>{contract.templateId.split(":").slice(-1)[0]}</td>
              <td className="code">{contract.contractId}</td>
              <td className="code">{JSON.stringify(contract.payload)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IdentityPanel({ identity }: { identity: Identity }) {
  return (
    <div className="identity-panel">
      <StatusPill tone={identity.signedIn ? "ok" : "warn"}>{identity.dynamicConfigured ? (identity.signedIn ? "Dynamic connected" : "Dynamic sign-in required") : "Demo auth"}</StatusPill>
      <span className="code">{identity.dynamicUserId}</span>
    </div>
  );
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const dynamicConfigured = Boolean(process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID);
  return (
    <PreoIdentityProvider>
      <header className="app-shell">
        <Link href="/" className="brand-mark" aria-label="Preo overview">
          <span>Preo</span>
          <small>Private payroll neobank</small>
        </Link>
        <nav>
          {navItems.map((item) => (
            <Link key={item.href} className={pathname === item.href ? "active" : ""} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="shell-actions">
          <Link className="demo-link" href="/demo">
            Demo
          </Link>
          {dynamicConfigured ? <DynamicAuthWidget /> : <StatusPill tone="warn">Demo mode</StatusPill>}
        </div>
      </header>
      {children}
    </PreoIdentityProvider>
  );
}

export function LandingPage() {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Canton privacy + Dynamic onboarding + Blink deposits</span>
          <h1>Preo is the privacy-first agentic payroll neobank.</h1>
          <p>Receive stablecoin payroll and automatically route salary into user-defined private financial categories.</p>
          <div className="hero-actions">
            <Link className="button" href="/policy">
              Create payroll policy
            </Link>
            <Link className="button secondary" href="/privacy-demo">
              View privacy demo
            </Link>
          </div>
        </div>
        <div className="hero-ledger" aria-label="Private payroll allocation preview">
          <div className="ledger-top">
            <span>Incoming salary</span>
            <strong>2,500.00 USDC</strong>
          </div>
          {exampleCategories.map((category) => (
            <div className="ledger-line" key={category.categoryId}>
              <span>{category.label}</span>
              <span>{bps(category.percentageBps)}</span>
            </div>
          ))}
          <StatusPill tone="ok">Private on Canton</StatusPill>
        </div>
      </section>

      <section className="band">
        <h2>How it works</h2>
        <div className="steps">
          {["Receive salary", "Define custom categories", "Agent allocates payroll", "Canton keeps balances private"].map((step, index) => (
            <article className="step" key={step}>
              <span>{index + 1}</span>
              <h3>{step}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="split-band">
        <div>
          <h2>Built with</h2>
          <div className="badge-row">
            <StatusPill>Canton</StatusPill>
            <StatusPill>Dynamic</StatusPill>
            <StatusPill>Blink</StatusPill>
          </div>
        </div>
        <div>
          <h2>Why privacy</h2>
          <p className="large-copy">Your employer should not see your investments. Your recipient should not see your salary. Other users should see nothing.</p>
        </div>
      </section>
    </main>
  );
}

export function OnboardingPage() {
  const identity = usePreoIdentity();
  const saved = useSavedDemoState();
  const [state, run] = useAsyncState();
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);

  async function bootstrapAccount() {
    const response = await run(
      () =>
        bootstrapMe({
          dynamicUserId: identity.dynamicUserId,
          primaryWalletAddress: identity.walletAddress,
          email: identity.email
        }),
      "Preo account bootstrapped"
    );
    if (response) {
      setBootstrap(response);
      saved.setCantonPartyId(response.cantonPartyId);
    }
  }

  return (
    <main>
      <PageHeader eyebrow="Onboarding" title="Create your Preo account" actions={<IdentityPanel identity={identity} />}>
        Sign in with Dynamic, then bootstrap a private Canton party and agent wallet for the payroll demo.
      </PageHeader>
      <Notice state={state} />
      <div className="grid two">
        <section className="panel stack">
          <h2>Dynamic sign-in</h2>
          {identity.dynamicConfigured ? <DynamicAuthWidget /> : <StatusPill tone="warn">Dynamic env missing; using demo identity</StatusPill>}
          <div className="facts">
            <span>Dynamic user</span>
            <strong className="code">{identity.dynamicUserId}</strong>
            <span>Wallet</span>
            <strong className="code">{identity.walletAddress ?? "Demo wallet"}</strong>
          </div>
          <button onClick={bootstrapAccount} disabled={state.busy || !identity.signedIn}>
            Create Preo account
          </button>
        </section>
        <section className="panel stack">
          <h2>Account status</h2>
          <div className="facts">
            <span>Preo user ID</span>
            <strong className="code">{bootstrap?.preoUserId ?? "Not created yet"}</strong>
            <span>Canton party</span>
            <strong className="code">{bootstrap?.cantonPartyId ?? saved.cantonPartyId ?? "Pending"}</strong>
            <span>Agent wallet</span>
            <strong className="code">{bootstrap?.agentWalletAddress ?? "Pending"}</strong>
            <span>Canton profile</span>
            <strong>{bootstrap?.hasCantonProfile ? "Created" : "Pending"}</strong>
          </div>
        </section>
      </div>
    </main>
  );
}

export function PolicyBuilderPage() {
  const identity = usePreoIdentity();
  const saved = useSavedDemoState();
  const [state, run] = useAsyncState();
  const [policyName, setPolicyName] = useState("");
  const [categories, setCategories] = useState<PolicyCategory[]>([]);
  const [previewAmount, setPreviewAmount] = useState("2500.00");
  const [validation, setValidation] = useState<ApiValidationResult | null>(null);
  const [approvalSettings, setApprovalSettings] = useState({
    newRecipient: true,
    investments: true,
    largeTransfer: false,
    externalWithdrawal: false,
    thresholdAmount: "1000.00"
  });

  const totalBps = categories.reduce((sum, category) => sum + Number(category.percentageBps || 0), 0);
  const policyInput = useMemo<PolicyInput>(() => {
    const approvalRules: ApprovalRule[] = [];
    if (approvalSettings.newRecipient) {
      approvalRules.push({ ruleId: "new-recipient", actionType: "ActionNewRecipient", enabled: true, description: "Ask before sending payroll to a new recipient" });
    }
    if (approvalSettings.investments) {
      approvalRules.push({ ruleId: "portfolio", actionType: "ActionPortfolioAllocation", enabled: true, description: "Ask before portfolio allocation" });
    }
    if (approvalSettings.largeTransfer) {
      approvalRules.push({
        ruleId: "large-transfer",
        actionType: "ActionLargeTransfer",
        enabled: true,
        thresholdAmount: approvalSettings.thresholdAmount,
        description: "Ask before large payroll transfers"
      });
    }
    if (approvalSettings.externalWithdrawal) {
      approvalRules.push({ ruleId: "external-withdrawal", actionType: "ActionExternalWithdrawal", enabled: true, description: "Ask before external withdrawal" });
    }
    return { policyName, categories, approvalRules };
  }, [approvalSettings, categories, policyName]);

  function addCategory() {
    const index = categories.length + 1;
    setCategories((current) => [
      ...current,
      {
        categoryId: `category-${index}`,
        label: "",
        percentageBps: 0,
        categoryType: "InternalReserve",
        requiresApproval: false
      }
    ]);
  }

  function updateCategory(index: number, patch: Partial<PolicyCategory>) {
    setCategories((current) => current.map((category, categoryIndex) => (categoryIndex === index ? { ...category, ...patch } : category)));
  }

  async function previewPolicy() {
    const response = await run(() => validatePolicy(policyInput), "Policy preview refreshed");
    if (response) {
      setValidation(response);
    }
  }

  async function save() {
    const response = await run(async () => {
      const result = await validatePolicy(policyInput);
      setValidation(result);
      if (!result.valid) {
        throw new Error(result.errors[0]?.message ?? "Policy is invalid");
      }
      return savePolicy(identity.dynamicUserId, policyInput);
    }, "Policy saved");
    if (response?.policyContractId) {
      saved.setPolicyContractId(response.policyContractId);
    }
  }

  return (
    <main>
      <PageHeader eyebrow="Policy Builder" title="Build a custom payroll policy" actions={<IdentityPanel identity={identity} />}>
        Start from a blank policy or use the example as a template. Percentages must add to exactly 100%.
      </PageHeader>
      <Notice state={state} />
      <section className="panel stack">
        <div className="row wrap">
          <label className="field grow">
            <span>Policy name</span>
            <input value={policyName} onChange={(event) => setPolicyName(event.target.value)} placeholder="June payroll policy" />
          </label>
          <StatusPill tone={totalBps === 10000 ? "ok" : "warn"}>Allocated: {bps(totalBps)} / 100%</StatusPill>
          <button className="secondary" onClick={() => {
            setPolicyName("Judge demo payroll policy");
            setCategories(exampleCategories);
          }}>
            Start from example
          </button>
          <button onClick={addCategory}>Add category</button>
        </div>
        {categories.length === 0 ? <div className="empty">No categories yet. Add your own private financial categories to begin.</div> : null}
        <div className="category-list">
          {categories.map((category, index) => (
            <CategoryEditor key={`${category.categoryId}-${index}`} category={category} index={index} updateCategory={updateCategory} remove={() => setCategories((current) => current.filter((_, i) => i !== index))} />
          ))}
        </div>
      </section>

      <div className="grid two">
        <section className="panel stack">
          <h2>Approval rules</h2>
          <Toggle label="Ask before new recipient" checked={approvalSettings.newRecipient} onChange={(value) => setApprovalSettings((current) => ({ ...current, newRecipient: value }))} />
          <Toggle label="Ask before investments" checked={approvalSettings.investments} onChange={(value) => setApprovalSettings((current) => ({ ...current, investments: value }))} />
          <Toggle label="Ask before transfer above amount" checked={approvalSettings.largeTransfer} onChange={(value) => setApprovalSettings((current) => ({ ...current, largeTransfer: value }))} />
          {approvalSettings.largeTransfer ? (
            <label className="field">
              <span>Custom threshold</span>
              <input value={approvalSettings.thresholdAmount} onChange={(event) => setApprovalSettings((current) => ({ ...current, thresholdAmount: event.target.value }))} />
            </label>
          ) : null}
          <Toggle label="Ask before external withdrawal" checked={approvalSettings.externalWithdrawal} onChange={(value) => setApprovalSettings((current) => ({ ...current, externalWithdrawal: value }))} />
        </section>
        <section className="panel stack">
          <h2>Preview allocation</h2>
          <label className="field">
            <span>Hypothetical payroll amount</span>
            <input value={previewAmount} onChange={(event) => setPreviewAmount(event.target.value)} inputMode="decimal" />
          </label>
          <div className="row wrap">
            <button className="secondary" onClick={previewPolicy} disabled={state.busy}>
              Validate policy
            </button>
            <button onClick={save} disabled={state.busy || !identity.signedIn}>
              Save policy
            </button>
          </div>
          {validation ? <ValidationSummary validation={validation} /> : null}
          <div className="allocation-preview">
            {categories.map((category) => (
              <div key={category.categoryId} className="ledger-line">
                <span>{category.label || category.categoryId}</span>
                <strong>
                  {amount((Number(previewAmount || 0) * category.percentageBps) / 10000)} USDC
                </strong>
              </div>
            ))}
          </div>
          <span className="code">{saved.policyContractId || "No saved policy contract yet"}</span>
        </section>
      </div>
    </main>
  );
}

function CategoryEditor({
  category,
  index,
  updateCategory,
  remove
}: {
  category: PolicyCategory;
  index: number;
  updateCategory: (index: number, patch: Partial<PolicyCategory>) => void;
  remove: () => void;
}) {
  const portfolioKind = typeof category.portfolioTarget === "object" ? "Custom" : category.portfolioTarget ?? "GlobalEquityBasket";
  return (
    <article className="category-editor">
      <div className="row wrap">
        <label className="field grow">
          <span>Category name</span>
          <input value={category.label} onChange={(event) => updateCategory(index, { label: event.target.value, categoryId: slug(event.target.value) || category.categoryId })} placeholder="Emergency fund" />
        </label>
        <label className="field small">
          <span>Percent</span>
          <input value={category.percentageBps / 100} onChange={(event) => updateCategory(index, { percentageBps: Math.round(Number(event.target.value || 0) * 100) })} inputMode="decimal" />
        </label>
        <label className="field">
          <span>Type</span>
          <select value={category.categoryType} onChange={(event) => updateCategory(index, { categoryType: event.target.value as CategoryType })}>
            <option value="InternalReserve">Internal Reserve</option>
            <option value="ExternalPayment">External Payment</option>
            <option value="PortfolioAllocation">Portfolio Allocation</option>
            <option value="ManualHold">Manual Hold</option>
          </select>
        </label>
        <button className="secondary" onClick={remove}>
          Remove
        </button>
      </div>
      {category.categoryType === "ExternalPayment" ? (
        <div className="row wrap">
          <label className="field grow">
            <span>Recipient Canton party</span>
            <input value={category.recipientParty ?? ""} onChange={(event) => updateCategory(index, { recipientParty: event.target.value })} placeholder="preo-demo-recipient" />
          </label>
          <label className="field grow">
            <span>External wallet address</span>
            <input value={category.externalAddress ?? ""} onChange={(event) => updateCategory(index, { externalAddress: event.target.value })} placeholder="0x..." />
          </label>
        </div>
      ) : null}
      {category.categoryType === "PortfolioAllocation" ? (
        <div className="row wrap">
          <label className="field">
            <span>Portfolio model</span>
            <select
              value={portfolioKind}
              onChange={(event) => {
                const value = event.target.value;
                updateCategory(index, { portfolioTarget: value === "Custom" ? { custom: "Custom model" } : (value as PortfolioModel) });
              }}
            >
              <option value="GlobalEquityBasket">Global Equity Basket</option>
              <option value="TreasuryYield">Treasury Yield</option>
              <option value="USDCSavings">USDC Savings</option>
              <option value="Custom">Custom</option>
            </select>
          </label>
          {typeof category.portfolioTarget === "object" ? (
            <label className="field grow">
              <span>Custom model name</span>
              <input value={category.portfolioTarget.custom} onChange={(event) => updateCategory(index, { portfolioTarget: { custom: event.target.value } })} />
            </label>
          ) : null}
        </div>
      ) : null}
      <Toggle label="Requires approval" checked={category.requiresApproval} onChange={(checked) => updateCategory(index, { requiresApproval: checked })} />
    </article>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function ValidationSummary({ validation }: { validation: ApiValidationResult }) {
  return (
    <div className={validation.valid ? "notice ok" : "notice danger"}>
      {validation.valid ? "Policy is valid." : validation.errors.map((error) => error.message).join(" ")}
      {validation.warnings.length ? ` ${validation.warnings.map((warning) => warning.message).join(" ")}` : ""}
    </div>
  );
}

export function FundPage() {
  const identity = usePreoIdentity();
  const saved = useSavedDemoState();
  const [state, run] = useAsyncState();
  const [amountValue, setAmountValue] = useState("2500.00");
  const [employerName, setEmployerName] = useState("Demo Employer");
  const [vaultTxHash, setVaultTxHash] = useState("");
  const [blinkRef, setBlinkRef] = useState("");
  const [latest, setLatest] = useState<unknown>(null);

  async function rememberCredit(result: Record<string, unknown> | undefined) {
    if (typeof result?.cantonCreditContractId === "string") {
      saved.setCreditContractId(result.cantonCreditContractId);
    }
    setLatest(result);
  }

  return (
    <main>
      <PageHeader eyebrow="Fund Payroll" title="Get salary into Preo" actions={<IdentityPanel identity={identity} />}>
        Dynamic Flow is primary, Blink is secondary, and demo employer payroll keeps the judge path reliable.
      </PageHeader>
      <Notice state={state} />
      <div className="grid three">
        <section className="panel stack">
          <h2>Dynamic Flow</h2>
          <p className="muted">Fund with Dynamic Flow when the environment is enabled. Demo mode returns a direct-deposit fallback.</p>
          <label className="field">
            <span>Amount</span>
            <input value={amountValue} onChange={(event) => setAmountValue(event.target.value)} />
          </label>
          <button onClick={() => run(() => createFlowCheckout(identity.dynamicUserId, amountValue).then((result) => (setLatest(result), result)), "Flow deposit started")} disabled={state.busy || !identity.signedIn}>
            Start Flow deposit
          </button>
        </section>
        <section className="panel stack">
          <h2>Blink deposit</h2>
          <p className="muted">Blink funds your account in one tap through the server-side signer path.</p>
          <button
            className="secondary"
            onClick={() =>
              run(async () => {
                const session = await createBlinkSession(identity.dynamicUserId, amountValue);
                setBlinkRef(String(session.externalRef ?? ""));
                await signBlinkPayment({
                  amount: amountValue,
                  chainId: session.chainId,
                  address: session.destinationAddress,
                  token: session.tokenAddress,
                  callbackScheme: null
                });
                setLatest(session);
                return session;
              }, "Blink deposit prepared")
            }
            disabled={state.busy || !identity.signedIn}
          >
            Prepare Blink deposit
          </button>
          <span className="code">{blinkRef || "No Blink reference yet"}</span>
        </section>
        <section className="panel stack">
          <h2>Demo employer payroll</h2>
          <label className="field">
            <span>Employer name</span>
            <input value={employerName} onChange={(event) => setEmployerName(event.target.value)} />
          </label>
          <button onClick={() => run(() => sendDemoPayroll(identity.dynamicUserId, amountValue, employerName).then((result) => (rememberCredit(result), result)), "Payroll sent")} disabled={state.busy || !identity.signedIn}>
            Send testnet payroll
          </button>
          <button className="secondary" onClick={() => run(() => createDirectDeposit(identity.dynamicUserId, amountValue).then((result) => (rememberCredit(result), result)), "Direct deposit credited")} disabled={state.busy || !identity.signedIn}>
            Direct deposit fallback
          </button>
        </section>
      </div>
      <section className="panel stack">
        <h2>Vault verification</h2>
        <div className="row wrap">
          <label className="field grow">
            <span>Vault deposit tx hash</span>
            <input value={vaultTxHash} onChange={(event) => setVaultTxHash(event.target.value)} placeholder="0x..." />
          </label>
          <button className="secondary" onClick={() => run(() => verifyVaultDeposit(identity.dynamicUserId, vaultTxHash, amountValue, blinkRef).then((result) => (rememberCredit(result), result)), "Vault deposit verified")} disabled={state.busy || !vaultTxHash}>
            Verify vault deposit
          </button>
        </div>
        <span className="code">Payroll credit: {saved.creditContractId || "none"}</span>
        {latest ? <JsonBlock value={latest} /> : null}
      </section>
    </main>
  );
}

export function DashboardPage() {
  const identity = usePreoIdentity();
  const [state, run] = useAsyncState();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [policy, setPolicy] = useState<unknown>(null);
  const [actions, setActions] = useState<unknown[]>([]);

  async function refresh() {
    await run(async () => {
      const [dashboardResponse, policyResponse, actionResponse] = await Promise.all([getDashboard(identity.dynamicUserId), getPolicy(identity.dynamicUserId), getAgentActions(identity.dynamicUserId)]);
      setDashboard(dashboardResponse);
      setPolicy(policyResponse);
      setActions(actionResponse.actions);
      return dashboardResponse;
    }, "Dashboard refreshed");
  }

  useEffect(() => {
    if (identity.signedIn) {
      void refresh();
    }
  }, [identity.dynamicUserId, identity.signedIn]);

  const balances = dashboard?.categoryBalances ?? [];
  const pending = (dashboard?.pendingApprovals ?? []).filter((approval) => payloadOf(approval).status === "Pending");
  return (
    <main>
      <PageHeader eyebrow="Dashboard" title="Private salary command center" actions={<button onClick={refresh} disabled={state.busy}>Refresh</button>}>
        Review private Canton balances, the active policy, allocation runs, approvals, and recent agent activity.
      </PageHeader>
      <Notice state={state} />
      <div className="metric-grid">
        <Metric label="Private salary credits" value={dashboard?.payrollCredits.length ?? 0} />
        <Metric label="Private categories" value={balances.length} />
        <Metric label="Pending approvals" value={pending.length} />
        <Metric label="Portfolio allocations" value={dashboard?.portfolioAllocations.length ?? 0} />
      </div>
      <div className="grid two">
        <section className="panel stack">
          <h2>Private categories</h2>
          <div className="card-list">
            {balances.length ? balances.map((contract) => <CategoryBalanceCard key={contract.contractId} contract={contract} />) : <div className="empty">Run allocation to create private category balances.</div>}
          </div>
        </section>
        <section className="panel stack">
          <h2>Active policy</h2>
          <JsonBlock value={policy ?? dashboard?.activePolicy ?? "No active policy"} />
        </section>
        <section className="panel stack">
          <h2>Allocation runs</h2>
          <ContractTable contracts={dashboard?.allocationRuns ?? []} empty="No allocation runs yet." />
        </section>
        <section className="panel stack">
          <h2>Activity log</h2>
          {actions.length ? <JsonBlock value={actions} /> : <div className="empty">No agent activity yet.</div>}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function CategoryBalanceCard({ contract }: { contract: ContractSnapshot }) {
  const payload = payloadOf(contract);
  return (
    <article className="mini-card">
      <div>
        <h3>{String(payload.label ?? payload.categoryId ?? "Category")}</h3>
        <p>{String(payload.categoryType ?? "Private category")}</p>
      </div>
      <strong>
        {amount(payload.balance)} {String(payload.asset ?? "USDC")}
      </strong>
      <StatusPill tone="ok">Private on Canton</StatusPill>
    </article>
  );
}

export function ApprovalsPage() {
  const identity = usePreoIdentity();
  const saved = useSavedDemoState();
  const [state, run] = useAsyncState();
  const [approvals, setApprovals] = useState<ContractSnapshot[]>([]);
  const [execution, setExecution] = useState<unknown>(null);

  async function refresh() {
    const response = await run(() => getApprovals(identity.dynamicUserId), "Approvals refreshed");
    if (response) {
      setApprovals(response.approvals);
    }
  }

  useEffect(() => {
    if (identity.signedIn) {
      void refresh();
    }
  }, [identity.dynamicUserId, identity.signedIn]);

  async function approve(contract: ContractSnapshot) {
    const response = await run(() => approveAction(identity.dynamicUserId, contract.contractId), "Action approved");
    const approval = response?.approval as ContractSnapshot | undefined;
    if (approval) {
      setApprovals((current) => [approval, ...current.filter((item) => item.contractId !== contract.contractId)]);
    }
  }

  async function reject(contract: ContractSnapshot) {
    const response = await run(() => rejectAction(identity.dynamicUserId, contract.contractId), "Action rejected");
    const approval = response?.approval as ContractSnapshot | undefined;
    if (approval) {
      setApprovals((current) => [approval, ...current.filter((item) => item.contractId !== contract.contractId)]);
    }
  }

  async function execute(contract: ContractSnapshot) {
    const payload = payloadOf(contract);
    const response = await run(
      () =>
        executeApprovedAction({
          dynamicUserId: identity.dynamicUserId,
          pendingActionContractId: contract.contractId,
          actionId: String(payload.actionId ?? contract.contractId),
          cantonPartyId: saved.cantonPartyId || String(payload.user ?? ""),
          amount: String(payload.amount ?? "0"),
          asset: String(payload.asset ?? "USDC"),
          pendingActionStatus: "Approved",
          actionType: String(payload.actionType ?? "ActionPortfolioAllocation"),
          runId: String(payload.actionId ?? contract.contractId).split(":")[0],
          toAddress: typeof payload.externalAddress === "string" && payload.externalAddress.startsWith("0x") ? payload.externalAddress : undefined
        }),
      "Approved action executed"
    );
    if (response) {
      setExecution(response);
      await refresh();
    }
  }

  return (
    <main>
      <PageHeader eyebrow="Approvals" title="Approve sensitive payroll actions" actions={<button onClick={refresh} disabled={state.busy}>Refresh</button>}>
        PendingAction contracts appear here when a user-defined policy requires approval before payment or portfolio allocation.
      </PageHeader>
      <Notice state={state} />
      <div className="card-list">
        {approvals.length ? approvals.map((approval) => <ApprovalCard key={approval.contractId} contract={approval} approve={approve} reject={reject} execute={execute} busy={state.busy} />) : <div className="empty">No approval actions visible for this party.</div>}
      </div>
      {execution ? (
        <section className="panel stack">
          <h2>Latest execution</h2>
          <JsonBlock value={execution} />
        </section>
      ) : null}
    </main>
  );
}

function ApprovalCard({
  contract,
  approve,
  reject,
  execute,
  busy
}: {
  contract: ContractSnapshot;
  approve: (contract: ContractSnapshot) => void;
  reject: (contract: ContractSnapshot) => void;
  execute: (contract: ContractSnapshot) => void;
  busy: boolean;
}) {
  const payload = payloadOf(contract);
  const status = String(payload.status ?? "Pending");
  return (
    <article className="approval-card">
      <div>
        <StatusPill tone={status === "Pending" ? "warn" : status === "Approved" ? "ok" : "neutral"}>{status}</StatusPill>
        <h2>{String(payload.label ?? "Payroll action")}</h2>
        <p>{String(payload.reason ?? "Approval required by policy.")}</p>
      </div>
      <div className="facts compact-facts">
        <span>Action</span>
        <strong>{String(payload.actionType ?? "")}</strong>
        <span>Amount</span>
        <strong>
          {amount(payload.amount)} {String(payload.asset ?? "USDC")}
        </strong>
        <span>Portfolio</span>
        <strong>{displayPortfolioModel(payload.portfolioTarget)}</strong>
      </div>
      <div className="row wrap">
        <button onClick={() => approve(contract)} disabled={busy || status !== "Pending"}>
          Approve
        </button>
        <button className="secondary" onClick={() => reject(contract)} disabled={busy || status !== "Pending"}>
          Reject
        </button>
        <button className="secondary" onClick={() => execute(contract)} disabled={busy || status !== "Approved"}>
          Execute approved action
        </button>
      </div>
    </article>
  );
}

export function PortfolioPage() {
  const identity = usePreoIdentity();
  const [state, run] = useAsyncState();
  const [allocations, setAllocations] = useState<ContractSnapshot[]>([]);

  async function refresh() {
    const response = await run(() => getPortfolio(identity.dynamicUserId), "Portfolio refreshed");
    if (response) {
      setAllocations(response.portfolioAllocations);
    }
  }

  useEffect(() => {
    if (identity.signedIn) {
      void refresh();
    }
  }, [identity.dynamicUserId, identity.signedIn]);

  const total = allocations.reduce((sum, contract) => sum + Number(payloadOf(contract).amount ?? 0), 0);
  return (
    <main>
      <PageHeader eyebrow="Portfolio" title="Private testnet portfolio allocation" actions={<button onClick={refresh} disabled={state.busy}>Refresh</button>}>
        This page shows policy-directed testnet portfolio allocation records. It does not execute real securities trading.
      </PageHeader>
      <Notice state={state} />
      <div className="metric-grid">
        <Metric label="Total allocated" value={`${amount(total)} USDC`} />
        <Metric label="Models" value={new Set(allocations.map((item) => displayPortfolioModel(payloadOf(item).model))).size} />
      </div>
      <div className="card-list">
        {allocations.length ? (
          allocations.map((contract) => {
            const payload = payloadOf(contract);
            return (
              <article className="mini-card" key={contract.contractId}>
                <div>
                  <h3>{String(payload.label ?? payload.portfolioId ?? "Portfolio allocation")}</h3>
                  <p>{displayPortfolioModel(payload.model)}</p>
                </div>
                <strong>
                  {amount(payload.amount)} {String(payload.asset ?? "USDC")}
                </strong>
                <span className="code">{String(payload.sourceRunId ?? "")}</span>
                <StatusPill tone="ok">Private on Canton</StatusPill>
              </article>
            );
          })
        ) : (
          <div className="empty">Approve and execute a portfolio action to create an allocation record.</div>
        )}
      </div>
    </main>
  );
}

export function PrivacyDemoPage() {
  const identity = usePreoIdentity();
  const [state, run] = useAsyncState();
  const [role, setRole] = useState<PartyViewRole>("user");
  const [view, setView] = useState<PartyViewResponse | null>(null);

  async function load(nextRole = role) {
    const response = await run(() => getPartyView(identity.dynamicUserId, nextRole), "Party view loaded");
    if (response) {
      setView(response);
    }
  }

  useEffect(() => {
    if (identity.signedIn) {
      void load(role);
    }
  }, [identity.dynamicUserId, identity.signedIn]);

  const flattened = Object.entries(view?.visibleContracts ?? {}).flatMap(([template, contracts]) => contracts.map((contract) => ({ ...contract, templateId: template })));
  const visibility = roleVisibility[role];
  return (
    <main>
      <PageHeader eyebrow="Privacy Demo" title="Switch Canton party perspectives" actions={<button onClick={() => load()} disabled={state.busy}>Refresh</button>}>
        Canton lets Preo model salary as private multi-party state. Each party only sees contracts where they are a stakeholder.
      </PageHeader>
      <Notice state={state} />
      <section className="panel stack">
        <div className="segmented">
          {(["user", "employer", "recipient", "operator", "other-user"] as PartyViewRole[]).map((item) => (
            <button
              className={role === item ? "active" : "secondary"}
              key={item}
              onClick={() => {
                setRole(item);
                void load(item);
              }}
            >
              {item.replace("-", " ")}
            </button>
          ))}
        </div>
        <div className="facts">
          <span>Acting as</span>
          <strong>{view?.actingAs ?? role}</strong>
          <span>Canton party</span>
          <strong className="code">{view?.cantonPartyId ?? "Pending"}</strong>
        </div>
      </section>
      <div className="grid two">
        <section className="panel stack">
          <h2>What this party can see</h2>
          <ul className="plain-list">{visibility.canSee.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <section className="panel stack">
          <h2>What this party cannot see</h2>
          <ul className="plain-list">{visibility.cannotSee.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      </div>
      <section className="panel stack">
        <h2>Visible contracts</h2>
        <p className="muted">{view?.explanation}</p>
        <ContractTable contracts={flattened} empty={role === "other-user" ? "No visible Preo payroll contracts for this party." : "No contracts visible yet. Run the demo flow first."} />
      </section>
    </main>
  );
}

export function DemoPage() {
  const identity = usePreoIdentity();
  const saved = useSavedDemoState();
  const [state, run] = useAsyncState();
  const [amountValue, setAmountValue] = useState("2500.00");
  const [result, setResult] = useState<unknown>(null);

  async function bootstrapOnly() {
    const response = await run(
      () => bootstrapMe({ dynamicUserId: identity.dynamicUserId, primaryWalletAddress: identity.walletAddress, email: identity.email }),
      "Demo account bootstrapped"
    );
    if (response) {
      saved.setCantonPartyId(response.cantonPartyId);
      setResult(response);
    }
  }

  async function fullFlow() {
    const response = await run(() => runDemoFullFlow(identity.dynamicUserId, amountValue), "Full demo flow completed");
    if (response) {
      saved.setCantonPartyId(response.bootstrap.cantonPartyId);
      saved.setPolicyContractId(response.policyContractId);
      saved.setCreditContractId(response.cantonCreditContractId);
      setResult(response);
    }
  }

  async function reset() {
    const response = await run(() => resetDemo(identity.dynamicUserId), "Demo state reset");
    saved.clear();
    setResult(response);
  }

  return (
    <main>
      <PageHeader eyebrow="Demo Controls" title="Run the judge demo path" actions={<IdentityPanel identity={identity} />}>
        Use this page in demo mode to create a policy, send payroll, run allocation, approve the first pending action, and execute it.
      </PageHeader>
      <Notice state={state} />
      <section className="panel stack">
        <label className="field">
          <span>Demo payroll amount</span>
          <input value={amountValue} onChange={(event) => setAmountValue(event.target.value)} />
        </label>
        <div className="row wrap">
          <button onClick={bootstrapOnly} disabled={state.busy || !identity.signedIn}>
            Seed demo parties
          </button>
          <button className="secondary" onClick={fullFlow} disabled={state.busy || !identity.signedIn}>
            Execute full demo
          </button>
          <button className="danger-button" onClick={reset} disabled={state.busy || !identity.signedIn}>
            Reset demo
          </button>
        </div>
        <div className="facts">
          <span>Policy contract</span>
          <strong className="code">{saved.policyContractId || "none"}</strong>
          <span>Payroll credit</span>
          <strong className="code">{saved.creditContractId || "none"}</strong>
          <span>Canton party</span>
          <strong className="code">{saved.cantonPartyId || "none"}</strong>
        </div>
      </section>
      <section className="panel stack">
        <h2>Result</h2>
        {result ? <JsonBlock value={result} /> : <div className="empty">No demo command has run yet.</div>}
        <div className="row wrap">
          <Link className="button secondary" href="/dashboard">
            Open dashboard
          </Link>
          <Link className="button secondary" href="/approvals">
            Open approvals
          </Link>
          <Link className="button secondary" href="/privacy-demo">
            Open privacy demo
          </Link>
        </div>
      </section>
    </main>
  );
}

function slug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
