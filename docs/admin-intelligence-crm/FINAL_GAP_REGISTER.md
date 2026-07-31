# Final Gap Register — Admin Intelligence & Sales CRM

**Audited:** 2026-07-28  
**Mode:** Phase 1 discovery only  
**Sources:** All documents in this folder + code evidence cited therein

## Priority legend

| P | Meaning |
|---|---------|
| P0 | Blocks safe BI / CRM — fix or isolate before relying on metrics |
| P1 | Required foundation before Intelligence / CRM phases |
| P2 | Domain modules after foundation |
| P3 | Nice-to-have / later optimisation |

---

## P0 — Must resolve before trusting Intelligence

| ID | Gap | Class | Evidence | Safe next step (later phase) |
|----|-----|-------|----------|------------------------------|
| G-P0-01 | Admin dashboard “revenue/profit” uses Tenant `Sale`/`Expense` | **Mitigated 2026-07-28** | `saasBillingKpis` + stats/overview overwrite; Sale → `tenantActivity` only | Keep Sale query removal as perf follow-up; see `phase-02/BILLING_TRUTH_HARDENING.md` |
| G-P0-02 | Dual billing planes disconnected | **Closed 2026-07-28** | Live callback ledger + historical backfill (account/branch, orphan link, unmatched report, CLI, reconciliation UI) | Unmatched orphans need manual review only; see `phase-02/BILLING_TRUTH_HARDENING.md` |
| G-P0-05 | Affiliate commission dual paths | `DUPLICATED` | Modern idempotent commissions API **not** called from PayChangu; legacy `/api/subscription/payment` path differs | Single commission completion on verified payment |
| G-P0-03 | No product AnalyticsEvent store | **Mitigated 2026-07-28** | AnalyticsOutbox/Event/facts/snapshots + producers + pipeline UI (`phase-04/`) | Apply schema (`prisma db push` or `scripts/sql/analytics-plane-phase04.sql`); expand emitters over time |
| G-P0-04 | Cross-tenant rollups without explicit scope labelling | `UNSAFE` (risk) | Dashboard aggregates all tenants | Mandate scope tags + permissions on every intel API |

---

## P1 — Shared foundation (maps to PRD Phase 2)

| ID | Gap | Class | Notes |
|----|-----|-------|-------|
| G-P1-01 | Dual admin nav (`adminNav.js` vs Sidebar masterAdmin) | `DUPLICATED` · `DISCONNECTED` | Canonicalise AdminShell only |
| G-P1-02 | Shared date-range selector | `INCOMPLETE` | Needed by all intel pages |
| G-P1-03 | Notification centre | `NOT_FOUND` / incomplete | Admin kit gap |
| G-P1-04 | Standard export dialogs | `INCOMPLETE` | Ad-hoc per page |
| G-P1-05 | Admin i18n (en/ny) | `INCOMPLETE` | Admin mostly hardcoded English |
| G-P1-06 | Fine-grained `intel.*` / `crm.*` permissions | `NOT_FOUND` | Extend `SYSTEM_ADMIN_PERMISSIONS` |
| G-P1-07 | SaaS revenue query pack (documented + tested) | `INCOMPLETE` | Must never join Tenant Sale totals |

---

## P2 — Domain gaps (Intelligence + CRM)

| ID | Domain | Status | Confirmed source today? |
|----|--------|--------|-------------------------|
| G-P2-01 | Executive Intelligence KPIs | Missing correct SaaS definitions | Partial tenant counts; revenue **unsafe** |
| G-P2-02 | Revenue Intelligence | Needs Platform* reconciliation | Partial |
| G-P2-03 | Customer Intelligence / Health | No health model | No |
| G-P2-04 | Product / Feature Analytics | No event store | Instrumentation required |
| G-P2-05 | Customer Success workflows | No domain | No |
| G-P2-06 | Support Management (tickets) | No SupportTicket | Support-access ≠ tickets |
| G-P2-07 | Infrastructure monitoring centre | Partial health routes | Incomplete |
| G-P2-08 | Audit & Security intelligence | Partial surfaces | Extend, don’t replace |
| G-P2-09 | Marketing Analytics / attribution | No campaign models | No |
| G-P2-10 | Lead Management | No Lead models | No |
| G-P2-11 | Sales CRM / Pipeline / Activities / Calls / Tasks / Calendar | None | No |
| G-P2-12 | Demos / Proposals | None | No |
| G-P2-13 | Lead → Tenant conversion | Manual tenant create only | Partial human process |
| G-P2-14 | Onboarding / Training projects | None | No |
| G-P2-15 | Sales reporting / forecasting | None | Blocked on pipeline history |
| G-P2-16 | AI Business Intelligence | Blocked | Evidence incomplete |

See `CRM_GAP_REGISTER.md` and `ANALYTICS_GAP_REGISTER.md` for workflow/metric detail.

---

## What already exists (reuse — do not rebuild)

| Asset | Classification | Use in later phases |
|-------|----------------|---------------------|
| AdminShell + `adminNav` + permissions | `KEEP` / `EXTEND` | Phase 2 shell |
| `components/admin/*` kit | `REUSE` | Tables, charts, modals |
| Tenant / User / Affiliate APIs | `KEEP` | Customer graph + channel |
| Platform billing models + admin UI | `KEEP` / `EXTEND` | SaaS financial truth |
| MRA EIS entitlement + commercial plans | `KEEP` | Separate compliance vs commercial metrics |
| PlatformSupportAccess + AdminAuditLog | `KEEP` | Security / conversion audit patterns |
| COA stub redirect + tests | `KEEP` | Never reintroduce System CoA |

---

## What must be refactored (not greenfield)

| Item | Action |
|------|--------|
| `/api/admin/dashboard/stats` revenue semantics | `REFACTOR` or replace endpoint for SaaS KPIs |
| Affiliate dual entry routes | Verify & `CONSOLIDATE` |
| Audit vs audit-logs pages | Verify & `CONSOLIDATE` |
| PayChangu → PlatformPayment linkage | `REFACTOR` write path for completeness |

## What must be reimplemented / newly built

| Item | Why |
|------|-----|
| Lead / CRM domain | `NOT_FOUND` |
| AnalyticsEvent + snapshots | `NOT_FOUND` |
| SupportTicket domain | Distinct from support-access |
| Customer health scoring | No model + missing signals |
| Intelligence route tree `/insightbooks/intelligence/**` | `NOT_FOUND` |
| CRM route tree `/insightbooks/crm/**` | `NOT_FOUND` |

## Safest implementation order (post Phase 1)

1. **Phase 2** — Shared admin foundation (shell, filters, date range, permissions, i18n hooks)  
2. **Billing truth hardening** — Platform* write guarantee + SaaS KPI service (fixes G-P0-01/02)  
3. **Phase 13 patterns** — Extend audit/security intelligence on existing logs (low schema risk)  
4. **Instrumentation** — AnalyticsEvent design + ingest (unlocks product/health later)  
5. **PRD Phases 3–9** — Executive / Revenue / Customer intel using verified sources only  
6. **PRD Phases 14–19** — CRM foundation → pipeline → activities → demos → proposals  
7. **Conversion bridge** — Lead → Tenant + subscription hooks (idempotent)  
8. **Onboarding / Training / Success / Support** — after CRM conversion path exists  
9. **AI layer** — only after metric evidence packs exist  

## Explicit non-gaps (verified OK)

| Item | Status |
|------|--------|
| System Chart of Accounts admin UI removed from nav | Verified — stub redirect remains |
| Tenant Chart of Accounts | Intact at `/chart-of-accounts` |
| Platform control plane separation (intent) | Present; must not add Tenant GL posting |

## Phase 1 completion vs completion gate

| Gate | Status |
|------|--------|
| Every PRD metric has confirmed source **or** instrumentation requirement | **Met** in `ANALYTICS_GAP_REGISTER.md` |
| Every CRM workflow has status | **Met** in `CRM_GAP_REGISTER.md` |
| Target architecture documented | See `TARGET_ARCHITECTURE.md` |
| Feature implementation deferred | **Yes** — no CRM/BI modules built in this phase |
