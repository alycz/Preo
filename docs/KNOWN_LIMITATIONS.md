# Known Limitations

- Preo is a testnet hackathon prototype, not a regulated banking product.
- It does not provide FDIC insurance, real bank accounts, or production payroll rails.
- Stablecoin payroll is simulated or testnet-based.
- EVM settlement is evidence only; Canton is the private accounting ledger.
- The backend attests EVM/Dynamic/Blink settlement evidence into Canton. This is not a trustless bridge.
- Dynamic Flow requires sponsor/environment enablement. If unavailable, the app returns `flow_scaffold_ready` or direct testnet deposit fallback rather than claiming a real Flow transaction.
- Blink live deposit behavior depends on merchant approval and live credentials. Demo mode validates the signer path.
- Portfolio allocation is private and simulated/testnet-only. It is not real securities trading or financial advice.
- Dynamic server wallet execution may return simulated tx hashes in `DEMO_MODE=true` when live wallet credentials are absent.
- The demo uses SQLite locally. Vercel `/tmp` SQLite is acceptable for a short demo but can reset; use Railway/Render/Fly persistent SQLite or a hosted database for stable judging.
- Use Node 20 or 22 for Hardhat/deployment. Hardhat warns on Node 25 even when local tests pass.
- Canton DevNet/package deployment metadata may be absent in demo mode; local Daml tests remain the canonical contract verification.
