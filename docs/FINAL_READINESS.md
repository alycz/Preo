# Final Readiness

Last local readiness pass: June 13, 2026 11:48 AM America/New_York with `DEMO_MODE=true pnpm verify:demo`.

## Complete

- Demo-mode app runs with `DEMO_MODE=true` and `DATABASE_URL`.
- Daml privacy model, policy, payroll credit, allocation, approvals, payments, portfolio records, and audit events are implemented.
- Dynamic login/provider, Flow scaffold, webhook, and agent wallet paths exist.
- Blink session and server-side signer paths exist.
- EVM vault contracts, tests, deployment script, and live smoke checks exist.
- Health endpoints expose readiness for Canton, Dynamic, Blink, settlement, and database.

## Credentials Austin Adds

- Dynamic: `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID`, `DYNAMIC_ENVIRONMENT_ID`, `DYNAMIC_AUTH_TOKEN`, optional Flow checkout and webhook secret.
- Dynamic wallet: metadata/key shares/password or `DYNAMIC_AGENT_PRIVATE_KEY`.
- Blink: `BLINK_MERCHANT_ID`, `NEXT_PUBLIC_BLINK_MERCHANT_ID`, `BLINK_MERCHANT_PRIVATE_KEY`.
- Canton: `CANTON_JSON_API_URL`, `CANTON_AUTH_TOKEN`, `CANTON_PACKAGE_ID`, optional party IDs.
- Settlement: `SETTLEMENT_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `TESTNET_USDC_ADDRESS`, `PREO_FUNDING_VAULT_ADDRESS`.

## Verify Sponsors

```sh
pnpm smoke:live-readiness
pnpm smoke:canton
pnpm smoke:dynamic
pnpm smoke:blink
pnpm smoke:evm
pnpm smoke:full-flow
```

Runtime checks:

```text
/api/health/readiness
/api/health/canton
/api/health/dynamic
/api/health/blink
```

## Deployment Placeholders

```text
App URL: TBD
Canton package ID: TBD
PreoFundingVault address: TBD
Testnet USDC address: TBD
Demo video URL: TBD
```

## Unavoidable Sponsor-Side Items

- Dynamic Flow may require sponsor checkout enablement.
- Blink live deposit behavior may require merchant approval.
- Canton DevNet package ID requires Austin or sponsor environment access.
- Settlement RPC/deployer key must be supplied by Austin.
