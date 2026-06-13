# Preo Architecture

Preo is a privacy-first agentic payroll neobank prototype. EVM/testnet funding proves that money arrived; Canton is the private source of truth for payroll accounting.

```text
Dynamic Flow / Blink / direct testnet deposit
        |
        v
EVM settlement wallet or PreoFundingVault
        |
        v
Backend settlement attestor
        |
        v
Canton / Daml private ledger
        |
        v
Deterministic policy allocation engine
        |
        v
Category balances, approvals, receipts, portfolio records, party views
```

## Components

- `apps/web`: Next.js UI and API routes for onboarding, funding, policy creation, allocation, approvals, agent execution, and party-view queries.
- `daml`: Daml contracts for private account state, policy, payroll, allocation, payment, portfolio, and audit records.
- `contracts`: Hardhat contracts for `PreoFundingVault` and `MockUSDC`.
- `packages/policy-engine`: deterministic validation and allocation math.
- `packages/canton-client`: Canton JSON API wrapper with demo-mode fallback.
- `packages/dynamic-integration`: Dynamic Flow availability and agent wallet signing helpers.

## Data Flow

1. A worker signs in through Dynamic or uses demo identity fallback.
2. The worker creates a payroll policy with custom categories, percentages, recipients, portfolio target, and approval requirements.
3. Payroll arrives through Dynamic Flow, Blink, or direct testnet deposit.
4. The backend verifies or simulates settlement evidence and creates a private Canton `PayrollCredit`.
5. The allocation agent loads the active policy, validates that percentages sum to 10,000 basis points, and allocates the payroll amount.
6. Canton records user-private `CategoryBalance`, `AllocationRun`, `PendingAction`, and `PortfolioAllocation` contracts.
7. Recipient-visible `PaymentReceipt` contracts are created only for the relevant payer/recipient pair.
8. Operator visibility is limited to `OperatorAuditEvent` metadata.

## Settlement Model

The EVM layer is not the payroll ledger. It provides deposit evidence through Dynamic Flow, Blink, direct deposit fallback, or `PreoFundingVault` events. The backend acts as the hackathon settlement attestor and converts confirmed evidence into private Canton accounting state.

## Agent Model

The payroll agent is deterministic and policy-bound. It never invents categories, changes percentages, gives investment advice, or makes discretionary allocation choices. It only executes the user-defined policy and routes approval-required actions through `PendingAction` records.

## Demo Mode

`DEMO_MODE=true` keeps the full journey usable without sponsor production credentials:

- Dynamic Flow returns a direct testnet fallback if unavailable.
- Blink signer returns a demo signed payload.
- Canton client returns demo contract IDs when no JSON API is configured.
- Dynamic agent wallet returns clearly simulated signatures and tx hashes.
