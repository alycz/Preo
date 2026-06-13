# Canton Deployment Quickstart

## Build DAR

```sh
pnpm daml:build
```

Output:

```text
daml/.daml/dist/preo-0.0.1.dar
```

## Upload

Upload the DAR to Canton DevNet, Seaport, or the sponsor-provided Canton environment. Record the returned package ID and JSON API URL.

## Configure

```sh
export CANTON_JSON_API_URL=
export CANTON_AUTH_TOKEN=
export CANTON_PACKAGE_ID=
```

Update the deployment artifact:

```sh
pnpm update:canton-deployment
```

## Verify

```sh
pnpm smoke:canton
curl "$NEXT_PUBLIC_APP_URL/api/health/canton"
```

If `CANTON_PACKAGE_ID` or `CANTON_JSON_API_URL` is missing and `DEMO_MODE=true`, Preo uses the demo Canton client and reports live Canton as disabled.
