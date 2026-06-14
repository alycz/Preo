# Preo — Design Audit & Redesign Specification

> Privacy-first agentic payroll neobank · Impeccable-methodology audit
> Target: a category-defining fintech experience that could sit beside Stripe, Mercury, and Plasma.
> Direction: **refined premium *light* theme** evolving the existing teal.

---

## 1. Executive Summary

Preo is **not AI slop** — the product thinking is genuinely good. The headline is specific, the privacy thesis is differentiated, there's no gradient abuse, no floating clutter, no stock illustration. The problem is the opposite of slop: it's **bland and under-designed.** It reads as a competent internal tool, not a bank you'd wire $100,000 to. Every surface uses system Arial, a single flat teal, one blanket shadow, and uniform 7px corners. There is no motion, no footer, no trust architecture, and the navigation dumps eight app routes next to "Overview."

The good news: the entire UI is driven by **one stylesheet and one component file**, every element uses semantic class names, so a disciplined design-system overhaul cascades to all nine pages at once. The leverage here is unusually high.

### Scores

| Dimension | Score | One-line justification |
|---|---|---|
| **Design** | **4.5 / 10** | Clean and legible, but generic — system fonts, flat palette, no hierarchy beyond size, zero motion. |
| **Trust** | **3.5 / 10** | A neobank with no footer, no compliance/disclosure architecture, no security signals, raw JSON on screen. Fails the "$100k test." |
| **Conversion** | **4 / 10** | One weak CTA pair, no trust band, no social proof, no narrative — the hero asks for commitment before earning it. |
| **Originality** | **3 / 10** | Indistinguishable from a thousand teal SaaS dashboards. The strong privacy idea is never expressed *visually*. |

### Three biggest weaknesses
1. **No visual identity.** Arial + one teal + flat cards = no brand. The privacy/Canton thesis — the most interesting thing about Preo — is invisible in the design.
2. **No trust architecture.** No footer, no disclosure, no security framing, JSON dumps and shouty uppercase tables on a *banking* product. Nothing answers "is my money safe here?"
3. **Undifferentiated hierarchy & rhythm.** Everything is the same weight, the same radius, the same shadow, the same spacing. Nothing leads the eye; nothing feels intentional.

### Three biggest opportunities
1. **Install a real design system** (type scale, brand ramp, elevation, spacing, motion). Highest impact, lands across all nine pages from one file.
2. **Build the marketing surface** the product deserves — a living hero ledger, a trust band, specific storytelling, a real footer. This is where conversion and credibility are won.
3. **Make privacy *visible*.** Turn "Private on Canton" from a gray pill into a recurring, designed trust motif — the thing that makes Preo unmistakably Preo.

---

## 2. Page-by-Page Audit

Every screen is measured against the same bar: *would I trust this company with $100,000, and would it look out of place next to Stripe / Mercury / Plasma?*

### `/` — Landing
- **Strengths:** specific, non-clichéd headline; product-relevant hero visual (allocation ledger); restraint — no clutter.
- **Weaknesses:** hero ledger is static and lifeless; "How it works" steps are generic enough to describe any payroll tool; "Built with" + "Why privacy" are cramped into one thin band; **no footer; no trust/credibility band; one timid CTA pair.**
- **Critical:** the page asks for action ("Create payroll policy") before building any trust. A first-time visitor has no reason to believe this is safe or real.
- **Redesign:** rewrite hero copy; animate the ledger with tabular figures + a privacy seal; add a dedicated **trust band**; expand "How it works" into specific, differentiated steps with motion; add a real **footer** with disclosure.

### `/onboarding` — Create account
- **Strengths:** clear two-panel structure (sign-in → status); honest about demo state.
- **Weaknesses:** the "Account status" panel is a wall of `code`-styled IDs (Canton party, agent wallet) — reads like a debugger, not an onboarding.
- **Critical:** onboarding is the highest-trust moment in any bank; this one shows raw contract IDs and "Pending" strings with no reassurance.
- **Redesign:** progressive, reassuring status (stepper / checklist), human language, contract IDs demoted to an optional "technical detail" disclosure.

### `/policy` — Policy builder
- **Strengths:** genuinely strong product surface — allocation %, live preview, approval rules. This is the heart of the app.
- **Weaknesses:** dense rows of equal-weight inputs; the allocation preview is a plain list; the "100%" validation pill is easy to miss; saved contract ID dumped as raw text.
- **Redesign:** give the allocation preview a real **visual breakdown** (proportion bars), make the 100% constraint a prominent live indicator, refine the category-editor rhythm and focus states.

### `/fund` — Fund payroll
- **Strengths:** three funding paths clearly separated; honest demo/live labeling.
- **Weaknesses:** `JsonBlock` previews of Blink payloads shown inline; `compact-facts` of internal endpoint paths (`/api/blink/sign-payment`) surfaced to users.
- **Redesign:** keep the three-column clarity, but hide engineering detail behind a "developer detail" disclosure; restyle as confident deposit cards.

### `/dashboard` — Command center
- **Strengths:** good information model — metrics, balances, runs, activity.
- **Weaknesses:** **two of four panels are raw `JSON.stringify` dumps** (active policy, activity log). The 1.7rem metric numbers are under-scaled for a "command center." Nothing here says "premium bank."
- **Critical:** this is the screen a user lives in; JSON on screen is the single most trust-corroding element in the app.
- **Redesign:** elevate metric cards with tabular display figures; render policy + activity as designed, human views with the raw JSON behind a collapsible "technical detail."

### `/approvals` — Approve sensitive actions
- **Strengths:** the approval-card model (status · facts · actions) is sound; good use of tone on the status pill.
- **Weaknesses:** uppercase micro-labels, equal-weight buttons (Approve / Reject / Execute all look alike), latest-execution JSON dump.
- **Redesign:** establish button hierarchy (primary Approve, quiet Reject, distinct Execute), refine the card, demote the JSON.

### `/portfolio` — Allocation records
- **Strengths:** clear total + per-allocation list; honest "no real trading" disclosure.
- **Weaknesses:** mini-cards are visually flat; `sourceRunId` shown as raw code; only two metrics, weakly styled.
- **Redesign:** restyle allocation cards with model identity + tabular amounts; demote run IDs.

### `/privacy-demo` — Party perspectives
- **Strengths:** **the most differentiated, conceptually strongest page** — switching Canton party views is the product's whole thesis made tangible.
- **Weaknesses:** the role switcher is a row of mismatched buttons; can-see / cannot-see are plain bulleted lists; the visible-contracts table is the shouty-uppercase default.
- **Critical:** this page *is* the trust argument and it's the least designed. Enormous wasted opportunity.
- **Redesign:** a polished **segmented control** for roles; can-see / cannot-see as a designed visibility comparison; the contract table restyled to feel like evidence, not a log.

### `/demo` — Judge demo controls
- **Strengths:** does its job — seed / full-flow / reset in one place.
- **Weaknesses:** utilitarian; result is a JSON dump.
- **Redesign:** light polish only (it's an internal/judge surface) — apply the new button hierarchy and demote the JSON.

---

## 3. AI-Slop & Anti-Pattern Findings

Per the Impeccable lens — concrete instances and what an elite team does instead.

| Finding | Where | Why it's weak | Elite move |
|---|---|---|---|
| **System Arial everywhere** | `globals.css` body | The single biggest "unpolished" tell. No typographic voice. | Self-hosted premium grotesk + a tabular-figure mono for money. |
| **Flat single shadow** | one `--shadow` blanket | Same elevation on hero card and tiny pill = no depth logic. | A 4-step elevation scale used intentionally. |
| **Uniform 7–8px radius** | every element | Sameness reads as template. | A radius scale tied to component size. |
| **One flat teal** | `--accent` | No range, no sophistication, no brand. | A brand ramp (50→900) with an ink-teal text accent + one restrained gradient. |
| **JSON dumps on screen** | dashboard, fund, approvals, portfolio, demo | Looks like a debugger; corrodes financial trust. | Designed human views; raw JSON behind a "technical detail" disclosure. |
| **Shouty uppercase micro-tables** | global `th` | "Engineer console," not "bank." | Sentence-case headers, hover rows, monospace amounts. |
| **Feature-dump navbar** | `AppChrome` (8 links) | Mixes marketing + app; no hierarchy; overwhelming on `/`. | Split: lean marketing header vs. condensed app header. |
| **No motion** | entire app | Static = inert = cheap. | Hover/active states + reduced-motion-safe scroll reveals. |
| **No footer** | entire app | Every benchmark bank has one; absence reads unfinished. | Real footer with product/privacy/built-with links + disclosure. |
| **Static hero visual** | `hero-ledger` | The product's signature object just… sits there. | Animated allocation, tabular figures, privacy seal. |

---

## 4. Design-System Proposal

A refined **premium light** system evolving the existing teal. All tokens land in `globals.css`; fonts wire through `layout.tsx` via `next/font`.

### Typography
- **UI / body:** a refined grotesk (Inter or Geist), self-hosted, tightened tracking on headings, looser line-height on body.
- **Figures / ledger / IDs:** Geist Mono (or JetBrains Mono) with `font-feature-settings: "tnum" 1` so decimals align — non-negotiable for a money product.
- **Display:** same family, heavy weight, negative letter-spacing for hero numerals.
- **Scale (tokens):** `--text-xs … --text-6xl` replacing today's ad-hoc `clamp()`/rem; tight leading for display, generous for prose.

### Color (evolve teal, premium light)
- **Neutrals:** layered system — `--surface-page` (warm off-white) / `--surface-raised` (white) / `--surface-sunken`; **hairline** borders, not heavy lines.
- **Ink:** deepen to a cool near-black; re-tune `--muted` to pass AA.
- **Brand:** a teal ramp `--brand-50…900` — ink-teal for text accents, vivid teal for primary CTAs, **one** restrained teal→emerald gradient reserved for a single hero/CTA moment. **No purple-blue.**
- **Semantic:** keep ok / warn / danger, re-tuned into the new palette.

### Elevation · Radius · Spacing · Motion
- **Elevation:** 4 steps — hairline ring → sm → md → lg — applied by depth logic, not blanket.
- **Radius:** `--radius-sm 8 / md 12 / lg 16 / pill 999`.
- **Spacing:** formal 4px scale `--space-1…12` for consistent rhythm.
- **Motion:** transition tokens; hover/active on buttons, cards, nav, rows; CSS-first scroll reveals via a tiny `IntersectionObserver` hook (**no framer-motion dependency**); **all gated behind `prefers-reduced-motion`.**

### Grid & Accessibility
- Consistent max-width container + gutters; `:focus-visible` rings throughout; AA contrast; semantic landmarks (`header` / `main` / `footer`).

### Component system (restyle, don't replace)
Existing primitives stay and inherit the system: `PageHeader`, `Metric`, `StatusPill`, `Notice`, `ContractTable`, `JsonBlock`, `Toggle`. New: marketing-vs-app header variants, `.trust-band`, `.footer`, segmented control, allocation bars, "technical detail" disclosure.

---

## 5. Copy Rewrites

Removing generic phrasing; sharpening the privacy thesis. (Final wording tuned during implementation.)

- **Hero eyebrow:** keep the partner triad but quieter — `Canton · Dynamic · Blink`.
- **Hero headline (current):** "Preo is the privacy-first agentic payroll neobank."
  **Direction:** lead with the *benefit + secret* — e.g. *"Your paycheck, split and invested automatically — and no one can see how."* (privacy as the hook, not the category label).
- **Hero subhead:** concrete — receive stablecoin payroll, define your own categories, an agent allocates every paycheck, balances stay private on Canton.
- **CTAs:** primary "See the privacy demo" (earn trust first) + secondary "Build a payroll policy" — reversing today's commitment-first ordering.
- **"How it works"** (today: *Receive salary → Define categories → Agent allocates → Canton keeps balances private* — too generic):
  rewrite to specific, differentiated steps that name *what's private from whom* and *what the agent actually does*.
- **Privacy statement:** keep the strong existing line ("Your employer should not see your investments…") and promote it to a hero-level trust motif.
- **Footer (new):** product · privacy · built-with links + a plain-English testnet / non-custodial disclosure + copyright.

---

## 6. Implementation Plan — ranked by impact × effort

### Quick wins (high impact, low effort)
1. **Fonts** — swap Arial for a grotesk + tabular mono. *Single biggest perceived-quality jump.*
2. **Token overhaul** — color ramp, elevation scale, radius scale, spacing scale in `globals.css`. Cascades everywhere.
3. **Demote JSON** — wrap every `JsonBlock` in a collapsed "technical detail" disclosure. Instant credibility lift.
4. **Table/button polish** — sentence-case headers, hover rows, button hierarchy.

### Medium effort (high impact)
5. **Header split** — marketing header on `/`, condensed app header elsewhere.
6. **Footer + trust band** — new, table-stakes credibility surfaces.
7. **Hero redesign** — living allocation ledger, rewritten copy, privacy seal.
8. **Motion layer** — hover/active states + reduced-motion-safe reveals.

### Major (high impact, higher effort)
9. **Privacy-demo redesign** — segmented control + designed visibility comparison (the thesis page).
10. **Dashboard & policy** — elevated metrics, visual allocation breakdown, human policy/activity views.

---

*End of audit. Awaiting approval before implementation (Deliverable 2).*
