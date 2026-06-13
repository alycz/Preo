# Demo Script

Target length: 2 to 5 minutes.

## Narration

1. "This is Preo, a privacy-first agentic payroll neobank for everyday workers."
2. "A worker signs in with Dynamic."
3. "They define their own salary policy: custom categories, custom percentages, and custom approval rules."
4. "Payroll arrives through Dynamic Flow or direct testnet fallback. Blink is also available as one-tap funding."
5. "Preo credits the worker's private Canton account."
6. "The policy-bound payroll agent allocates salary automatically."
7. "A portfolio or external action requires approval, so the worker approves it."
8. "A Dynamic server wallet executes the approved testnet action and returns a transaction hash."
9. "Now we switch Canton party views."
10. "The user sees everything. The employer only sees payroll sent. The recipient only sees their payment. The operator sees limited audit metadata. Another user sees nothing."

## Click Path

1. Open deployed Preo URL.
2. Sign in or use demo identity.
3. Show the policy builder.
4. Create or load a policy:
   - Rent: 35%, external payment, no approval.
   - Emergency Fund: 20%, internal reserve.
   - Portfolio: 30%, portfolio allocation, approval required.
   - Spending: 15%, manual hold.
5. Trigger payroll through demo employer payroll or direct testnet funding.
6. Run allocation.
7. Open approvals and approve the pending portfolio action.
8. Execute the approved agent action.
9. Show the tx hash or demo tx hash.
10. Switch through party views:
   - User sees policy, balances, allocation, approval, receipt, portfolio.
   - Employer sees payroll notice only.
   - Recipient sees payment receipt only.
   - Operator sees audit event only.
   - Other user sees no sensitive contracts.

## Recording Checklist

- [ ] Start on the app, not slides.
- [ ] Say "testnet hackathon prototype."
- [ ] Show custom categories and percentages.
- [ ] Show funding path with Dynamic Flow fallback and Blink option.
- [ ] Show allocation and approval.
- [ ] Show transaction hash or clearly simulated demo hash.
- [ ] Show all five party views.
- [ ] Mention Canton as the private ledger and EVM as settlement evidence.
- [ ] Mention Dynamic and Blink sponsor usage.

## Submission Text

Preo is a privacy-first agentic payroll neobank for everyday workers. Users receive stablecoin payroll and define custom salary policies. Preo's deterministic payroll agent allocates each paycheck into private user-defined categories, creates approval requests for sensitive actions, and uses Dynamic server wallets for approved testnet execution. Canton provides the private neobank ledger, so employers, recipients, operators, and unrelated users only see the contracts relevant to them. Dynamic powers onboarding and Flow-based money-in, while Blink adds one-tap deposit UX.
