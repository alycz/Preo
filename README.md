# Preo

Preo is a privacy-first agentic payroll neobank prototype. This repository slice contains the Canton/Daml private ledger MVP for payroll policies, private category accounting, approval actions, payment receipts, portfolio allocations, and party-specific audit visibility.

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
