# Deployment

The fastest ETHGlobal submission path is a single Vercel deployment of the Next.js app/API in `DEMO_MODE=true`. For a stable judging environment, prefer Railway/Render/Fly with persistent SQLite storage, or a hosted database migration after the hackathon. Live sponsor credentials can be added later without changing the app flow.

## Submission Placeholders

```text
Deployed app URL: TBD
Backend URL: same as app URL
Canton package ID: TBD or demo-mode fallback
Canton deployment record: daml/deployments/canton-devnet.json
PreoFundingVault address: TBD or demo-mode fallback
Testnet USDC address: TBD or demo-mode fallback
Demo video URL: TBD
GitHub repo URL: TBD
```

## Vercel App/API Deployment

Deploy from the repo root.

```sh
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm build
```

Vercel settings:

```text
Framework preset: Next.js
Build command: pnpm build
Install command: pnpm install --frozen-lockfile
Output directory: apps/web/.next
Root directory: repo root
```

Required demo env:

```text
NEXT_PUBLIC_APP_URL=https://<vercel-app-url>
DATABASE_URL=file:/tmp/preo-demo.db
DEMO_MODE=true
```

For the fastest judged demo, keep optional live integration values empty. The app will show Flow fallback, demo Blink payload signing, demo Canton contract IDs, and simulated Dynamic agent tx hashes. In `DEMO_MODE=true` with `DATABASE_URL=file:/tmp/preo-demo.db`, the API lazily initializes the demo SQLite schema on first use so Vercel serverless functions have a writable database path.

Database options:

- Fast demo: Vercel with `DATABASE_URL=file:/tmp/preo-demo.db`; expect resets across cold starts.
- Stable demo: Railway/Render/Fly with a persistent SQLite path.
- Best production-style path: migrate Prisma to hosted Postgres such as Neon or Supabase after judging.

## Optional Live Integration Env

Dynamic:

```text
NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=
DYNAMIC_ENVIRONMENT_ID=
DYNAMIC_AUTH_TOKEN=
DYNAMIC_WEBHOOK_SECRET=
DYNAMIC_FLOW_CHECKOUT_ID=
DYNAMIC_AGENT_WALLET_PASSWORD=
DYNAMIC_AGENT_WALLET_ADDRESS=
DYNAMIC_AGENT_WALLET_METADATA_JSON=
DYNAMIC_AGENT_KEY_SHARES_JSON=
DYNAMIC_WALLET_BACKUP_TO_DYNAMIC=false
DYNAMIC_AGENT_PRIVATE_KEY=
LIVE_DYNAMIC_TX=false
```

Canton:

```text
CANTON_JSON_API_URL=
CANTON_JSON_API_VERSION=v2
CANTON_AUTH_TOKEN=
CANTON_PACKAGE_ID=
CANTON_OPERATOR_PARTY=
CANTON_EMPLOYER_PARTY=
CANTON_RECIPIENT_PARTY=
CANTON_OTHER_USER_PARTY=
ALLOW_CANTON_DEMO_FALLBACK=true
LIVE_CANTON_REQUIRED=false
```

Blink:

```text
BLINK_MERCHANT_ID=
BLINK_MERCHANT_PRIVATE_KEY=
BLINK_WEBHOOK_SECRET=
NEXT_PUBLIC_BLINK_MERCHANT_ID=
LIVE_BLINK_REQUIRED=false
```

Settlement/EVM:

```text
SETTLEMENT_CHAIN_ID=84532
SETTLEMENT_RPC_URL=
TESTNET_USDC_ADDRESS=
PREO_FUNDING_VAULT_ADDRESS=
DEPLOYER_PRIVATE_KEY=
DEPLOY_MOCK_USDC=true
LIVE_EVM_REQUIRED=false
```

Do not commit private keys or live credentials.

## Daml Build And Local Sandbox

```sh
cd daml
daml build
daml test
daml sandbox --json-api-port 7575 .daml/dist/preo-0.0.1.dar
```

If using newer Canton/DPM tooling:

```sh
dpm build
dpm test
dpm codegen-js
dpm sandbox --json-api-port 7575
```

Record DevNet or sponsor-approved deployment metadata in:

```text
daml/deployments/canton-devnet.json
```

Then set:

```text
CANTON_PACKAGE_ID=<deployed package id>
CANTON_JSON_API_URL=<json api url>
```

Or update the artifact directly:

```sh
CANTON_PACKAGE_ID=... CANTON_JSON_API_URL=... pnpm update:canton-deployment
```

### Canton Live Readiness

Ready when `CANTON_PACKAGE_ID` and `CANTON_JSON_API_URL` are populated. If they are not populated and `DEMO_MODE=true`, the app uses the demo Canton client. Check live visibility with:

```sh
pnpm smoke:canton
curl "$NEXT_PUBLIC_APP_URL/api/health/canton"
```

## EVM Vault Deployment

Use Node 20 or 22 for Hardhat. Node 25 can pass local tests but Hardhat warns that it is unsupported.

```sh
pnpm contracts:compile
pnpm contracts:test
SETTLEMENT_RPC_URL=... DEPLOYER_PRIVATE_KEY=... pnpm deploy:contracts:settlement
```

The deploy script writes:

```text
contracts/deployments/preo-funding-vault.json
```

Copy the vault and token addresses into deployment env.

To create a test deposit into the vault:

```sh
PREO_USER_ID=<preo-user-id> AMOUNT=25.00 DYNAMIC_AGENT_PRIVATE_KEY=... pnpm demo:direct-vault-deposit
```

## Demo Seeding And Smoke Tests

```sh
pnpm prisma:generate
pnpm verify:demo
pnpm smoke:live-readiness
```

Health endpoints:

```text
/api/health/readiness
/api/health/canton
/api/health/dynamic
/api/health/blink
```

## Final Submission Checklist

- [ ] Public GitHub repo URL added to submission.
- [ ] Vercel deployed app URL added to submission.
- [ ] `DEMO_MODE=true` configured on Vercel.
- [ ] `NEXT_PUBLIC_APP_URL` points to the Vercel URL.
- [ ] `DATABASE_URL=file:/tmp/preo-demo.db` configured for deployed demo app.
- [ ] Daml contracts compile and `pnpm daml:test` passes.
- [ ] Canton DevNet/package ID recorded, or demo-mode fallback clearly documented.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm contracts:test` passes.
- [ ] Demo-mode smoke tests pass.
- [ ] Dynamic login/Flow path or fallback visible.
- [ ] Blink deposit path visible.
- [ ] Agent execution returns a live or clearly simulated tx hash.
- [ ] Party-view privacy demo works.
- [ ] Demo video recorded and linked.
- [ ] Sponsor mapping included in README and submission.
