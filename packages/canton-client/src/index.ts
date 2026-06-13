export type CantonJsonApiVersion = "v1" | "v2";

export type CantonClientConfig = {
  baseUrl?: string;
  authToken?: string;
  packageId?: string;
  apiVersion?: CantonJsonApiVersion;
  demoMode?: boolean;
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

export type PendingActionSnapshot = {
  contractId: string;
  payload: {
    user: string;
    actionId: string;
    status: "Pending" | "Approved" | "Rejected" | "Executed";
    amount: string;
    asset: string;
    externalAddress?: string | null;
  };
};

const PREO_MODULES = {
  payrollCredit: "Preo.Payroll:PayrollCredit",
  pendingAction: "Preo.Allocation:PendingAction",
  executeApprovedAction: "ExecuteApprovedAction"
};

function nowIso() {
  return new Date().toISOString();
}

function decimal(value: string) {
  return value.includes(".") ? value : `${value}.0`;
}

function nestedRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
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

  async createPayrollCredit(input: CreatePayrollCreditInput): Promise<{ contractId: string; live: boolean }> {
    if (!this.isLive) {
      return {
        contractId: `demo-payroll-credit-${input.sourceRef}-${Date.now()}`,
        live: false
      };
    }

    const templateId = this.templateId(PREO_MODULES.payrollCredit);
    const payload = {
      user: input.user,
      amount: decimal(input.amount),
      asset: input.asset,
      sourceRef: input.sourceRef,
      flowTransactionId: input.flowTransactionId ? { tag: "Some", value: input.flowTransactionId } : { tag: "None" },
      evmTxHash: input.evmTxHash ? { tag: "Some", value: input.evmTxHash } : { tag: "None" },
      createdAt: nowIso(),
      allocated: false
    };

    const response = await this.command("create", { templateId, payload }, input.user);
    const exerciseResult = nestedRecord(response.exerciseResult);
    const result = nestedRecord(response.result);
    return {
      contractId: String(response.contractId ?? exerciseResult.contractId ?? result.contractId),
      live: true
    };
  }

  async getPendingAction(contractId: string, user: string): Promise<PendingActionSnapshot | null> {
    if (!this.isLive) {
      return null;
    }

    const response = await this.queryByContractId(contractId, user);
    if (!response) {
      return null;
    }

    return {
      contractId,
      payload: response.payload as PendingActionSnapshot["payload"]
    };
  }

  async executeApprovedAction(input: ExecutePendingActionInput): Promise<{ contractId: string; live: boolean }> {
    if (!this.isLive) {
      return {
        contractId: `demo-executed-action-${input.pendingActionContractId}-${Date.now()}`,
        live: false
      };
    }

    const argument = {
      runId: input.runId,
      evmTxHash: input.evmTxHash ? { tag: "Some", value: input.evmTxHash } : { tag: "None" },
      executedAt: nowIso()
    };
    const response = await this.command(
      "exercise",
      {
        templateId: this.templateId(PREO_MODULES.pendingAction),
        contractId: input.pendingActionContractId,
        choice: PREO_MODULES.executeApprovedAction,
        argument
      },
      input.user
    );

    return {
      contractId: String(response.exerciseResult ?? response.result ?? input.pendingActionContractId),
      live: true
    };
  }

  private templateId(moduleAndEntity: string) {
    if (!this.config.packageId) {
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

  private async queryByContractId(contractId: string, actAs: string): Promise<Record<string, unknown> | null> {
    if (this.config.apiVersion === "v1") {
      return this.post("/v1/fetch", { contractId, parties: [actAs] });
    }

    return this.post("/v2/state/active-contract", { contractId, requestingParties: [actAs] });
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
