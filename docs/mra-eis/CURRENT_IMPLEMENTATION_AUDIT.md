# Current Implementation Audit (InsightBooks EIS)

**Date:** 2026-07-22  
**Scope:** Forensic inventory before full reimplementation. **No code changes in this phase.**

## 1. Surface area

| Area | Location | Notes |
|---|---|---|
| Client config | `lib/eisConfig.js` | Sandbox/prod bases; endpoint list (partial vs current swagger — missing credit/debit, void, tin-auth, some utilities) |
| API client | `lib/eisService.js` | Activate, confirm (partial), configs, sales submit, stock helpers; uses `Bearer` token |
| Tenant UI | `app/eis/*` | Dashboard, config, invoices pages |
| Internal APIs | `app/api/eis/**` | activate, config, invoices/submit, stock, products, health, cron sync, etc. |
| Admin | `app/api/admin/eis-subscriptions*` | Subscription gating |
| Cron | `app/api/cron/eis-sync` | Background sync |
| Receipt / verify | `components/PrintableReceipt.js`, `app/verify/[id]` | QR / verification touchpoints |
| Docs (stale) | `docs/MRA_EIS_Documentation.md`, `docs/EIS_Implementation_Guide.md` | Do not use as contract |
| Data model | Prisma `EISInvoice`, `EISConfiguration`, `EISSubmissionLog`, `EISUsage` | OAuth-era credential fields |
| Tenant fields | `Tenant.eisApiKey`, `eisClientSecret` | Misaligned with terminal JWT + secretKey |

## 2. Credential model (gap)

Current `EISConfiguration` stores `clientId`, `clientSecret`, `apiKey` — OAuth-style.  
Official API issues **terminal JWT** + **secretKey** from activation.

Implication: reimplementation must redesign secret storage, encryption, and rotation around terminal credentials (master prompt § secrets).

## 3. Contract alignment (high level)

| Capability | Legacy status vs official API |
|---|---|
| Endpoint paths (core) | Partially aligned |
| Activation confirmation HMAC | Present in client skeleton; correctness unverified |
| Invoice number | **Wrong format** vs guide (decimal vs Base64/Julian) |
| Auth header | Always `Bearer ` — may conflict with guide samples |
| `x-eis-message-hash` | Not implemented (and Unverified officially) |
| Credit/debit / void | Missing or incomplete vs swagger |
| Offline signature | Partial field support; algorithm unverified |
| Config versioning | Stored in `settings` JSON |
| Two-level enablement (admin + tenant) | Subscription APIs exist; full governance TBD |
| Posting-engine coupling | Not EIS-first lifecycle as master prompt requires |
| Outbox / rich state machine | Submission log exists; states not full master-prompt set |

## 4. Search hits (keywords)

Repository contains substantial EIS/MRA references (libs, APIs, POS, invoices, prisma, docs). Treat **official pack** under `docs/mra-eis/` as authority for external contract; treat this audit as inventory of what to replace/migrate.

## 5. Explicit non-actions (this phase)

- No toggle flips
- No POS fiscal transmit changes
- No schema migrations
- No swagger inventing
