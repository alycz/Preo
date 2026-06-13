import type {
  AllocationRunRequest,
  ApprovalRule,
  BootstrapRequest,
  BootstrapResponse,
  CategoryType,
  ExecuteApprovedActionRequest,
  PartyViewRole,
  PolicyCategory,
  PolicyInput,
  PortfolioModel
} from "@preo/shared";

export type ContractSnapshot<T = Record<string, unknown>> = {
  contractId: string;
  templateId: string;
  payload: T;
};

export type ApiValidationResult = {
  valid: boolean;
  errors: Array<{ code: string; message: string; categoryId?: string; path: string }>;
  warnings: Array<{ code: string; message: string; path: string }>;
};

export type PolicyResponse = {
  policyContractId: string | null;
  version: number | null;
  active: boolean;
  policy: Record<string, unknown> | null;
  cache?: Record<string, unknown> | null;
};

export type DashboardResponse = {
  actingAs: string;
  activePolicy: ContractSnapshot | null;
  payrollCredits: ContractSnapshot[];
  allocationRuns: ContractSnapshot[];
  categoryBalances: ContractSnapshot[];
  pendingApprovals: ContractSnapshot[];
  payments: ContractSnapshot[];
  portfolioAllocations: ContractSnapshot[];
};

export type ApprovalsResponse = {
  approvals: ContractSnapshot[];
};

export type PartyViewResponse = {
  role: PartyViewRole;
  actingAs: string;
  cantonPartyId: string;
  visibleContracts: Record<string, ContractSnapshot[]>;
  explanation: string;
};

export type DemoFullFlowResponse = {
  bootstrap: BootstrapResponse;
  policyContractId: string;
  cantonCreditContractId: string;
  allocationRunContractId: string;
  approvedActionContractId: string | null;
  executedAction?: Record<string, unknown> | null;
  nextPath: string;
};

type JsonBody = Record<string, unknown> | Array<unknown>;

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const json = (await response.json().catch(() => ({}))) as T & { error?: string; code?: string; details?: unknown };
  if (!response.ok) {
    const label = json.code ? `${json.code}: ${json.error}` : json.error ?? `Request failed: ${response.status}`;
    throw new Error(label);
  }
  return json;
}

function post<T>(path: string, body: JsonBody): Promise<T> {
  return jsonRequest<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function query(dynamicUserId: string) {
  return `?dynamicUserId=${encodeURIComponent(dynamicUserId)}`;
}

export function bootstrapMe(input: BootstrapRequest) {
  return post<BootstrapResponse>("/api/me/bootstrap", input);
}

export function getPolicy(dynamicUserId: string) {
  return jsonRequest<PolicyResponse>(`/api/policy${query(dynamicUserId)}`);
}

export function savePolicy(dynamicUserId: string, policy: PolicyInput) {
  return post<PolicyResponse>("/api/policy", { dynamicUserId, ...policy });
}

export function validatePolicy(policy: PolicyInput) {
  return post<ApiValidationResult>("/api/policy/validate", policy);
}

export function createFlowCheckout(dynamicUserId: string, amount: string) {
  return post<Record<string, unknown>>("/api/funding/flow/checkout", {
    dynamicUserId,
    amount,
    currency: "USD",
    purpose: "payroll_deposit"
  });
}

export function createBlinkSession(dynamicUserId: string, amount: string) {
  return post<Record<string, unknown>>("/api/funding/blink/session", { dynamicUserId, amount });
}

export function signBlinkPayment(input: Record<string, unknown>) {
  return post<Record<string, unknown>>("/api/blink/sign-payment", input);
}

export function sendDemoPayroll(dynamicUserId: string, amount: string, employerName?: string) {
  return post<Record<string, unknown>>("/api/demo/employer/send-payroll", {
    dynamicUserId,
    amount,
    asset: "USDC",
    payrollRef: employerName ? `${employerName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}` : undefined
  });
}

export function createDirectDeposit(dynamicUserId: string, amount: string) {
  return post<Record<string, unknown>>("/api/funding/direct-deposit", {
    dynamicUserId,
    amount,
    asset: "USDC",
    sourceRef: `direct-demo-${Date.now()}`
  });
}

export function verifyVaultDeposit(dynamicUserId: string, txHash: string, amount: string, sourceRef?: string) {
  return post<Record<string, unknown>>("/api/funding/evm/verify-deposit", {
    dynamicUserId,
    txHash,
    demoAmount: amount,
    sourceRef
  });
}

export function runAllocation(input: AllocationRunRequest) {
  return post<Record<string, unknown>>("/api/allocation/run", input);
}

export function getDashboard(dynamicUserId: string) {
  return jsonRequest<DashboardResponse>(`/api/dashboard${query(dynamicUserId)}`);
}

export function getApprovals(dynamicUserId: string) {
  return jsonRequest<ApprovalsResponse>(`/api/approvals${query(dynamicUserId)}`);
}

export function approveAction(dynamicUserId: string, contractId: string) {
  return post<Record<string, unknown>>(`/api/approvals/${encodeURIComponent(contractId)}/approve`, { dynamicUserId });
}

export function rejectAction(dynamicUserId: string, contractId: string) {
  return post<Record<string, unknown>>(`/api/approvals/${encodeURIComponent(contractId)}/reject`, { dynamicUserId });
}

export function executeApprovedAction(input: ExecuteApprovedActionRequest) {
  return post<Record<string, unknown>>("/api/agent/execute-approved-action", input);
}

export function getPortfolio(dynamicUserId: string) {
  return jsonRequest<{ portfolioAllocations: ContractSnapshot[] }>(`/api/portfolio${query(dynamicUserId)}`);
}

export function getPartyView(dynamicUserId: string, role: PartyViewRole) {
  return jsonRequest<PartyViewResponse>(`/api/views/${role}${query(dynamicUserId)}`);
}

export function getAgentActions(dynamicUserId: string) {
  return jsonRequest<{ actions: Record<string, unknown>[] }>(`/api/agent/actions${query(dynamicUserId)}`);
}

export function runDemoFullFlow(dynamicUserId: string, amount: string) {
  return post<DemoFullFlowResponse>("/api/demo/full-flow", { dynamicUserId, amount });
}

export function resetDemo(dynamicUserId: string) {
  return post<Record<string, unknown>>("/api/demo/reset", { dynamicUserId });
}

export type { ApprovalRule, CategoryType, PolicyCategory, PolicyInput, PortfolioModel };
