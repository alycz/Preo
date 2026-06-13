# Privacy Model

Canton is Preo's private accounting ledger. Daml parties see only contracts where they are signatories, observers, or otherwise stakeholders. Preo keeps sensitive payroll contracts user-only and creates separate contracts for employer notices, recipient receipts, and operator audit metadata.

## Visibility Table

| Contract | User | Employer | Recipient | Operator | Other |
| --- | --- | --- | --- | --- | --- |
| `UserProfile` | yes | no | no | no | no |
| `PayrollPolicy` | yes | no | no | no | no |
| `PayrollCredit` | yes | no | no | no | no |
| `CategoryBalance` | yes | no | no | no | no |
| `AllocationRun` | yes | no | no | no | no |
| `PendingAction` | yes | no | no | no | no |
| `EmployerPayrollNotice` | yes | yes | no | no | no |
| `PaymentReceipt` | yes | no | yes | no | no |
| `PortfolioAllocation` | yes | no | no | no | no |
| `OperatorAuditEvent` | maybe | no | no | yes | no |

## Party Roles

- **User / employee** sees the full payroll amount, policy, category balances, allocations, approvals, receipts, portfolio records, and relevant audit metadata.
- **Employer / payroll sender** sees that payroll was sent through `EmployerPayrollNotice`; they do not see categories, percentages, balances, approvals, portfolio allocations, or recipients other than the employee.
- **Recipient** sees only their own `PaymentReceipt`.
- **Operator** sees limited operational metadata through `OperatorAuditEvent`, not category balances or allocation details.
- **Other user** sees no sensitive contracts for this worker.

## Design Rules

- Do not put employer, recipient, operator, or unrelated users on user-private balance, policy, credit, allocation, approval, or portfolio contracts.
- Keep employer-facing notice contracts separate from private payroll credits.
- Keep recipient receipts separate from full allocation state.
- Keep audit events metadata-only.

## Smoke Coverage

The canonical Daml privacy smoke is `Preo.Test.runPrivacyDemo`, run through:

```sh
pnpm daml:test
DEMO_MODE=true pnpm smoke:canton
```

The app-level party-view smoke is:

```sh
DEMO_MODE=true pnpm smoke:full-flow
```

It asserts that the user sees policy and balances, employer sees only notice, recipient sees only receipt, operator sees audit metadata, and another user sees no private policy or balance contracts.
