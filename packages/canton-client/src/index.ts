export type CantonJsonApiVersion = "v1" | "v2";

export type CantonClientConfig = {
  baseUrl?: string;
  authToken?: string;
  packageId?: string;
  apiVersion?: CantonJsonApiVersion;
  demoMode?: boolean;
};

export type CantonContract<T = Record<string, unknown>> = {
  contractId: string;
  templateId: string;
  payload: T;
};

export type CreatePayrollCreditInput = {
  user: string;
  amount: string;
  asset: string;
  sourceRef: string;
  flowTransactionId?: string;
  evmTxHash?: string;
};

export type ExecutePendingActionInput = {
  user: string;
  pendingActionContractId: string;
  runId: string;
  evmTxHash?: string;
};

export type PendingActionSnapshot = CantonContract<{
  user: string;
  actionId: string;
  actionType: string;
  categoryId: string;
  label: string;
  status: "Pending" | "Approved" | "Rejected" | "Executed";
  amount: string;
  asset: string;
  recipient?: string | null;
  externalAddress?: string | null;
  portfolioTarget?: string | null;
  reason?: string;
  createdAt?: string;
}>;

export type PolicyCategoryInput = {
  categoryId: string;
  label: string;
  percentageBps: number;
  categoryType: "InternalReserve" | "ExternalPayment" | "PortfolioAllocation" | "ManualHold";
  recipientParty?: string;
  externalAddress?: string;
  portfolioTarget?: "GlobalEquityBasket" | "TreasuryYield" | "USDCSavings" | string;
  requiresApproval: boolean;
};

export type PayrollPolicyPayload = {
  user: string;
  policyName: string;
  categories: PolicyCategoryInput[];
  approvalRules: unknown[];
  version: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AllocationRunResult = {
  run: CantonContract;
  lines: Array<Record<string, unknown>>;
  balances: CantonContract[];
  pendingActions: PendingActionSnapshot[];
  payments: CantonContract[];
  portfolioAllocations: CantonContract[];
};

const PREO_MODULES = {
  userProfile: "Preo.User:UserProfile",
  payrollPolicy: "Preo.Policy:PayrollPolicy",
  employerPayrollNotice: "Preo.Payroll:EmployerPayrollNotice",
  payrollCredit: "Preo.Payroll:PayrollCredit",
  allocationRun: "Preo.Allocation:AllocationRun",
  categoryBalance: "Preo.Allocation:CategoryBalance",
  pendingAction: "Preo.Allocation:PendingAction",
  paymentReceipt: "Preo.Payment:PaymentReceipt",
  portfolioAllocation: "Preo.Portfolio:PortfolioAllocation",
  operatorAuditEvent: "Preo.Audit:OperatorAuditEvent"
} as const;

const CHOICES = {
  approve: "Approve",
  reject: "Reject",
  executeApprovedAction: "ExecuteApprovedAction",
  executeAllocation: "ExecuteAllocation",
  markAllocated: "MarkAllocated"
} as const;

type StoredContract = CantonContract & {
  archived: boolean;
  createdAt: string;
};

type DemoState = {
  counter: number;
  contracts: Map<string, StoredContract>;
  parties: Map<string, string>;
};

const globalForDemo = globalThis as unknown as { preoCantonDemoState?: DemoState };

function demoState(): DemoState {
  globalForDemo.preoCantonDemoState ??= {
    counter: 0,
    contracts: new Map(),
    parties: new Map()
  };
  return globalForDemo.preoCantonDemoState;
}

function nowIso() {
  return new Date().toISOString();
}

function decimal(value: string | number) {
  const stringValue = String(value);
  return stringValue.includes(".") ? stringValue : `${stringValue}.0`;
}

function maybe(value: unknown) {
  return value === undefined || value === null || value === "" ? { tag: "None" } : { tag: "Some", value };
}

function fromMaybeText(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as { tag?: string; value?: unknown };
  return record.tag === "Some" ? String(record.value) : undefined;
}

function amountNumber(value: unknown) {
  return Number(String(value ?? "0"));
}

function formatAmount(value: number) {
  return Number.isInteger(value) ? `${value}.0` : value.toFixed(6).replace(/0+$/, "").replace(/\.$/, ".0");
}

function nestedRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function templateName(templateId: string) {
  const parts = templateId.split(":");
  return parts.length > 2 ? parts.slice(1).join(":") : templateId;
}

function visibleTo(contract: StoredContract, party: string) {
  const payload = contract.payload as Record<string, unknown>;
  switch (templateName(contract.templateId)) {
    case PREO_MODULES.employerPayrollNotice:
      return payload.employer === party || payload.employee === party;
    case PREO_MODULES.paymentReceipt:
      return payload.payer === party || payload.recipient === party;
    case PREO_MODULES.operatorAuditEvent:
      return payload.operator === party || fromMaybeText(payload.user) === party || payload.user === party;
    default:
      return payload.user === party;
  }
}

function categoryActionType(categoryType: string) {
  if (categoryType === "ExternalPayment") {
    return "ActionExternalPayment";
  }
  if (categoryType === "PortfolioAllocation") {
    return "ActionPortfolioAllocation";
  }
  if (categoryType === "ManualHold") {
    return "ActionExternalWithdrawal";
  }
  return "ActionLargeTransfer";
}

function categoryRecipient(category: Record<string, unknown>) {
  return String(category.recipientParty ?? fromMaybeText(category.recipient) ?? "");
}

export class CantonClient {
  private readonly config: Required<Pick<CantonClientConfig, "apiVersion" | "demoMode">> & CantonClientConfig;

  constructor(config: CantonClientConfig = {}) {
    this.config = {
      apiVersion: config.apiVersion ?? "v2",
      demoMode: config.demoMode ?? !config.baseUrl,
      ...config
    };
  }

  get isLive() {
    return Boolean(this.config.baseUrl) && !this.config.demoMode;
  }

  async allocateParty(identifierHint: string, displayName = identifierHint): Promise<string> {
    if (!this.isLive) {
      demoState().parties.set(identifierHint, displayName);
      return identifierHint;
    }

    if (this.config.apiVersion === "v1") {
      const response = await this.post("/v1/parties/allocate", { identifierHint, displayName });
      return String(response.identifier ?? response.party ?? response.partyId ?? identifierHint);
    }

    const response = await this.post("/v2/parties", { partyIdHint: identifierHint, displayName });
    return String(response.party ?? response.partyId ?? identifierHint);
  }

  async create<T extends Record<string, unknown>>(templateId: string, payload: T, actAs: string): Promise<CantonContract<T>> {
    const fullTemplateId = this.templateId(templateId);
    if (!this.isLive) {
      return this.demoCreate(fullTemplateId, payload);
    }

    const response = await this.command("create", { templateId: fullTemplateId, payload }, actAs);
    return {
      contractId: String(response.contractId ?? nestedRecord(response.exerciseResult).contractId ?? nestedRecord(response.result).contractId),
      templateId: fullTemplateId,
      payload
    };
  }

  async exercise<T = unknown>(templateId: string, contractId: string, choice: string, argument: Record<string, unknown>, actAs: string): Promise<T> {
    const fullTemplateId = this.templateId(templateId);
    if (!this.isLive) {
      return this.demoExercise(fullTemplateId, contractId, choice, argument, actAs) as T;
    }

    const response = await this.command(
      "exercise",
      {
        templateId: fullTemplateId,
        contractId,
        choice,
        argument
      },
      actAs
    );
    return (response.exerciseResult ?? response.result ?? response) as T;
  }

  async query<T = Record<string, unknown>>(templateId: string, query: Record<string, unknown>, readAs: string): Promise<Array<CantonContract<T>>> {
    const fullTemplateId = this.templateId(templateId);
    if (!this.isLive) {
      const contracts = Array.from(demoState().contracts.values()).filter((contract) => {
        if (contract.archived || contract.templateId !== fullTemplateId || !visibleTo(contract, readAs)) {
          return false;
        }
        return Object.entries(query).every(([key, value]) => (contract.payload as Record<string, unknown>)[key] === value);
      });
      return contracts.map(({ contractId, templateId: id, payload }) => ({ contractId, templateId: id, payload: payload as T }));
    }

    if (this.config.apiVersion === "v1") {
      const response = await this.post("/v1/query", { templateIds: [fullTemplateId], query, parties: [readAs] });
      const result = Array.isArray(response.result) ? response.result : [];
      return result.map((contract) => this.normalizeContract<T>(contract, fullTemplateId));
    }

    const response = await this.post("/v2/state/active-contracts", { templateIds: [fullTemplateId], query, requestingParties: [readAs] });
    const result = Array.isArray(response.contracts) ? response.contracts : Array.isArray(response.result) ? response.result : [];
    return result.map((contract) => this.normalizeContract<T>(contract, fullTemplateId));
  }

  async fetchById<T = Record<string, unknown>>(templateId: string, contractId: string, readAs: string): Promise<CantonContract<T> | null> {
    const fullTemplateId = this.templateId(templateId);
    if (!this.isLive) {
      const contract = demoState().contracts.get(contractId);
      if (!contract || contract.archived || contract.templateId !== fullTemplateId || !visibleTo(contract, readAs)) {
        return null;
      }
      return { contractId, templateId: fullTemplateId, payload: contract.payload as T };
    }

    const response =
      this.config.apiVersion === "v1"
        ? await this.post("/v1/fetch", { templateId: fullTemplateId, contractId, parties: [readAs] })
        : await this.post("/v2/state/active-contract", { contractId, requestingParties: [readAs] });
    if (!response || response.status === 404 || response.result === null) {
      return null;
    }
    return this.normalizeContract<T>(response.result ?? response, fullTemplateId);
  }

  async createUserProfile(user: string, displayName: string) {
    return this.create(PREO_MODULES.userProfile, { user, displayName, createdAt: nowIso(), active: true }, user);
  }

  async createPayrollPolicy(user: string, input: { policyName: string; categories: PolicyCategoryInput[]; approvalRules?: unknown[]; version?: number }) {
    const timestamp = nowIso();
    return this.create<PayrollPolicyPayload>(
      PREO_MODULES.payrollPolicy,
      {
        user,
        policyName: input.policyName,
        categories: input.categories,
        approvalRules: input.approvalRules ?? [],
        version: input.version ?? 1,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      user
    );
  }

  async getActivePayrollPolicy(user: string, policyContractId?: string) {
    if (policyContractId) {
      return this.fetchById<PayrollPolicyPayload>(PREO_MODULES.payrollPolicy, policyContractId, user);
    }
    const policies = await this.query<PayrollPolicyPayload>(PREO_MODULES.payrollPolicy, { user, active: true }, user);
    return policies.sort((left, right) => Number(right.payload.version) - Number(left.payload.version))[0] ?? null;
  }

  async createPayrollCredit(input: CreatePayrollCreditInput): Promise<{ contractId: string; live: boolean }> {
    const contract = await this.create(
      PREO_MODULES.payrollCredit,
      {
        user: input.user,
        amount: decimal(input.amount),
        asset: input.asset,
        sourceRef: input.sourceRef,
        flowTransactionId: maybe(input.flowTransactionId),
        evmTxHash: maybe(input.evmTxHash),
        createdAt: nowIso(),
        allocated: false
      },
      input.user
    );
    return { contractId: contract.contractId, live: this.isLive };
  }

  async createEmployerPayrollNotice(input: { employer: string; employee: string; grossAmount: string; asset: string; payrollRef: string }) {
    return this.create(
      PREO_MODULES.employerPayrollNotice,
      {
        employer: input.employer,
        employee: input.employee,
        grossAmount: decimal(input.grossAmount),
        asset: input.asset,
        payrollRef: input.payrollRef,
        createdAt: nowIso()
      },
      input.employer
    );
  }

  async createOperatorAuditEvent(input: { operator: string; user?: string; userAlias: string; eventType: string; status: string; referenceHash: string }) {
    return this.create(
      PREO_MODULES.operatorAuditEvent,
      {
        operator: input.operator,
        user: maybe(input.user),
        userAlias: input.userAlias,
        eventType: input.eventType,
        status: input.status,
        referenceHash: input.referenceHash,
        createdAt: nowIso()
      },
      input.operator
    );
  }

  async runAllocation(input: { user: string; payrollCreditContractId: string; policyContractId?: string; runId?: string }): Promise<AllocationRunResult> {
    const policy = await this.getActivePayrollPolicy(input.user, input.policyContractId);
    if (!policy) {
      throw new Error("No active payroll policy found");
    }
    const credit = await this.fetchById<Record<string, unknown>>(PREO_MODULES.payrollCredit, input.payrollCreditContractId, input.user);
    if (!credit) {
      throw new Error("Payroll credit not found");
    }

    const runId = input.runId ?? `run-${Date.now()}`;
    const pendingRun = await this.create(
      PREO_MODULES.allocationRun,
      {
        user: input.user,
        runId,
        policyVersion: policy.payload.version,
        payrollAmount: credit.payload.amount,
        asset: credit.payload.asset,
        lines: [],
        status: "AllocationPending",
        createdAt: nowIso()
      },
      input.user
    );

    const run = await this.exercise<CantonContract>(PREO_MODULES.allocationRun, pendingRun.contractId, CHOICES.executeAllocation, {
      policyCid: policy.contractId,
      creditCid: credit.contractId,
      now: nowIso()
    }, input.user);

    const [balances, pendingActions, payments, portfolioAllocations] = await Promise.all([
      this.query(PREO_MODULES.categoryBalance, { user: input.user, sourceRunId: runId }, input.user),
      this.query<PendingActionSnapshot["payload"]>(PREO_MODULES.pendingAction, { user: input.user }, input.user),
      this.query(PREO_MODULES.paymentReceipt, { payer: input.user, runId }, input.user),
      this.query(PREO_MODULES.portfolioAllocation, { user: input.user, sourceRunId: runId }, input.user)
    ]);

    return {
      run,
      lines: Array.isArray((run.payload as Record<string, unknown>).lines) ? ((run.payload as Record<string, unknown>).lines as Array<Record<string, unknown>>) : [],
      balances,
      pendingActions: pendingActions.filter((action) => action.payload.actionId.startsWith(`${runId}:`)) as PendingActionSnapshot[],
      payments,
      portfolioAllocations
    };
  }

  async listApprovals(user: string) {
    return this.query<PendingActionSnapshot["payload"]>(PREO_MODULES.pendingAction, { user }, user);
  }

  async getPendingAction(contractId: string, user: string): Promise<PendingActionSnapshot | null> {
    return this.fetchById<PendingActionSnapshot["payload"]>(PREO_MODULES.pendingAction, contractId, user);
  }

  async approvePendingAction(contractId: string, user: string) {
    return this.exercise<CantonContract>(PREO_MODULES.pendingAction, contractId, CHOICES.approve, {}, user);
  }

  async rejectPendingAction(contractId: string, user: string) {
    return this.exercise<CantonContract>(PREO_MODULES.pendingAction, contractId, CHOICES.reject, {}, user);
  }

  async executeApprovedAction(input: ExecutePendingActionInput): Promise<{ contractId: string; live: boolean }> {
    const result = await this.exercise<CantonContract>(
      PREO_MODULES.pendingAction,
      input.pendingActionContractId,
      CHOICES.executeApprovedAction,
      {
        runId: input.runId,
        evmTxHash: maybe(input.evmTxHash),
        executedAt: nowIso()
      },
      input.user
    );
    return { contractId: result.contractId, live: this.isLive };
  }

  async dashboard(user: string) {
    const [policies, credits, runs, balances, approvals, payments, portfolioAllocations] = await Promise.all([
      this.query(PREO_MODULES.payrollPolicy, { user, active: true }, user),
      this.query(PREO_MODULES.payrollCredit, { user }, user),
      this.query(PREO_MODULES.allocationRun, { user }, user),
      this.query(PREO_MODULES.categoryBalance, { user }, user),
      this.query(PREO_MODULES.pendingAction, { user }, user),
      this.query(PREO_MODULES.paymentReceipt, { payer: user }, user),
      this.query(PREO_MODULES.portfolioAllocation, { user }, user)
    ]);
    return {
      activePolicy: policies.sort((left, right) => Number((right.payload as { version?: number }).version ?? 0) - Number((left.payload as { version?: number }).version ?? 0))[0] ?? null,
      payrollCredits: credits,
      allocationRuns: runs,
      categoryBalances: balances,
      pendingApprovals: approvals,
      payments,
      portfolioAllocations
    };
  }

  async partyView(party: string) {
    const templates = [
      PREO_MODULES.employerPayrollNotice,
      PREO_MODULES.paymentReceipt,
      PREO_MODULES.payrollPolicy,
      PREO_MODULES.payrollCredit,
      PREO_MODULES.allocationRun,
      PREO_MODULES.categoryBalance,
      PREO_MODULES.pendingAction,
      PREO_MODULES.portfolioAllocation,
      PREO_MODULES.operatorAuditEvent
    ];
    const entries = await Promise.all(templates.map(async (template) => [templateName(template), await this.query(template, {}, party)] as const));
    return Object.fromEntries(entries);
  }

  private templateId(moduleAndEntity: string) {
    if (!this.config.packageId || moduleAndEntity.includes(":Preo.")) {
      return moduleAndEntity;
    }
    return `${this.config.packageId}:${moduleAndEntity}`;
  }

  private async command(kind: "create" | "exercise", command: Record<string, unknown>, actAs: string): Promise<Record<string, unknown>> {
    if (this.config.apiVersion === "v1") {
      const path = kind === "create" ? "/v1/create" : "/v1/exercise";
      return this.post(path, { ...command, actAs: [actAs] });
    }

    const v2Command =
      kind === "create"
        ? { commands: [{ CreateCommand: command }], actAs: [actAs] }
        : { commands: [{ ExerciseCommand: command }], actAs: [actAs] };
    return this.post("/v2/commands/submit-and-wait", v2Command);
  }

  private async post(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const url = new URL(path, this.config.baseUrl).toString();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.config.authToken ? { authorization: `Bearer ${this.config.authToken}` } : {})
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Canton JSON API ${response.status}: ${text}`);
    }
    return (await response.json()) as Record<string, unknown>;
  }

  private normalizeContract<T>(contract: unknown, fallbackTemplateId: string): CantonContract<T> {
    const record = nestedRecord(contract);
    return {
      contractId: String(record.contractId ?? record.contract_id ?? nestedRecord(record.contract).contractId),
      templateId: String(record.templateId ?? record.template_id ?? fallbackTemplateId),
      payload: (record.payload ?? nestedRecord(record.contract).payload ?? record) as T
    };
  }

  private demoCreate<T extends Record<string, unknown>>(templateId: string, payload: T): CantonContract<T> {
    const state = demoState();
    state.counter += 1;
    const contractId = `demo-${templateName(templateId).replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}-${state.counter}`;
    state.contracts.set(contractId, {
      contractId,
      templateId,
      payload,
      archived: false,
      createdAt: nowIso()
    });
    return { contractId, templateId, payload };
  }

  private archive(contractId: string) {
    const contract = demoState().contracts.get(contractId);
    if (contract) {
      contract.archived = true;
    }
  }

  private demoExercise(templateId: string, contractId: string, choice: string, argument: Record<string, unknown>, actAs: string) {
    const contract = demoState().contracts.get(contractId);
    if (!contract || contract.archived || contract.templateId !== templateId || !visibleTo(contract, actAs)) {
      throw new Error(`Contract not found: ${contractId}`);
    }

    if (templateName(templateId) === PREO_MODULES.pendingAction) {
      return this.demoExercisePendingAction(contract, choice, argument);
    }

    if (templateName(templateId) === PREO_MODULES.allocationRun && choice === CHOICES.executeAllocation) {
      return this.demoExecuteAllocation(contract, argument, actAs);
    }

    if (templateName(templateId) === PREO_MODULES.payrollCredit && choice === CHOICES.markAllocated) {
      this.archive(contractId);
      return this.demoCreate(templateId, { ...contract.payload, allocated: true });
    }

    throw new Error(`Unsupported demo exercise ${choice} on ${templateId}`);
  }

  private demoExercisePendingAction(contract: StoredContract, choice: string, argument: Record<string, unknown>) {
    const payload = contract.payload as PendingActionSnapshot["payload"];
    if (choice === CHOICES.approve) {
      if (payload.status !== "Pending") {
        throw new Error("only pending actions can be approved");
      }
      this.archive(contract.contractId);
      return this.demoCreate(contract.templateId, { ...payload, status: "Approved" });
    }
    if (choice === CHOICES.reject) {
      if (payload.status !== "Pending") {
        throw new Error("only pending actions can be rejected");
      }
      this.archive(contract.contractId);
      return this.demoCreate(contract.templateId, { ...payload, status: "Rejected" });
    }
    if (choice === CHOICES.executeApprovedAction) {
      if (payload.status !== "Approved") {
        throw new Error("only approved actions can be executed");
      }
      const runId = String(argument.runId ?? payload.actionId.split(":")[0]);
      const executedAt = String(argument.executedAt ?? nowIso());
      if (payload.actionType === "ActionExternalPayment" && payload.recipient) {
        this.demoCreate(PREO_MODULES.paymentReceipt, {
          payer: payload.user,
          recipient: payload.recipient,
          amount: payload.amount,
          asset: payload.asset,
          memo: payload.label,
          runId,
          evmTxHash: argument.evmTxHash ?? { tag: "None" },
          createdAt: executedAt,
          acknowledged: false
        });
      }
      if (payload.actionType === "ActionPortfolioAllocation" && payload.portfolioTarget) {
        this.demoCreate(PREO_MODULES.portfolioAllocation, {
          user: payload.user,
          portfolioId: payload.categoryId,
          label: payload.label,
          amount: payload.amount,
          asset: payload.asset,
          model: payload.portfolioTarget,
          sourceRunId: runId,
          createdAt: executedAt,
          archived: false
        });
      }
      this.archive(contract.contractId);
      return this.demoCreate(contract.templateId, { ...payload, status: "Executed" });
    }
    throw new Error(`Unsupported pending action choice ${choice}`);
  }

  private demoExecuteAllocation(runContract: StoredContract, argument: Record<string, unknown>, actAs: string) {
    const policyCid = String(argument.policyCid);
    const creditCid = String(argument.creditCid);
    const policy = demoState().contracts.get(policyCid);
    const credit = demoState().contracts.get(creditCid);
    if (!policy || policy.archived || !credit || credit.archived) {
      throw new Error("Policy or payroll credit not found");
    }
    const policyPayload = policy.payload as PayrollPolicyPayload;
    const creditPayload = credit.payload as Record<string, unknown>;
    if (policyPayload.user !== actAs || creditPayload.user !== actAs) {
      throw new Error("policy or payroll credit belongs to another user");
    }
    if (!policyPayload.active) {
      throw new Error("policy must be active");
    }
    if (creditPayload.allocated) {
      throw new Error("payroll credit is already allocated");
    }

    const runPayload = runContract.payload as Record<string, unknown>;
    const runId = String(runPayload.runId);
    const now = String(argument.now ?? nowIso());
    const payrollAmount = amountNumber(creditPayload.amount);
    const lines = policyPayload.categories.map((category) => {
      const amount = payrollAmount * category.percentageBps / 10000;
      return {
        categoryId: category.categoryId,
        label: category.label,
        categoryType: category.categoryType,
        percentageBps: decimal(category.percentageBps),
        amount: formatAmount(amount),
        requiresApproval: category.requiresApproval
      };
    });

    for (const category of policyPayload.categories) {
      const amount = payrollAmount * category.percentageBps / 10000;
      const amountText = formatAmount(amount);
      this.demoCreate(PREO_MODULES.categoryBalance, {
        user: actAs,
        categoryId: category.categoryId,
        label: category.label,
        categoryType: category.categoryType,
        asset: creditPayload.asset,
        balance: amountText,
        sourceRunId: runId,
        updatedAt: now,
        archived: false
      });
      if (category.requiresApproval) {
        this.demoCreate(PREO_MODULES.pendingAction, {
          user: actAs,
          actionId: `${runId}:${category.categoryId}`,
          actionType: categoryActionType(category.categoryType),
          categoryId: category.categoryId,
          label: category.label,
          amount: amountText,
          asset: String(creditPayload.asset),
          recipient: category.recipientParty ?? null,
          externalAddress: category.externalAddress ?? null,
          portfolioTarget: category.portfolioTarget ?? null,
          reason: "Category requires user approval",
          status: "Pending",
          createdAt: now
        });
      } else if (category.categoryType === "ExternalPayment" && categoryRecipient(category)) {
        this.demoCreate(PREO_MODULES.paymentReceipt, {
          payer: actAs,
          recipient: categoryRecipient(category),
          amount: amountText,
          asset: creditPayload.asset,
          memo: category.label,
          runId,
          evmTxHash: { tag: "None" },
          createdAt: now,
          acknowledged: false
        });
      } else if (category.categoryType === "PortfolioAllocation" && category.portfolioTarget) {
        this.demoCreate(PREO_MODULES.portfolioAllocation, {
          user: actAs,
          portfolioId: category.categoryId,
          label: category.label,
          amount: amountText,
          asset: creditPayload.asset,
          model: category.portfolioTarget,
          sourceRunId: runId,
          createdAt: now,
          archived: false
        });
      }
    }

    this.archive(creditCid);
    this.demoCreate(PREO_MODULES.payrollCredit, { ...creditPayload, allocated: true });
    this.archive(runContract.contractId);
    return this.demoCreate(PREO_MODULES.allocationRun, {
      ...runPayload,
      policyVersion: policyPayload.version,
      payrollAmount: creditPayload.amount,
      asset: creditPayload.asset,
      lines,
      status: policyPayload.categories.some((category) => category.requiresApproval) ? "AllocationPartiallyPendingApproval" : "AllocationExecuted",
      createdAt: now
    });
  }
}

export function createCantonClientFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return new CantonClient({
    baseUrl: env.CANTON_JSON_API_URL,
    authToken: env.CANTON_AUTH_TOKEN,
    packageId: env.CANTON_PACKAGE_ID,
    apiVersion: env.CANTON_JSON_API_VERSION === "v1" ? "v1" : "v2",
    demoMode: env.DEMO_MODE === "true" || !env.CANTON_JSON_API_URL
  });
}
