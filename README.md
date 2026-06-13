# Preo

Preo is a privacy-first agentic payroll neobank prototype. This repository slice contains the Canton/Daml private ledger MVP for payroll policies, private category accounting, approval actions, payment receipts, portfolio allocations, and party-specific audit visibility.

The repository now also includes a TypeScript/Next.js integration scaffold for Dynamic onboarding, Dynamic Flow funding, a server-wallet-backed payroll agent, SQLite persistence, and Canton JSON API orchestration.
It also includes the Blink secondary deposit path and an EVM settlement vault used as funding evidence before private Canton crediting.

## App + Integration Scaffold

Workspace layout:

- `apps/web`: Next.js App Router UI and backend route handlers.
- `packages/shared`: shared request/response schemas and DTOs.
- `packages/canton-client`: small Canton JSON API wrapper with demo-mode fallback.
- `packages/dynamic-integration`: Dynamic Flow availability helpers and agent wallet adapter.
- `contracts`: Hardhat workspace for `PreoFundingVault` and `MockUSDC`.
- `daml`: existing Canton/Daml private ledger package.

Install and run:

```sh
pnpm install
cp .env.example .env.local
DATABASE_URL=file:./dev.db pnpm prisma:migrate
pnpm dev
```

The app defaults to `DEMO_MODE=true` behavior when Dynamic/Canton env vars are absent. In that mode the UI uses a demo Dynamic identity, Dynamic Flow returns a direct-deposit fallback, and the agent wallet returns clearly simulated transaction hashes.

Core app/API routes:

- `POST /api/me/bootstrap` creates or retrieves the Dynamic user -> Preo user -> Canton party mapping.
- `POST /api/funding/flow/checkout` creates local Flow funding intent state or returns `flow_unavailable_use_direct_deposit`.
- `GET /api/funding/flow/[transactionId]` returns stored Flow/funding status.
- `POST /api/funding/flow/webhook` records Dynamic webhook events and creates a Canton `PayrollCredit` when settlement completes.
- `POST /api/funding/direct-deposit` creates a direct testnet/demo funding intent and Canton `PayrollCredit`.
- `POST /api/funding/blink/session` returns the Blink signer path, settlement chain, token, and Preo funding vault destination.
- `POST /api/blink/sign-payment` signs a Blink payment payload server-side with P-256/SHA-256 and returns no private key material.
- `POST /api/funding/evm/verify-deposit` verifies a `PreoFundingVault` event in an EVM receipt and creates the private Canton `PayrollCredit`.
- `POST /api/agent/execute-approved-action` executes an approved pending action through the agent wallet and records the Canton execution.
- `GET /api/agent/actions` returns recent agent execution records.

Useful checks:

```sh
pnpm daml:test
pnpm typecheck
pnpm test
pnpm build
pnpm contracts:test
DEMO_MODE=true pnpm smoke:flow
DEMO_MODE=true pnpm smoke:blink
DEMO_MODE=true pnpm smoke:evm-funding
DEMO_MODE=true pnpm smoke:agent-wallet
DEMO_MODE=true pnpm smoke:full-flow
```

### Dynamic Configuration

Required for real Dynamic auth:

```text
NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=
DYNAMIC_ENVIRONMENT_ID=
DYNAMIC_AUTH_TOKEN=
```

Required for Dynamic Flow:

```text
DYNAMIC_FLOW_CHECKOUT_ID=
DYNAMIC_WEBHOOK_SECRET=
```

If Flow is not enabled for the Dynamic environment, the app keeps the Flow UI/API path visible and returns a direct testnet deposit fallback for the demo.

Required for live agent wallet transactions:

```text
DYNAMIC_AGENT_WALLET_PASSWORD=
DYNAMIC_AGENT_WALLET_METADATA_JSON=
DYNAMIC_AGENT_KEY_SHARES_JSON=
SETTLEMENT_CHAIN_ID=84532
SETTLEMENT_RPC_URL=
TESTNET_USDC_ADDRESS=
PREO_FUNDING_VAULT_ADDRESS=
DEPLOYER_PRIVATE_KEY=
DEPLOY_MOCK_USDC=true
```

For burner-key demos, `DYNAMIC_AGENT_PRIVATE_KEY` can be used by the adapter, but do not commit it. If no live wallet metadata/private key is configured and `DEMO_MODE=true`, the adapter returns simulated transaction hashes.

### EVM Funding Vault

The settlement vault is the shared evidence layer for Dynamic Flow, Blink, and direct testnet fallback deposits. It is not the private ledger; verified vault events are converted into private Canton `PayrollCredit` contracts by the backend.

```sh
pnpm contracts:compile
pnpm contracts:test
SETTLEMENT_RPC_URL=... DEPLOYER_PRIVATE_KEY=... pnpm contracts:deploy
```

The deploy script writes:

```text
contracts/deployments/preo-funding-vault.json
```

If `TESTNET_USDC_ADDRESS` is absent or `DEPLOY_MOCK_USDC=true`, the deploy script deploys `MockUSDC`, configures it as a supported token, and records the address as `TestnetUSDC`. Copy the resulting vault/token addresses into `.env.local`.

The vault emits:

- `PreoDepositReceived` from `depositFor(preoUserIdHash, token, amount, externalRef)`.
- `PayrollDepositRecorded` from an authorized owner/agent for demo payroll evidence.
- `PreoWithdrawalExecuted` from authorized vault withdrawals.

The verifier route requires `SETTLEMENT_RPC_URL` for live receipt checks. In `DEMO_MODE=true` with no RPC URL, it returns a clearly demo-mode verification result for local smoke testing.

### Blink Configuration

Required for live Blink signing:

```text
BLINK_MERCHANT_ID=
BLINK_MERCHANT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
BLINK_WEBHOOK_SECRET=
NEXT_PUBLIC_BLINK_MERCHANT_ID=
```

Blink is wired as a secondary deposit path. The web app requests `/api/funding/blink/session`, then asks `/api/blink/sign-payment` to sign a short-lived payload whose destination is `PREO_FUNDING_VAULT_ADDRESS`. The private merchant key is only read by the server route, and signer responses set `Cache-Control: no-store`.

### Canton JSON API Configuration

```text
CANTON_JSON_API_URL=
CANTON_JSON_API_VERSION=v2
CANTON_AUTH_TOKEN=
CANTON_PACKAGE_ID=
```

Without `CANTON_JSON_API_URL`, the app returns demo Canton contract IDs. With a live JSON API, the app creates `PayrollCredit` contracts and exercises `PendingAction.ExecuteApprovedAction` through the wrapper.

## Ledger Package

The Daml project lives in `daml/` and uses SDK `3.4.11` for Canton 3.x alignment.

Core modules:

- `Preo.Types`: shared enums and record types for categories, approvals, allocation status, portfolio models, and allocation lines.
- `Preo.User`: private `UserProfile`.
- `Preo.Policy`: user-owned `PayrollPolicy` plus policy validation.
- `Preo.Payroll`: employer-visible `EmployerPayrollNotice` and user-private `PayrollCredit`.
- `Preo.Allocation`: `AllocationRun`, `CategoryBalance`, and `PendingAction`.
- `Preo.Payment`: payer/recipient `PaymentReceipt`.
- `Preo.Portfolio`: private `PortfolioAllocation`.
- `Preo.Audit`: limited `OperatorAuditEvent`.
- `Preo.Test`: Daml Script privacy and happy-path demo.

## Privacy Model

| Template | Signatory | Observer | Visibility intent |
| --- | --- | --- | --- |
| `UserProfile` | user | none | User-only account profile |
| `PayrollPolicy` | user | none | User-only policy rules and percentages |
| `EmployerPayrollNotice` | employer | employee | Employer sees payroll notice only |
| `PayrollCredit` | user | none | User-only confirmed funding record |
| `AllocationRun` | user | none | User-only allocation result |
| `CategoryBalance` | user | none | User-only category balance delta |
| `PendingAction` | user | none | User-only approval queue |
| `PaymentReceipt` | payer | recipient | Payer and recipient only |
| `PortfolioAllocation` | user | none | User-only testnet portfolio record |
| `OperatorAuditEvent` | operator | optional user | Limited metadata, no balances or category details |

The employer-visible notice is intentionally separate from private payroll credit and allocation execution. For the hackathon MVP, the backend or user submits the private `PayrollCredit` after Dynamic Flow, Blink, or direct testnet settlement evidence is confirmed.

## Policy Validation

`PayrollPolicy.ValidatePolicy` rejects:

- empty category lists,
- empty policy names, labels, or category IDs,
- negative percentages,
- percentages that do not sum exactly to `10000.0` basis points,
- external payment categories without a Canton recipient or external address,
- portfolio allocation categories without a target model.

## Allocation Flow

1. User creates a `PayrollPolicy`.
2. Employer creates an `EmployerPayrollNotice`, visible only to employer and employee.
3. Backend/user creates a private `PayrollCredit`.
4. User creates an `AllocationRun` in pending form and exercises `ExecuteAllocation`.
5. The choice validates the policy, calculates allocation amounts, creates one `CategoryBalance` delta per category, creates `PendingAction` contracts for approval-required lines, creates immediate payer/recipient receipts for non-approval Canton-party external payments, creates immediate portfolio records for non-approval portfolio allocations, and marks the payroll credit allocated.
6. User approves and executes pending actions through `PendingAction`.

## Local Setup

Install or verify Daml SDK `3.4.11`, then run:

```sh
cd daml
daml build
daml test
```

On macOS with Homebrew-installed Java 17, run tests with:

```sh
cd daml
JAVA_HOME=/opt/homebrew/opt/openjdk@17 PATH="/opt/homebrew/opt/openjdk@17/bin:$HOME/.daml/bin:$PATH" daml test
```

To run a local sandbox/JSON API after a successful build:

```sh
cd daml
daml sandbox --json-api-port 7575 .daml/dist/preo-0.0.1.dar
```

Expected backend operations are create, exercise, and query commands over the Canton JSON API. Canton environments may expose either classic `/v1/*` JSON API routes or newer `/v2/commands/*` and `/v2/state/*` routes; backend clients should select through `CANTON_JSON_API_VERSION`.

## Demo Script

`Preo.Test.runPrivacyDemo` creates:

- `user`,
- `employer`,
- `recipient`,
- `operator`,
- `otherUser`.

It demonstrates a 2000 USDC payroll allocation with:

- Rent: 35%, external payment to recipient,
- Emergency Fund: 20%, internal reserve,
- Portfolio: 30%, approval-required portfolio allocation,
- Spending: 15%, manual hold.

The script asserts that:

- user sees private runs, balances, receipt, and portfolio record,
- recipient sees only their receipt,
- employer sees only payroll notice,
- operator sees only audit metadata,
- other user sees nothing.

## DevNet Deployment Placeholder

Build output is expected at:

```text
daml/.daml/dist/preo-0.0.1.dar
```

Deployment metadata should be written to `daml/deployments/canton-devnet.json` after upload to Canton DevNet or the sponsor-approved environment. The backend should store the resulting package ID in `CANTON_PACKAGE_ID`.

## Known Limitations

- EVM, Dynamic Flow, Blink, and direct testnet deposits are treated as settlement evidence; Canton is the private accounting source of truth.
- The backend is the settlement attestor for the hackathon MVP.
- Portfolio allocation is a private testnet/simulated record, not real securities execution.
- There are no bank rails or real-world payroll integrations in this package.
- Category balances are represented as per-allocation deltas for speed and reliability; backend/UI clients aggregate by `categoryId` and `asset`.
