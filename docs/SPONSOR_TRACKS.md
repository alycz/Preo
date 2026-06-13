# Sponsor Tracks

## Canton Foundation: Payments & Neobanking

Preo uses Canton/Daml as the private source of truth for a neobank-style payroll accounting system.

Evidence:

- Daml templates model `UserProfile`, `PayrollPolicy`, `PayrollCredit`, `CategoryBalance`, `AllocationRun`, `PendingAction`, `PaymentReceipt`, `PortfolioAllocation`, and `OperatorAuditEvent`.
- Party visibility demonstrates that employers, recipients, operators, and unrelated users do not see private salary allocation data.
- `Preo.Test.runPrivacyDemo` validates the privacy model.
- The app exposes party-view screens for user, employer, recipient, operator, and other user.

## Dynamic: Best Agentic Build

Preo's payroll agent is deterministic and policy-bound. It detects confirmed payroll, applies the worker's custom allocation policy, creates approval actions, and executes approved actions through a Dynamic agent wallet path.

Evidence:

- Dynamic onboarding path in the web app.
- Dynamic Flow funding scaffold and fallback.
- Agent wallet adapter for signing and approved testnet execution.
- `DEMO_MODE=true pnpm smoke:dynamic` validates Flow availability and agent wallet signing path.

## Dynamic: Best Money App

Preo is a consumer money app for everyday workers receiving payroll and routing salary into private financial categories.

Evidence:

- Custom payroll policy builder.
- Stablecoin/testnet funding paths.
- Private balances and approvals.
- Party-view privacy demo.

## Dynamic: Flow

Dynamic Flow is the primary money-in path when enabled. If Flow is not enabled for the environment, Preo keeps the UI/API path visible and returns a direct testnet deposit fallback for the hackathon demo.

Evidence:

- Flow checkout route.
- Flow webhook route.
- Smoke script reports Flow availability or fallback reason.

## Blink: Consumer Deposit UX

Blink is integrated as a secondary deposit path with server-side payload signing.

Evidence:

- Blink deposit session endpoint.
- Blink payment signing endpoint.
- Merchant private key stays server-side.
- `DEMO_MODE=true pnpm smoke:blink` validates the signer response shape.

## From-Scratch Statement

Preo was built from scratch during the hackathon. xPrime was used only as strategic inspiration for the investment/prime brokerage angle. No xPrime code, UI assets, branding, repository history, or project-specific implementation were reused.
