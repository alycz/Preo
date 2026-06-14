# Preo

Preo is a privacy-first agentic payroll neobank for everyday workers. It receives stablecoin payroll, lets a worker define a custom salary policy, and routes each paycheck into private Canton-backed financial categories.

This is a testnet hackathon prototype built from scratch for ETHGlobal. It is not a bank account, FDIC-insured product, payroll provider, securities product, or production bridge.

## What It Does

Preo gives a worker a policy-bound payroll agent:

1. The worker signs in and creates custom payroll categories.
2. Payroll arrives through Dynamic Flow, Blink, or direct testnet funding evidence.
3. The backend attests settlement evidence and credits a private Canton `PayrollCredit`.
4. The deterministic allocation engine applies the worker's percentages exactly.
5. Canton records private category balances, approvals, payment receipts, portfolio allocations, and audit events.
6. Approved actions can be executed by a Dynamic server wallet on testnet.
7. Party-view screens prove that employers, recipients, operators, and unrelated users do not see the worker's private payroll allocation.

## Why Canton, Dynamic, And Blink

- **Canton** is the private source of truth for neobank accounting. Daml contracts model policies, payroll credits, allocations, approvals, payments, portfolio records, and audit events with party-specific visibility.
- **Dynamic** powers onboarding, Flow funding, and agent wallet execution for approved testnet actions.
- **Blink** adds a secondary consumer deposit UX with a server-side signer route and no exposed merchant private key.
- **EVM settlement** is evidence only. Canton is the private ledger; the backend is the hackathon settlement attestor.

## Architecture

```text
Dynamic Flow / Blink / direct testnet deposit
        |
        v
EVM settlement wallet or PreoFundingVault
        |
        v
Preo backend settlement attestor
        |
        v
Canton / Daml private ledger
        |
        v
Policy-bound payroll allocation agent
        |
        v
Private balances, approvals, receipts, portfolio records, party views
```

Repository layout:

- `apps/web`: Next.js app, UI, API routes, Prisma persistence, smoke scripts.
- `daml`: Canton/Daml private ledger package.
- `contracts`: Hardhat workspace for `PreoFundingVault` and `MockUSDC`.
- `packages/shared`: shared schemas and DTOs.
- `packages/policy-engine`: deterministic allocation validation and math.
- `packages/canton-client`: Canton JSON API wrapper with demo fallback.
- `packages/dynamic-integration`: Dynamic Flow and agent wallet adapters.
- `docs`: architecture, privacy, deployment, demo, sponsor, and limitation docs.

## Privacy Model

Canton parties only see contracts where they are stakeholders or observers. Preo keeps sensitive worker contracts user-only and separates employer notices, recipient receipts, and operator audit metadata.

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

More detail: [docs/PRIVACY_MODEL.md](docs/PRIVACY_MODEL.md).

## Local Setup

Use Node 20 or 22 for deployment and Hardhat work. Local verification on Node 25 can pass, but Hardhat warns that Node 25 is unsupported.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm prisma:generate
DATABASE_URL=file:./dev.db pnpm prisma:migrate
pnpm dev
```

The app defaults to `DEMO_MODE=true` behavior when live sponsor env vars are absent. In demo mode, the browser uses a mocked connected Dynamic wallet, Flow falls back to direct testnet funding, Blink signs demo payloads, Canton returns demo contract IDs, and the agent wallet returns clearly simulated transaction hashes.

## Environment

Copy `.env.example` to `.env.local`. For demo submission, the minimum env is:

```text
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=file:./dev.db
DEMO_MODE=true
```

Live integrations can be enabled by adding Dynamic, Canton, Blink, RPC, USDC, and vault variables from `.env.example`. Live Dynamic login requires `DEMO_MODE=false`; when `DEMO_MODE=true`, the client wallet stays mocked even if `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID` is populated. Do not commit private keys, even burner keys.

## One-Hour Deployment Checklist

1. Run local verification:
   `pnpm install --frozen-lockfile && pnpm prisma:generate && DATABASE_URL=file:./dev.db pnpm prisma:migrate && DEMO_MODE=true pnpm verify:demo`
2. Deploy the settlement vault:
   `SETTLEMENT_RPC_URL=... DEPLOYER_PRIVATE_KEY=... DEPLOY_MOCK_USDC=true pnpm deploy:contracts:settlement`
3. Upload the Daml DAR from `daml/.daml/dist/preo-0.0.1.dar` to Canton DevNet, then run:
   `CANTON_PACKAGE_ID=... CANTON_JSON_API_URL=... pnpm update:canton-deployment`
4. Paste only live credentials into the deploy target: Dynamic, Blink, Canton, settlement RPC, token, and vault address.
5. Run readiness checks:
   `pnpm smoke:live-readiness`, then the individual `pnpm smoke:*` commands.

## Live Integration Status

| Integration | Demo-ready | Live-ready when env is added | Check |
| --- | --- | --- | --- |
| Canton | yes | `CANTON_JSON_API_URL`, `CANTON_PACKAGE_ID`, optional token/parties | `/api/health/canton`, `pnpm smoke:canton` |
| Dynamic login | mocked in `DEMO_MODE=true` | `DEMO_MODE=false`, `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID` | `/api/health/dynamic` |
| Dynamic agent wallet | yes | metadata/key shares or `DYNAMIC_AGENT_PRIVATE_KEY` | `pnpm smoke:dynamic` |
| Dynamic Flow | fallback | `DYNAMIC_ENVIRONMENT_ID`, `DYNAMIC_FLOW_CHECKOUT_ID` | funding page, `/api/health/dynamic` |
| Blink | yes | `BLINK_MERCHANT_ID`, `BLINK_MERCHANT_PRIVATE_KEY` | `/api/health/blink`, `pnpm smoke:blink` |
| EVM vault | yes | `SETTLEMENT_RPC_URL`, `TESTNET_USDC_ADDRESS`, `PREO_FUNDING_VAULT_ADDRESS` | `pnpm smoke:evm` |

## Commands

```sh
pnpm dev
pnpm build
pnpm typecheck
pnpm test
pnpm verify:demo
pnpm daml:test
pnpm daml:build
pnpm contracts:compile
pnpm contracts:test
pnpm deploy:contracts:local
pnpm deploy:contracts:settlement
pnpm smoke:live-readiness
```

Daml local commands:

```sh
cd daml
daml build
daml test
daml sandbox --json-api-port 7575 .daml/dist/preo-0.0.1.dar
```

For Canton 3.x/DPM environments, use the equivalent newer tooling where available:

```sh
dpm build
dpm test
dpm codegen-js
dpm sandbox --json-api-port 7575
```

Smoke checks:

```sh
pnpm verify:demo
pnpm smoke:canton
pnpm smoke:dynamic
pnpm smoke:blink
pnpm smoke:evm
pnpm smoke:full-flow
pnpm smoke:live-readiness
```

## Demo Flow

1. Open Preo.
2. Sign in with Dynamic or use the demo identity.
3. Create a custom payroll policy with custom categories and percentages.
4. Simulate payroll through Dynamic Flow fallback, Blink, or direct testnet deposit.
5. Run the payroll allocation agent.
6. Approve the portfolio or external action.
7. Execute the approved testnet action and show the tx hash.
8. Switch party views: user, employer, recipient, operator, other user.
9. Show that only the user sees full payroll allocation details.

Full script: [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

## Deployment

The fastest judged deployment path is one Vercel project for the Next.js app/API:

- Build command: `pnpm build`
- Fast demo env: `DEMO_MODE=true`, `DATABASE_URL=file:/tmp/preo-demo.db`, `NEXT_PUBLIC_APP_URL`
- Stable demo env: Railway/Render/Fly with persistent SQLite, or a hosted Postgres migration after the hackathon
- Optional live env: Dynamic, Canton, Blink, settlement RPC, USDC, and vault values from `.env.example`

Deployment details and placeholders for final URL/address/package IDs are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Sponsor Tracks

Preo targets:

- Canton Foundation: Payments & Neobanking
- Dynamic: Best Agentic Build, Best Money App, Flow if enabled
- Blink: consumer deposit UX, Scratch track

Track mapping: [docs/SPONSOR_TRACKS.md](docs/SPONSOR_TRACKS.md).

## From-Scratch Compliance

Preo was built from scratch during the hackathon. xPrime was strategic inspiration only; no xPrime code, UI assets, repository history, branding, or project-specific implementation were reused. General-purpose SDKs, libraries, starter templates, and official sponsor SDKs are allowed.

## Known Limitations

- Testnet stablecoin payroll only; no real bank direct deposit.
- No FDIC-insured account or regulated banking service.
- Backend attests EVM settlement evidence to Canton; this is not a trustless bridge.
- Portfolio allocation is testnet/simulated, not real securities trading.
- Dynamic Flow and Blink live behavior depend on sponsor enablement.
- Demo mode returns simulated Dynamic wallet tx hashes when live wallet credentials are absent.

More detail: [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md).
