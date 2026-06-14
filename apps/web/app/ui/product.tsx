"use client";

import { DynamicAuthButton } from "./DynamicAuthButton";
import { BlinkDepositButton, useBlinkDeposit } from "@swype-org/deposit/react";
import Link from "next/link";
import nextDynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAppWallet } from "../wallet-context";
import {
  approveAction,
  bootstrapMe,
  createBlinkSession,
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
import { MotionConfig } from "motion/react";
import { AccordionRoot, AccordionItem, AccordionTrigger, AccordionContent } from "./primitives/accordion";
import { TabsRoot, TabsList, TabTrigger } from "./primitives/tabs";
import { Switch } from "./primitives/switch";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel, MenuSeparator } from "./primitives/dropdown-menu";
import { DialogRoot, DialogTrigger, DialogClose, DialogContent } from "./primitives/dialog";
import { TooltipProvider, Hint } from "./primitives/tooltip";
import { Select, SelectOption } from "./primitives/select";

const navItems = [
  { href: "/policy", label: "Policy" },
  { href: "/payroll", label: "Payroll" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/approvals", label: "Agent" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/privacy-demo", label: "Privacy" }
];

const exampleCategories: PolicyCategory[] = [
  { categoryId: "rent", label: "Rent", percentageBps: 3500, categoryType: "ExternalPayment", recipientParty: "preo-recipient", requiresApproval: false },
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

const LiveDynamicIdentityBridge = nextDynamic(
  () => import("./LiveDynamicIdentityBridge").then((mod) => mod.LiveDynamicIdentityBridge),
  { ssr: false }
);

type AsyncState = {
  busy: boolean;
  error: string;
  message: string;
};

const disconnectedIdentity: Identity = {
  dynamicConfigured: false,
  dynamicUserId: "demo-dynamic-user",
  signedIn: true
};
const IdentityContext = createContext<Identity>(disconnectedIdentity);
const IdentitySetterContext = createContext<(identity: Identity) => void>(() => {});

function usePreoIdentity(): Identity {
  return useContext(IdentityContext);
}

function PreoIdentityProvider({ children }: { children: React.ReactNode }) {
  const appWallet = useAppWallet();
  const [identity, setIdentity] = useState<Identity>(() => getIdentityForWalletMode(appWallet));
  return (
    <IdentityContext.Provider value={identity}>
      <IdentitySetterContext.Provider value={setIdentity}>
        <DynamicIdentityBridge />
        {children}
      </IdentitySetterContext.Provider>
    </IdentityContext.Provider>
  );
}

function getIdentityForWalletMode(appWallet: ReturnType<typeof useAppWallet>): Identity {
  if (appWallet.mode === "mock") {
    return {
      dynamicConfigured: false,
      dynamicUserId: appWallet.mockIdentity.dynamicUserId,
      walletAddress: appWallet.mockIdentity.walletAddress,
      email: appWallet.mockIdentity.email,
      signedIn: true
    };
  }

  if (appWallet.dynamicConfigured) {
    return {
      dynamicConfigured: true,
      dynamicUserId: "demo-dynamic-user",
      walletAddress: undefined,
      email: undefined,
      signedIn: false
    };
  }

  return disconnectedIdentity;
}

function DynamicIdentityBridge() {
  const appWallet = useAppWallet();

  if (appWallet.mode === "live") {
    return <LiveDynamicIdentityBridgeAdapter />;
  }

  return <StaticDynamicIdentityBridge appWallet={appWallet} />;
}

function LiveDynamicIdentityBridgeAdapter() {
  const setIdentity = useContext(IdentitySetterContext);

  return <LiveDynamicIdentityBridge onIdentity={setIdentity} />;
}

function StaticDynamicIdentityBridge({ appWallet }: { appWallet: ReturnType<typeof useAppWallet> }) {
  const setIdentity = useContext(IdentitySetterContext);

  useEffect(() => {
    setIdentity(getIdentityForWalletMode(appWallet));
  }, [appWallet, setIdentity]);

  return null;
}

function DynamicAuthWidget() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <StatusPill>Dynamic</StatusPill>;
  }
  return <DynamicAuthButton />;
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

function JsonBlock({ value, label = "Technical detail" }: { value: unknown; label?: string }) {
  return (
    <AccordionRoot type="single" collapsible className="disclosure">
      <AccordionItem value="detail">
        <AccordionTrigger>{label}</AccordionTrigger>
        <AccordionContent>
          <pre className="code compact">{JSON.stringify(value, null, 2)}</pre>
        </AccordionContent>
      </AccordionItem>
    </AccordionRoot>
  );
}

function BrandMark({ ariaLabel = "Preo home" }: { ariaLabel?: string }) {
  return (
    <Link href="/" className="brand-mark" aria-label={ariaLabel}>
      <span className="brand-text">
        <span>Preo</span>
      </span>
    </Link>
  );
}

const marketingNav = [
  { href: "#how", label: "How it works" },
  { href: "#privacy", label: "Privacy" },
  { href: "#built", label: "Infrastructure" }
];

function MarketingHeader() {
  return (
    <header className="app-shell marketing">
      <BrandMark />
      <nav className="marketing-nav">
        {marketingNav.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
      <div className="shell-actions">
        <Link className="button" href="/onboarding">
          Open app
        </Link>
      </div>
    </header>
  );
}

function AppHeader({ pathname }: { pathname: string; dynamicConfigured: boolean }) {
  return (
    <header className="app-shell">
      <BrandMark ariaLabel="Preo home" />
      <nav>
        {navItems.map((item) => (
          <Link key={item.href} className={pathname === item.href ? "active" : ""} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="shell-actions">
        {pathname === "/onboarding" ? null : (
          <Link className="button" href="/onboarding">
            Onboard
          </Link>
        )}
      </div>
    </header>
  );
}

function shortAddress(address?: string) {
  if (!address) {
    return null;
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function ProfileMenu({ identity, dynamicConfigured }: { identity: Identity; dynamicConfigured: boolean }) {
  const address = shortAddress(identity.walletAddress);
  const label = address ?? (identity.signedIn ? "Account" : "Connect");
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="profile-trigger" aria-label="Account menu">
          <span className="profile-avatar" aria-hidden>
            {identity.signedIn ? "P" : "·"}
          </span>
          <span>{label}</span>
        </button>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>Account</MenuLabel>
        <div className="menu-meta">
          <span>Status</span>
          <strong className={identity.signedIn ? "ok-text" : "muted"}>{identity.signedIn ? "Connected" : "Not connected"}</strong>
          <span>Wallet</span>
          <strong className="code">{identity.walletAddress ?? "—"}</strong>
        </div>
        <MenuSeparator />
        <MenuItem asChild>
          <Link href="/demo">Quickstart</Link>
        </MenuItem>
        <MenuItem asChild>
          <Link href="/onboarding">Account setup</Link>
        </MenuItem>
        {dynamicConfigured ? (
          <div className="menu-auth">
            <DynamicAuthWidget />
          </div>
        ) : null}
      </MenuContent>
    </Menu>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-brand">
            <BrandMark />
            <p>Receive stablecoin payroll and route it into private, user-defined categories, automatically.</p>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <Link href="/policy">Payroll policy</Link>
            <Link href="/payroll">Payroll</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/portfolio">Portfolio</Link>
          </div>
          <div className="footer-col">
            <h4>Privacy</h4>
            <Link href="/privacy-demo">Privacy</Link>
            <Link href="/approvals">Approvals</Link>
            <a href="/#how">How it works</a>
          </div>
          <div className="footer-col">
            <h4>Built with</h4>
            <span className="muted">Canton</span>
            <span className="muted">Dynamic</span>
            <span className="muted">Blink</span>
          </div>
        </div>
        <div className="footer-base">
          <span>© 2026 Preo · Private payroll neobank</span>
          <span className="footer-disclaimer">
            Preo is a prototype. It is not a bank, holds no real funds, and is not FDIC-insured.
          </span>
        </div>
      </div>
    </footer>
  );
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

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const appWallet = useAppWallet();
  const isMarketing = pathname === "/";
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        <PreoIdentityProvider>
          {isMarketing ? (
            <MarketingHeader />
          ) : (
            <AppHeader pathname={pathname} dynamicConfigured={appWallet.dynamicConfigured} />
          )}
          {children}
          {isMarketing ? <SiteFooter /> : null}
        </PreoIdentityProvider>
      </TooltipProvider>
    </MotionConfig>
  );
}

const HERO_SALARY = 2500;

const privacyProblems = [
  {
    title: "Your employer sees everything",
    body: "Traditional payroll routes through whoever signs your check. Your raises, your savings, the accounts your money touches: all visible upstream."
  },
  {
    title: "Your bank sees your strategy",
    body: "Move money to invest and a custodian logs it. Your allocation becomes someone else's data to mine, sell, or leak."
  },
  {
    title: "You trust a black box",
    body: "You're told your money is private. You can't verify it. Privacy becomes a line in a terms-of-service page instead of a property of the system."
  }
];

const privacyFeatures = [
  {
    title: "Salary is a private contract",
    body: "Each paycheck is a Canton contract only you and your agent can read. Your employer gets a receipt, never the breakdown.",
    chip: "Canton",
    id: "Private ledger"
  },
  {
    title: "You approve sensitive moves",
    body: "New recipients, large transfers, and investments pause for your signature before the agent acts on them.",
    chip: "Policy",
    id: "On-chain rules"
  },
  {
    title: "Verify without exposing",
    body: "Every party sees only the contracts they're a stakeholder in. Anyone can verify the system; no one can see your slice.",
    chip: "Proof",
    id: "Zero-leak"
  }
];

const howItWorks = [
  {
    title: "Onboard via Dynamic and Blink",
    body: "Sign in with Dynamic to create your identity, then activate your Blink payment rail to receive stablecoin payroll."
  },
  {
    title: "Get paid in stablecoins",
    body: "Your employer sends USDC payroll into your private Preo account. No intermediary sees the amount."
  },
  {
    title: "Set your split once",
    body: "Define categories (rent, savings, investing) as percentages that always add up to 100%."
  },
  {
    title: "The agent allocates each paycheck",
    body: "On every deposit it routes funds by your policy and pauses for approval before anything sensitive."
  },
  {
    title: "Balances stay private on Canton",
    body: "Employers, recipients, and other users each see only their slice. No one ever sees the whole."
  }
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useCountUp(target: number, run: boolean, durationMs: number, restartKey: number) {
  const [value, setValue] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!run) {
      setValue(0);
      return;
    }
    let startTs = 0;
    const tick = (now: number) => {
      if (!startTs) {
        startTs = now;
      }
      const t = Math.min(1, (now - startTs) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) {
        raf.current = requestAnimationFrame(tick);
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [run, target, durationMs, restartKey]);
  return value;
}

// ---- Simulated demo data (no live backend in the demo) ----

const SIM_CATEGORIES = [
  { id: "rent", label: "Rent", type: "External payment", balance: 875 },
  { id: "reserve", label: "Emergency Fund", type: "Internal reserve", balance: 625 },
  { id: "portfolio", label: "Portfolio", type: "Portfolio allocation", balance: 625 },
  { id: "spending", label: "Spending", type: "Manual hold", balance: 375 }
];

const SIM_RUNS = [
  { runId: "run-1042", amount: 2500, categories: 4, when: "2h ago", status: "Settled" },
  { runId: "run-1041", amount: 2500, categories: 4, when: "2 weeks ago", status: "Settled" },
  { runId: "run-1040", amount: 2500, categories: 4, when: "4 weeks ago", status: "Settled" }
];

const SIM_ACTIVITY: { area: string; label: string; detail: string; when: string; status: string; tone: "ok" | "neutral" | "warn" }[] = [
  { area: "Policy", label: "Policy saved", detail: "June payroll policy · 4 categories", when: "2h ago", status: "Saved", tone: "ok" },
  { area: "Agent", label: "Allocation run #1042", detail: "2,500 USDC split across 4 categories", when: "2h ago", status: "Settled", tone: "ok" },
  { area: "Portfolio", label: "Portfolio allocation", detail: "625 USDC → Global Equity Basket", when: "2h ago", status: "Allocated", tone: "neutral" },
  { area: "Privacy", label: "Privacy view", detail: "Employer perspective resolved to receipt-only", when: "1d ago", status: "Viewed", tone: "neutral" },
  { area: "Agent", label: "Approval cleared", detail: "Portfolio allocation approved by policy", when: "1d ago", status: "Approved", tone: "ok" }
];

const SIM_PORTFOLIO = [
  { id: "alloc-1", label: "Global Equity Basket", model: "Global Equity Basket", amount: 625, runId: "run-1042" },
  { id: "alloc-2", label: "Treasury Yield", model: "Treasury Yield", amount: 250, runId: "run-1041" },
  { id: "alloc-3", label: "USDC Savings", model: "USDC Savings", amount: 200, runId: "run-1040" }
];

const SIM_PARTY_VIEW: Record<PartyViewRole, { partyId: string; explanation: string; contracts: { template: string; contractId: string; detail: string }[] }> = {
  user: {
    partyId: "preo::user-7f3a9c",
    explanation: "You and your agent see the full private ledger — every credit, balance, and allocation.",
    contracts: [
      { template: "PayrollCredit", contractId: "00a1…7f3a", detail: "2,500.00 USDC salary credit" },
      { template: "CategoryBalance", contractId: "00b2…1c4d", detail: "Rent · 875.00 USDC" },
      { template: "CategoryBalance", contractId: "00b3…9e2f", detail: "Emergency Fund · 625.00 USDC" },
      { template: "PortfolioAllocation", contractId: "00c4…5a8b", detail: "625.00 USDC · Global Equity Basket" },
      { template: "AllocationRun", contractId: "00d5…3b7c", detail: "run-1042 · 4 categories" }
    ]
  },
  employer: {
    partyId: "acme-corp::payroll",
    explanation: "The employer sees only a payment receipt confirming payroll was delivered — never the breakdown.",
    contracts: [{ template: "EmployerPayrollNotice", contractId: "00e6…2f9a", detail: "Payroll delivered · 2,500.00 USDC" }]
  },
  recipient: {
    partyId: "landlord::rent-7c",
    explanation: "A recipient sees only the single payment addressed to them.",
    contracts: [{ template: "PaymentReceipt", contractId: "00f7…8d1e", detail: "Received 875.00 USDC" }]
  },
  operator: {
    partyId: "preo::operator",
    explanation: "The operator sees audit metadata only — no balances, amounts, or policy detail.",
    contracts: [{ template: "OperatorAuditEvent", contractId: "0108…4c6a", detail: "Allocation run executed · metadata only" }]
  },
  "other-user": {
    partyId: "preo::user-91c2e0",
    explanation: "A different Preo user sees nothing about this payroll. Privacy holds by construction.",
    contracts: []
  }
};

function ActivityFeed({ items }: { items: typeof SIM_ACTIVITY }) {
  return (
    <ul className="activity-feed">
      {items.map((item, index) => (
        <li className="activity-row" key={index}>
          <span className="activity-area">{item.area}</span>
          <div className="activity-main">
            <strong>{item.label}</strong>
            <span className="activity-detail">{item.detail}</span>
          </div>
          <span className="activity-when">{item.when}</span>
          <StatusPill tone={item.tone}>{item.status}</StatusPill>
        </li>
      ))}
    </ul>
  );
}

// ---- User flow (sticky scroll-telling) ----

const FLOW_STEPS = howItWorks;

export function UserFlowSection() {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const panelRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (reduced) {
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      return;
    }
    const nodes = panelRefs.current.filter(Boolean) as HTMLElement[];
    if (!nodes.length) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        let best: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          if (!best || entry.intersectionRatio > best.intersectionRatio) {
            best = entry;
          }
        }
        if (best) {
          const index = nodes.indexOf(best.target as HTMLElement);
          if (index !== -1) {
            setActive(index);
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [reduced]);

  const scrollTo = useCallback(
    (index: number) => {
      panelRefs.current[index]?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    },
    [reduced]
  );

  return (
    <section className={`userflow ${reduced ? "is-static" : ""}`} id="how" aria-label="How a paycheck flows through Preo">
      <div className="rows-head userflow-head">
        <h2>One policy. Every paycheck allocated, privately.</h2>
        <p>Set your split once. The agent allocates each paycheck, then every balance stays private on Canton.</p>
      </div>
      <div className="userflow-body">
        <aside className="userflow-rail">
          <ol className="userflow-steps">
            {FLOW_STEPS.map((step, index) => (
              <li key={step.title}>
                <button
                  type="button"
                  className={`userflow-step ${index === active ? "active" : ""}`}
                  onClick={() => scrollTo(index)}
                  aria-current={index === active ? "step" : undefined}
                >
                  <span className="userflow-tick" aria-hidden />
                  <span className="userflow-num">{String(index + 1).padStart(2, "0")}</span>
                  <span className="userflow-title">{step.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
        <div className="userflow-panels">
          {FLOW_STEPS.map((step, index) => (
            <article
              key={step.title}
              ref={(el) => {
                panelRefs.current[index] = el;
              }}
              className={`userflow-panel ${index === active ? "active" : ""}`}
            >
              <span className="userflow-panel-num">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="userflow-panel-title">{step.title}</h3>
              <p className="userflow-panel-body">{step.body}</p>
              <FlowVisual step={index} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FlowVisual({ step }: { step: number }) {
  if (step === 0) {
    return (
      <div className="ledger userflow-card">
        <div className="ledger-head">
          <div>
            <span className="ledger-label">Onboarding</span>
            <strong className="ledger-total">Ready</strong>
          </div>
          <StatusPill tone="ok">Connected</StatusPill>
        </div>
        <div className="ledger-rows">
          <div className="ledger-row">
            <span>Dynamic identity</span>
            <span className="num">Verified</span>
          </div>
          <div className="ledger-row">
            <span>Blink payment rail</span>
            <span className="num">Active</span>
          </div>
          <div className="ledger-row">
            <span>Wallet address</span>
            <span className="num">0x···4f2a</span>
          </div>
        </div>
      </div>
    );
  }
  if (step === 1) {
    return (
      <div className="ledger userflow-card">
        <div className="ledger-head">
          <div>
            <span className="ledger-label">Incoming salary</span>
            <strong className="ledger-total">
              {amount(HERO_SALARY)}
              <em>USDC</em>
            </strong>
          </div>
          <StatusPill tone="ok">Private</StatusPill>
        </div>
        <div className="ledger-foot">
          <span>Source</span>
          <span>Employer · USDC</span>
        </div>
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="ledger userflow-card">
        <div className="ledger-head">
          <div>
            <span className="ledger-label">Your split</span>
            <strong className="ledger-total">
              100<em>%</em>
            </strong>
          </div>
          <StatusPill>Set once</StatusPill>
        </div>
        <div className="ledger-rows">
          {exampleCategories.map((category) => (
            <div className="ledger-row" key={category.categoryId}>
              <span>{category.label}</span>
              <span className="num">{bps(category.percentageBps)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (step === 3) {
    return (
      <div className="ledger userflow-card">
        <div className="ledger-head">
          <div>
            <span className="ledger-label">Agent allocation</span>
            <strong className="ledger-total">
              {amount(HERO_SALARY)}
              <em>USDC</em>
            </strong>
          </div>
          <StatusPill tone="ok">Allocated</StatusPill>
        </div>
        <div className="ledger-rows">
          {exampleCategories.map((category) => (
            <div className="ledger-row" key={category.categoryId}>
              <span>{category.label}</span>
              <span className="num">{amount((HERO_SALARY * category.percentageBps) / 10000)} USDC</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="ledger userflow-card">
      <div className="ledger-head">
        <div>
          <span className="ledger-label">Visibility on Canton</span>
          <strong className="ledger-total">Private</strong>
        </div>
        <StatusPill tone="ok">Zero-leak</StatusPill>
      </div>
      <div className="ledger-rows">
        <div className="ledger-row">
          <span>You + your agent</span>
          <span className="num">Full ledger</span>
        </div>
        <div className="ledger-row">
          <span>Employer</span>
          <span className="num userflow-hidden">Receipt only</span>
        </div>
        <div className="ledger-row">
          <span>Landlord / recipient</span>
          <span className="num userflow-hidden">Their payment</span>
        </div>
        <div className="ledger-row">
          <span>Everyone else</span>
          <span className="num userflow-hidden">Nothing</span>
        </div>
      </div>
    </div>
  );
}

// ---- Agentic allocation (configurable, looping animated flow) ----

type AllocPhase = "arrive" | "think" | "split" | "distribute" | "done";
const ALLOC_PHASE_MS: Record<AllocPhase, number> = {
  arrive: 1200,
  think: 1300,
  split: 2500,
  distribute: 2500,
  done: 2500
};
const ALLOC_NEXT: Record<AllocPhase, AllocPhase> = {
  arrive: "think",
  think: "split",
  split: "distribute",
  distribute: "done",
  done: "arrive"
};

type CapKey = "rent" | "reserve" | "portfolio" | "spending";
type SubKind = "bill" | "limit" | "hold" | "invest";
type SubItem = { id: string; label: string; weight: number; kind: SubKind };
type Tier = { id: string; label: string; capKey: CapKey; subs: SubItem[] };

const SUB_STATUS: Record<SubKind, string> = {
  bill: "Paid",
  limit: "Spend up to",
  hold: "Reserved",
  invest: "Allocated"
};

const ALLOC_TIERS: Tier[] = [
  {
    id: "rent",
    label: "Rent",
    capKey: "rent",
    subs: [
      { id: "lease", label: "Lease · 1200 Market St", weight: 0.91, kind: "bill" },
      { id: "renters-insurance", label: "Renters insurance", weight: 0.09, kind: "bill" }
    ]
  },
  {
    id: "reserve",
    label: "Emergency Fund",
    capKey: "reserve",
    subs: [{ id: "safety-reserve", label: "3-month safety reserve", weight: 1, kind: "hold" }]
  },
  {
    id: "portfolio",
    label: "Portfolio",
    capKey: "portfolio",
    subs: [
      { id: "equity-basket", label: "Global Equity Basket", weight: 0.7, kind: "invest" },
      { id: "stablecoin-yield", label: "Stablecoin yield", weight: 0.3, kind: "invest" }
    ]
  },
  {
    id: "spending",
    label: "Spending",
    capKey: "spending",
    subs: [
      { id: "groceries", label: "Groceries", weight: 0.48, kind: "limit" },
      { id: "dining", label: "Dining", weight: 0.25, kind: "limit" },
      { id: "transit", label: "Transit", weight: 0.16, kind: "limit" },
      { id: "subscriptions", label: "Subscriptions", weight: 0.11, kind: "bill" }
    ]
  }
];

const DEFAULT_CAPS: Record<CapKey, number> = { rent: 875, reserve: 625, portfolio: 625, spending: 375 };

const CAP_FIELDS: { key: CapKey; label: string }[] = [
  { key: "rent", label: "Rent" },
  { key: "reserve", label: "Emergency Fund" },
  { key: "portfolio", label: "Portfolio" },
  { key: "spending", label: "Spending" }
];

export function AgenticAllocation() {
  const reduced = usePrefersReducedMotion();
  const [mode, setMode] = useState<"config" | "run">("config");
  const [caps, setCaps] = useState<Record<CapKey, number>>(DEFAULT_CAPS);
  const [capInputs, setCapInputs] = useState<Record<CapKey, string>>(() => ({
    rent: String(DEFAULT_CAPS.rent),
    reserve: String(DEFAULT_CAPS.reserve),
    portfolio: String(DEFAULT_CAPS.portfolio),
    spending: String(DEFAULT_CAPS.spending)
  }));
  const [phase, setPhase] = useState<AllocPhase>("arrive");
  const [loop, setLoop] = useState(0);

  const total = CAP_FIELDS.reduce((sum, field) => sum + (caps[field.key] || 0), 0);

  useEffect(() => {
    if (mode !== "run") {
      return;
    }
    if (reduced) {
      setPhase("done");
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    let current: AllocPhase = "arrive";
    setPhase(current);
    const advance = () => {
      timer = setTimeout(() => {
        const next = ALLOC_NEXT[current];
        if (next === "arrive") {
          setLoop((value) => value + 1);
        }
        current = next;
        setPhase(current);
        advance();
      }, ALLOC_PHASE_MS[current]);
    };
    advance();
    return () => clearTimeout(timer);
  }, [reduced, mode]);

  const updateCap = (key: CapKey, raw: string) => {
    setCapInputs((current) => ({ ...current, [key]: raw }));
    setCaps((current) => ({ ...current, [key]: Math.max(0, Number(raw || 0)) }));
  };

  const run = () => {
    setLoop((value) => value + 1);
    setPhase("arrive");
    setMode("run");
  };

  const splitting = phase === "split" || phase === "distribute" || phase === "done";
  const distributing = phase === "distribute" || phase === "done";

  return (
    <div
      className={`agentic phase-${phase} mode-${mode} ${reduced ? "is-static" : ""}`}
      aria-label="Agent accepting a paycheck and splitting it across categories and granular limits"
    >
      <div className="agentic-source agentic-node">
        {mode === "config" ? (
          <div className="agentic-config">
            <span className="agentic-node-label">Configure Paycheck Allocations</span>
            <div className="agentic-config-fields">
              {CAP_FIELDS.map((field) => (
                <label key={field.key} className="agentic-config-field">
                  <span>{field.label}</span>
                  <span className="agentic-config-input">
                    <input
                      value={capInputs[field.key]}
                      onChange={(event) => updateCap(field.key, event.target.value)}
                      inputMode="decimal"
                      aria-label={`${field.label} cap in USDC`}
                    />
                    <em>USDC</em>
                  </span>
                </label>
              ))}
            </div>
            <div className="agentic-config-total">
              <span className="agentic-node-label">Paycheck</span>
              <strong className="agentic-node-value num">{amount(total)} USDC</strong>
            </div>
            <button type="button" onClick={run} disabled={total <= 0}>
              Run
            </button>
          </div>
        ) : (
          <>
            <span className="agentic-node-label">Paycheck</span>
            <strong className="agentic-node-value num">{amount(total)} USDC</strong>
            <div className="agentic-source-state">
              <span className="agentic-pill ok arrive-only">{amount(total)} USDC arrived · Accepted</span>
              <span className="agentic-think think-only">
                <span className="agentic-spinner" aria-hidden />
                Agent analyzing your policy…
              </span>
              <span className="agentic-pill split-only">Splitting across categories…</span>
              <span className="agentic-pill distribute-only">Enforcing granular limits…</span>
              <span className="agentic-pill ok done-only">{amount(total)} USDC Allocated</span>
            </div>
            <button type="button" className="ghost agentic-edit" onClick={() => setMode("config")}>
              Edit caps
            </button>
          </>
        )}
      </div>
      <div className="agentic-flow">
        {ALLOC_TIERS.map((tier, index) => (
          <AllocBranch
            key={tier.id}
            tier={tier}
            cap={caps[tier.capKey]}
            reduced={reduced}
            splitActive={splitting}
            distributeActive={distributing}
            loop={loop}
            index={index}
          />
        ))}
      </div>
      {mode === "run" ? (
        <div className="agentic-status">
          {phase === "arrive" ? <span>Paycheck received</span> : null}
          {phase === "think" ? <span>Analyzing policy…</span> : null}
          {phase === "split" ? <span>Allocating across categories…</span> : null}
          {phase === "distribute" ? <span>Enforcing granular limits…</span> : null}
          {phase === "done" ? <span className="agentic-complete">Allocation complete</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function AllocBranch({
  tier,
  cap,
  reduced,
  splitActive,
  distributeActive,
  loop,
  index
}: {
  tier: Tier;
  cap: number;
  reduced: boolean;
  splitActive: boolean;
  distributeActive: boolean;
  loop: number;
  index: number;
}) {
  const counted = useCountUp(cap, splitActive && !reduced, 1900, loop);
  const value = reduced ? cap : counted;
  return (
    <div className={`agentic-branch branch-${index}`}>
      <span className="agentic-trunk" aria-hidden />
      <div className="agentic-node agentic-target">
        <span className="agentic-node-label">{tier.label}</span>
        <strong className="agentic-node-value num">{amount(value)} USDC</strong>
      </div>
      <span className="agentic-twigs" aria-hidden />
      <div className="agentic-subs">
        {tier.subs.map((sub) => (
          <AllocSub key={sub.id} sub={sub} target={cap * sub.weight} reduced={reduced} active={distributeActive} loop={loop} />
        ))}
      </div>
    </div>
  );
}

function AllocSub({
  sub,
  target,
  reduced,
  active,
  loop
}: {
  sub: SubItem;
  target: number;
  reduced: boolean;
  active: boolean;
  loop: number;
}) {
  const counted = useCountUp(target, active && !reduced, 1600, loop);
  const value = reduced ? target : counted;
  const shown = reduced || active;
  return (
    <div className="agentic-sub">
      <span className="agentic-sub-main">
        <span className="agentic-sub-label">{sub.label}</span>
        <strong className="agentic-sub-value num">{amount(value)} USDC</strong>
      </span>
      <span className={`agentic-sub-status kind-${sub.kind} ${shown ? "is-on" : ""}`}>
        {SUB_STATUS[sub.kind]}
      </span>
    </div>
  );
}

export function LandingPage() {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <span className="kicker">Privacy-first agentic neobank · On-chain · Automatic paycheck allocation</span>
          <h1>
            <span className="line">Your paycheck,</span>
            <span className="line">allocated automatically.</span>
            <span className="dim">No one sees how.</span>
          </h1>
          <p className="hero-lede">
            Preo is the privacy-first neobank that allocates your paycheck automatically. Receive stablecoin payroll
            and route it into private, user-defined categories. Your employer can&rsquo;t see your investments. Your
            landlord can&rsquo;t see your salary. Everyone else sees nothing.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/privacy-demo">
              See the privacy demo
            </Link>
            <Link className="button ghost" href="/policy">
              Build a payroll policy
            </Link>
          </div>
        </div>
        <div className="ledger" aria-label="Private payroll allocation preview">
          <div className="ledger-head">
            <div>
              <span className="ledger-label">Incoming salary</span>
              <strong className="ledger-total">
                {amount(HERO_SALARY)}
                <em>USDC</em>
              </strong>
            </div>
            <StatusPill tone="ok">Private</StatusPill>
          </div>
          <div className="ledger-rows">
            {exampleCategories.map((category) => (
              <div className="ledger-row" key={category.categoryId}>
                <span>{category.label}</span>
                <span className="num">{amount((HERO_SALARY * category.percentageBps) / 10000)} USDC</span>
              </div>
            ))}
          </div>
          <div className="ledger-foot">
            <span>Settlement</span>
            <span>Private on Canton</span>
          </div>
        </div>
      </section>

      <section className="rows-section" id="privacy">
        <div className="rows-head">
          <h2>
            Your salary is nobody&rsquo;s business.<span className="dim"> Not even ours.</span>
          </h2>
          <p>
            The traditional model puts a company between you and your money and asks you to trust it. Preo replaces trust
            with verification.
          </p>
        </div>
        <div className="num-rows">
          {privacyProblems.map((row, index) => (
            <div className="num-row" key={row.title}>
              <span className="num-idx">{String(index + 1).padStart(2, "0")}</span>
              <h3>{row.title}</h3>
              <p>{row.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rows-section" id="built">
        <div className="rows-head">
          <h2>Private by construction.</h2>
          <p>
            Preo models salary as private multi-party state on Canton. Privacy is a property of the system, not a setting
            you toggle.
          </p>
        </div>
        <div className="feature-cols">
          {privacyFeatures.map((feature) => (
            <div className="feature-col" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
              <span className="chip">
                {feature.chip}
                <span className="chip-id">{feature.id}</span> ↗
              </span>
            </div>
          ))}
        </div>
      </section>

      <UserFlowSection />
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
      <PageHeader eyebrow="Onboarding" title="Create your Preo account">
        Connect your wallet, then provision a private Canton party and agent wallet for your payroll.
      </PageHeader>
      <Notice state={state} />
      <div className="grid two">
        <section className="panel stack">
          <h2>Sign in</h2>
          {identity.dynamicConfigured ? <DynamicAuthWidget /> : <StatusPill tone="ok">Connected</StatusPill>}
          <div className="facts">
            <span>Account</span>
            <strong className="code">{shortAddress(identity.walletAddress) ?? "Preo account"}</strong>
            <span>Wallet</span>
            <strong className="code">{identity.walletAddress ?? "Not connected"}</strong>
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
      <PageHeader eyebrow="Policy Builder" title="Build a custom payroll policy">
        Start from a blank policy or use the example as a template. Percentages must add to exactly 100%.
      </PageHeader>
      <Notice state={state} />
      <section className="panel stack">
        <label className="field">
          <span>Policy name</span>
          <input value={policyName} onChange={(event) => setPolicyName(event.target.value)} placeholder="June payroll policy" />
        </label>
        <div className="toolbar">
          <span className={`alloc-indicator ${totalBps === 10000 ? "ok" : ""}`}>Allocated {bps(totalBps)} / 100%</span>
          <span className="spacer" />
          <button className="secondary" onClick={() => {
            setPolicyName("Sample payroll policy");
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
          <Switch label="Ask before new recipient" checked={approvalSettings.newRecipient} onCheckedChange={(value) => setApprovalSettings((current) => ({ ...current, newRecipient: value }))} />
          <Switch label="Ask before investments" checked={approvalSettings.investments} onCheckedChange={(value) => setApprovalSettings((current) => ({ ...current, investments: value }))} />
          <Switch label="Ask before transfer above amount" checked={approvalSettings.largeTransfer} onCheckedChange={(value) => setApprovalSettings((current) => ({ ...current, largeTransfer: value }))} />
          {approvalSettings.largeTransfer ? (
            <label className="field">
              <span>Custom threshold</span>
              <input value={approvalSettings.thresholdAmount} onChange={(event) => setApprovalSettings((current) => ({ ...current, thresholdAmount: event.target.value }))} />
            </label>
          ) : null}
          <Switch label="Ask before external withdrawal" checked={approvalSettings.externalWithdrawal} onCheckedChange={(value) => setApprovalSettings((current) => ({ ...current, externalWithdrawal: value }))} />
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
          <Select
            ariaLabel="Category type"
            value={category.categoryType}
            onValueChange={(value) => updateCategory(index, { categoryType: value as CategoryType })}
          >
            <SelectOption value="InternalReserve">Internal Reserve</SelectOption>
            <SelectOption value="ExternalPayment">External Payment</SelectOption>
            <SelectOption value="PortfolioAllocation">Portfolio Allocation</SelectOption>
            <SelectOption value="ManualHold">Manual Hold</SelectOption>
          </Select>
        </label>
        <button className="secondary" onClick={remove}>
          Remove
        </button>
      </div>
      {category.categoryType === "ExternalPayment" ? (
        <div className="row wrap">
          <label className="field grow">
            <span>Recipient Canton party</span>
            <input value={category.recipientParty ?? ""} onChange={(event) => updateCategory(index, { recipientParty: event.target.value })} placeholder="preo-recipient" />
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
            <Select
              ariaLabel="Portfolio model"
              value={portfolioKind}
              onValueChange={(value) => {
                updateCategory(index, { portfolioTarget: value === "Custom" ? { custom: "Custom model" } : (value as PortfolioModel) });
              }}
            >
              <SelectOption value="GlobalEquityBasket">Global Equity Basket</SelectOption>
              <SelectOption value="TreasuryYield">Treasury Yield</SelectOption>
              <SelectOption value="USDCSavings">USDC Savings</SelectOption>
              <SelectOption value="Custom">Custom</SelectOption>
            </Select>
          </label>
          {typeof category.portfolioTarget === "object" ? (
            <label className="field grow">
              <span>Custom model name</span>
              <input value={category.portfolioTarget.custom} onChange={(event) => updateCategory(index, { portfolioTarget: { custom: event.target.value } })} />
            </label>
          ) : null}
        </div>
      ) : null}
      <Switch label="Requires approval" checked={category.requiresApproval} onCheckedChange={(checked) => updateCategory(index, { requiresApproval: checked })} />
    </article>
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
  const {
    status: blinkStatus,
    result: blinkResult,
    error: blinkError,
    displayMessage: blinkDisplayMessage,
    requestDeposit
  } = useBlinkDeposit({
    signer: "/api/blink/sign-payment",
    environment: "sandbox"
  });
  const [amountValue, setAmountValue] = useState("2500.00");
  const [employerName, setEmployerName] = useState("Acme Corp");
  const [vaultTxHash, setVaultTxHash] = useState("");
  const [blinkRef, setBlinkRef] = useState("");
  const [blinkDetails, setBlinkDetails] = useState<unknown>(null);
  const [latest, setLatest] = useState<unknown>(null);
  const [payrollCelebration, setPayrollCelebration] = useState(false);
  const [flowResult, setFlowResult] = useState<Record<string, unknown> | null>(null);

  async function rememberCredit(result: Record<string, unknown> | undefined) {
    if (typeof result?.cantonCreditContractId === "string") {
      saved.setCreditContractId(result.cantonCreditContractId);
    }
    setLatest(result);
  }

  return (
    <main className="page-stack">
      <PageHeader eyebrow="Payroll" title="Get salary into Preo">
        Fund your account with Dynamic Flow, Blink, or a sample payroll deposit.
      </PageHeader>
      <Notice state={state} />
      <div className="grid three">
        <section className="panel stack">
          <h2>Dynamic Flow</h2>
          <p className="muted">Fund with Dynamic Flow when the environment is enabled, with a direct-deposit fallback.</p>
          <div className="facts compact-facts">
            <span>Status</span>
            <strong>{identity.dynamicConfigured ? "Flow ready" : "Direct deposit"}</strong>
          </div>
          <label className="field">
            <span>Amount</span>
            <input value={amountValue} onChange={(event) => setAmountValue(event.target.value)} />
          </label>
          <button
            onClick={() =>
              run(async () => {
                const result = await createFlowCheckout(identity.dynamicUserId, amountValue);
                setLatest(result);
                setFlowResult(result);
                const checkoutUrl =
                  typeof result.checkoutUrl === "string"
                    ? result.checkoutUrl
                    : typeof result.url === "string"
                      ? result.url
                      : null;
                // When Dynamic Flow is enabled the API returns a hosted checkout to open.
                if (result.nextAction === "start_dynamic_flow_checkout_in_client" && checkoutUrl) {
                  window.open(checkoutUrl, "_blank", "noopener,noreferrer");
                }
                return result;
              }, "Flow deposit started")
            }
            disabled={state.busy || !identity.signedIn}
          >
            Start Flow deposit
          </button>
          <DialogRoot open={flowResult !== null} onOpenChange={(open) => !open && setFlowResult(null)}>
            <DialogContent
              title={
                flowResult?.nextAction === "start_dynamic_flow_checkout_in_client"
                  ? "Flow checkout ready"
                  : "Flow unavailable — use direct deposit"
              }
              description={
                flowResult?.nextAction === "start_dynamic_flow_checkout_in_client"
                  ? "Dynamic Flow checkout was created. Complete the deposit in the checkout window."
                  : `Dynamic Flow isn't enabled for this environment${
                      typeof flowResult?.reason === "string" ? ` (${flowResult.reason})` : ""
                    }, so no checkout window opened. Use the Blink deposit or sample payroll instead.`
              }
            >
              <div className="facts compact-facts">
                <span>Status</span>
                <strong>{String(flowResult?.status ?? "unknown")}</strong>
                <span>Next step</span>
                <strong>{String(flowResult?.nextAction ?? "—")}</strong>
              </div>
              <JsonBlock value={flowResult} />
            </DialogContent>
          </DialogRoot>
        </section>
        <section className="panel stack">
          <h2>Blink Deposit</h2>
          <p className="muted">Blink funds your account in one tap through the server-side signer path.</p>
          <div className="facts compact-facts">
            <span>Signer</span>
            <strong>/api/blink/sign-payment</strong>
            <span>Ref</span>
            <strong className="code">{blinkRef || "Pending"}</strong>
            <span>Status</span>
            <strong>{blinkStatus}</strong>
          </div>
          <BlinkDepositButton
            onClick={() =>
              void run(async () => {
                const amount = Number(amountValue);
                if (!Number.isFinite(amount) || amount <= 0) {
                  throw new Error("Blink amount must be a positive number");
                }
                const session = await createBlinkSession(identity.dynamicUserId, amountValue);
                const externalRef = String(session.externalRef ?? "");
                setBlinkRef(externalRef);
                let result: unknown = null;
                let blinkDepositError: string | null = null;
                try {
                  result = await requestDeposit({
                    amount,
                    chainId: Number(session.chainId),
                    address: String(session.destinationAddress),
                    token: String(session.tokenAddress),
                    reference: externalRef || undefined,
                    metadata: {
                      fundingIntentId: String(session.fundingIntentId ?? ""),
                      preoUserIdHash: String(session.preoUserIdHash ?? ""),
                      externalRefBytes32: String(session.externalRefBytes32 ?? "")
                    }
                  });
                } catch (error) {
                  blinkDepositError = error instanceof Error ? error.message : String(error);
                }
                const details = { session, blinkResult: result, blinkDepositError };
                setBlinkDetails(details);
                setLatest(details);
                return details;
              }, "Blink deposit completed")
            }
            disabled={state.busy || !identity.signedIn}
            loading={blinkStatus === "signer-loading"}
          />
          {blinkError ? <p className="notice danger">{blinkDisplayMessage}</p> : null}
          {blinkResult ? <p className="notice ok">Blink transfer {blinkResult.transfer.id} completed.</p> : null}
          {blinkDetails ? <JsonBlock value={blinkDetails} /> : null}
        </section>
        <section className="panel stack">
          <h2>Sample Payroll</h2>
          <p className="muted">Simulate an employer payroll deposit so you can preview how salary lands privately in Preo.</p>
          <div className="facts compact-facts">
            <span>Status</span>
            <strong>Demo payroll</strong>
          </div>
          <label className="field">
            <span>Employer name</span>
            <input value={employerName} onChange={(event) => setEmployerName(event.target.value)} />
          </label>
          <button onClick={() => setPayrollCelebration(true)} disabled={!identity.signedIn}>
            Receive payroll
          </button>
          <DialogRoot open={payrollCelebration} onOpenChange={setPayrollCelebration}>
            <DialogContent
              title="Payroll received"
              description={
                <>
                  Congratulations!
                  <br />
                  {`Your payroll from ${employerName} was deposited to Preo.`}
                </>
              }
            >
              <div className="facts compact-facts">
                <span>Amount</span>
                <strong>{amount(Number(amountValue))} USDC</strong>
                <span>Employer</span>
                <strong>{employerName}</strong>
                <span>Status</span>
                <strong>Deposited to Preo</strong>
              </div>
              <div className="dialog-actions">
                <DialogClose asChild>
                  <button>Done</button>
                </DialogClose>
              </div>
            </DialogContent>
          </DialogRoot>
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
  return (
    <main>
      <PageHeader eyebrow="Dashboard" title="Private salary command center">
        Review private Canton balances, active policy allocation runs, and recent agent activity.
      </PageHeader>
      <div className="metric-grid">
        <Metric label="Private salary credits" value={6} />
        <Metric label="Private categories" value={SIM_CATEGORIES.length} />
        <Metric label="Allocation runs" value={SIM_RUNS.length} />
        <Metric label="Portfolio allocations" value={SIM_PORTFOLIO.length} />
      </div>
      <div className="grid two dashboard-row">
        <section className="panel stack">
          <h2>Private Categories</h2>
          <div className="card-list">
            {SIM_CATEGORIES.map((category) => (
              <article className="mini-card" key={category.id}>
                <div>
                  <h3>{category.label}</h3>
                  <p>{category.type}</p>
                </div>
                <strong>{amount(category.balance)} USDC</strong>
                <StatusPill tone="ok">Private on Canton</StatusPill>
              </article>
            ))}
          </div>
        </section>
        <section className="panel stack">
          <h2>Active Policy Allocation Runs</h2>
          <div className="table-wrap compact">
            <table>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Amount</th>
                  <th className="col-center">Categories</th>
                  <th>When</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {SIM_RUNS.map((runItem) => (
                  <tr key={runItem.runId}>
                    <td className="code">{runItem.runId}</td>
                    <td className="num">{amount(runItem.amount)} USDC</td>
                    <td className="col-center">{runItem.categories}</td>
                    <td>{runItem.when}</td>
                    <td>
                      <StatusPill tone="ok">{runItem.status}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <section className="panel stack">
        <h2>Activity log</h2>
        <ActivityFeed items={SIM_ACTIVITY} />
      </section>
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
  return (
    <main>
      <PageHeader eyebrow="Agent" title="Agentic allocation">
        Watch the agent accept a paycheck and split it across your private categories — automatically, by the policy you set.
      </PageHeader>
      <AgenticAllocation />
      <div className="grid three agentic-explainers">
        <section className="panel stack">
          <h3>1 · Accept</h3>
          <p className="muted">A new paycheck lands as a private Canton credit. You accept it once — the agent takes it from there.</p>
        </section>
        <section className="panel stack">
          <h3>2 · Allocate</h3>
          <p className="muted">The agent reads your policy and routes each share to its category: rent, reserve, portfolio, spending.</p>
        </section>
        <section className="panel stack">
          <h3>3 · Approve only what matters</h3>
          <p className="muted">Sensitive moves — new recipients, investments — pause for your signature. Everything else just flows.</p>
        </section>
      </div>
    </main>
  );
}

export function PortfolioPage() {
  const total = SIM_PORTFOLIO.reduce((sum, item) => sum + item.amount, 0);
  return (
    <main>
      <PageHeader eyebrow="Portfolio" title="Private portfolio allocation">
        Policy-directed portfolio allocation records, tracked privately on Canton.
      </PageHeader>
      <div className="metric-grid">
        <Metric label="Total allocated" value={`${amount(total)} USDC`} />
        <Metric label="Models" value={new Set(SIM_PORTFOLIO.map((item) => item.model)).size} />
      </div>
      <div className="card-list">
        {SIM_PORTFOLIO.map((item) => (
          <article className="mini-card portfolio-card" key={item.id}>
            <div>
              <h3>{item.label}</h3>
              <p>{item.model}</p>
            </div>
            <span className="code">Run {item.runId.replace(/^run-/, "")}</span>
            <strong>{amount(item.amount)} USDC</strong>
            <StatusPill tone="ok">Private on Canton</StatusPill>
          </article>
        ))}
      </div>
    </main>
  );
}

export function PrivacyDemoPage() {
  const [role, setRole] = useState<PartyViewRole>("user");
  const sim = SIM_PARTY_VIEW[role];
  const visibility = roleVisibility[role];
  return (
    <main className="page-stack">
      <PageHeader eyebrow="Privacy" title="Switch Canton party perspectives">
        Canton lets Preo model salary as private multi-party state. Each party only sees contracts where they are a stakeholder.
      </PageHeader>
      <section className="panel stack">
        <TabsRoot value={role} onValueChange={(value) => setRole(value as PartyViewRole)}>
          <TabsList>
            {(["user", "employer", "recipient", "operator", "other-user"] as PartyViewRole[]).map((item) => (
              <TabTrigger key={item} value={item} active={role === item}>
                {item.replace("-", " ")}
              </TabTrigger>
            ))}
          </TabsList>
        </TabsRoot>
        <div className="facts">
          <span>Acting as</span>
          <strong>{role.replace("-", " ")}</strong>
          <span>Canton party</span>
          <strong className="code">{sim.partyId}</strong>
        </div>
      </section>
      <div className="grid two">
        <section className="panel stack">
          <h2>What this party can see</h2>
          <ul className="plain-list">{visibility.canSee.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <section className="panel stack">
          <h2>What this party cannot see</h2>
          <ul className="plain-list cannot">{visibility.cannotSee.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      </div>
      <section className="panel stack">
        <h2>Visible contracts</h2>
        <p className="muted">{sim.explanation}</p>
        {sim.contracts.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Contract</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {sim.contracts.map((contract) => (
                  <tr key={contract.contractId}>
                    <td>{contract.template}</td>
                    <td className="code">{contract.contractId}</td>
                    <td>{contract.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">No visible Preo payroll contracts for this party.</div>
        )}
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
      "Sample account ready"
    );
    if (response) {
      saved.setCantonPartyId(response.cantonPartyId);
      setResult(response);
    }
  }

  async function fullFlow() {
    const response = await run(() => runDemoFullFlow(identity.dynamicUserId, amountValue), "Sample flow completed");
    if (response) {
      saved.setCantonPartyId(response.bootstrap.cantonPartyId);
      saved.setPolicyContractId(response.policyContractId);
      saved.setCreditContractId(response.cantonCreditContractId);
      setResult(response);
    }
  }

  async function reset() {
    const response = await run(() => resetDemo(identity.dynamicUserId), "Account reset");
    saved.clear();
    setResult(response);
  }

  return (
    <main>
      <PageHeader eyebrow="Quickstart" title="Run a sample payroll flow">
        Create a policy, send payroll, run allocation, approve the first pending action, and execute it — in one click.
      </PageHeader>
      <Notice state={state} />
      <section className="panel stack">
        <label className="field">
          <span>Payroll amount</span>
          <input value={amountValue} onChange={(event) => setAmountValue(event.target.value)} />
        </label>
        <div className="row wrap">
          <button onClick={bootstrapOnly} disabled={state.busy || !identity.signedIn}>
            Seed sample account
          </button>
          <button className="secondary" onClick={fullFlow} disabled={state.busy || !identity.signedIn}>
            Run sample flow
          </button>
          <button className="danger-button" onClick={reset} disabled={state.busy || !identity.signedIn}>
            Reset account
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
        {result ? <JsonBlock value={result} /> : <div className="empty">Nothing has run yet.</div>}
        <div className="row wrap">
          <Link className="button secondary" href="/dashboard">
            Open dashboard
          </Link>
          <Link className="button secondary" href="/approvals">
            Open approvals
          </Link>
          <Link className="button secondary" href="/privacy-demo">
            Open privacy view
          </Link>
        </div>
      </section>
    </main>
  );
}

function slug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
