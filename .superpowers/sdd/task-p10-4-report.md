# Task P10-4 Report — Wave 4 Handoffs + Foundations + Phase 11 Pack

**Status:** DONE_WITH_CONCERNS  
**Commits:** `WORKING_TREE` (no commits, per brief)  
**Branch:** `v2`  
**Date:** 2026-07-30  
**Base:** Waves 1–3 Support domain already in working tree

---

## What was implemented

Extends Phase 10 Support Ops with link-only handoffs, reconciliation/export foundations, KB/Problem/CSAT/Automation stubs, thin UI pages, and Phase 11 pack docs — without email ingest, WhatsApp, portal, full KB/CSAT, AI replies, XLSX/PDF, or billing/MRA/GL/CsCase mutation on handoff create.

### Library (`lib/admin/support/*`)

| File | Responsibility |
|------|----------------|
| `handoffs.js` | create/list; sanitize payload; record-only meta flags |
| `reconciliation.js` | ticket/history/messages/SLA checks; honesty helper; optional persist |
| `export.js` | JSON/CSV tickets; export permission recheck; audit soft-fail |
| `foundations.js` | KB / Problem / CSAT / Automation contracts |
| `catalogue.js` | handoff targets, reliability gates, foundation kinds |
| `authz.js` | `canExport`, `canRunReconciliation`, `canCreateHandoffs` |
| `index.js` | Wave 4 public exports |

### Prisma

- `SupportHandoff`, `SupportReconciliationRun`, `SupportExportAudit`
- Relations on `SupportTicket` + `Admin`

### SQL fallback

- `scripts/sql/support-ops-phase10-wave4.sql` — IF NOT EXISTS + FK `DO $$` blocks

### APIs

| Method | Route |
|--------|-------|
| GET/POST | `/api/admin/support/tickets/[id]/handoffs` |
| GET | `/api/admin/support/handoffs` |
| GET/POST | `/api/admin/support/reconciliation` |
| GET | `/api/admin/support/export` |
| GET | `/api/admin/support/foundations` |

### UI

- `/insightbooks/support/handoffs`, `reports`, `foundations`
- `components/admin/support/Support{Handoffs,Reports,Foundations}View.jsx`
- `supportNav.js` sections + NAV_PERMISSION_MAP + i18n en/ny

### Docs

- `docs/admin-intelligence-crm/phase-10/FINAL_PHASE_10_REPORT.md` — **READY_FOR_PHASE_11_WITH_BLOCKERS**
- `docs/admin-intelligence-crm/phase-10/PHASE_11_INPUTS.md`
- `docs/admin-intelligence-crm/phase-10/README.md` wave statuses → Complete

### Not implemented (correctly deferred)

Email-to-ticket, WhatsApp, portal inbound, full KB UI, live CSAT scores, AI replies, XLSX/PDF, Android support plane, CoA admin revival, billing/MRA/GL/CsCase mutation on handoff.

---

## Acceptance checklist

- [x] Handoffs link-only; no source mutation (CsCase/subscription/GL spies uncalled in tests)
- [x] Exit READY_FOR_PHASE_11_WITH_BLOCKERS documented
- [x] Related vitest PASS (+ prior support suites green)

---

## Test commands + results

```bash
npx vitest run test/systemAdmin.support.handoffs.test.js test/systemAdmin.support.reconciliation.test.js test/systemAdmin.support.sla.test.js test/systemAdmin.support.tickets.test.js test/systemAdmin.support.messages.test.js test/systemAdmin.support.assignment.test.js test/systemAdmin.supportAccess.test.js test/systemAdmin.navPermissionMap.test.js
```

```
Test Files  8 passed (8)
     Tests  66 passed (66)
```

| Suite | Focus |
|-------|--------|
| `systemAdmin.support.handoffs.test.js` | Link-only create, sanitize, foundations, nav |
| `systemAdmin.support.reconciliation.test.js` | Recon gates, no false zeroes, export ACL/CSV |
| Prior support suites | Waves 1–3 regression sample |

---

## Self-review

### Strengths

- Handoff create is explicitly record-only with forbidden-key stripping and meta flags.
- Recon honesty blocks numeric KPIs on failure (`null`, not `0`).
- Foundations refuse invented CSAT scores.
- Prior Wave 1–3 suites remain green.

### Concerns (non-blocking)

1. **Prisma generate / db push** — Wave 4 SQL/schema added; local DB may need `prisma db push` or wave4 SQL apply if query engine EPERM persists (same pattern as Waves 2–3).
2. **Global handoffs GET** — convenience for UI beyond brief’s ticket-scoped route; create remains ticket-scoped POST.
3. **Export depends on `listTickets`** — capped foundation pack, not a streaming dump.
4. **Vitest process** — suite reported 66/66 pass; runner sometimes hangs after summary on this Windows host (observed; not a test failure).

### Hard-rule confirmation

- No billing / MRA / Tenant GL / CsCase mutation on handoff create  
- No fabricated CSAT  
- No false zeroes on recon failure  
- Email/WhatsApp/portal deferred  
- CoA admin stays removed  

---

## Exit

**READY_FOR_PHASE_11_WITH_BLOCKERS** (see FINAL_PHASE_10_REPORT.md)

---

## Fix pass

**Date:** 2026-07-30  
**Commits:** `WORKING_TREE` (no commits, per brief)

### Findings addressed

1. **Finance/Billing handoff ID collapse** — Create path no longer maps `subscriptionId` into `invoiceId` / collapses typed ids into a mislabeled invoice slot.
   - API accepts distinct `invoiceId`, `subscriptionId`, and generic `targetRefId` (plus CS `csCaseId` convenience).
   - Typed Finance/Billing ids stored in payload; serialize exposes `invoiceId` / `subscriptionId` separately; `targetRefId` column stays null when only typed ids apply.
2. **Recon overall false AVAILABLE** — When message and/or SLA models are missing, overall elevates to `NOT_INSTRUMENTED` (same pattern as status-history plane).

### Files

- `lib/admin/support/handoffs.js`
- `app/api/admin/support/tickets/[id]/handoffs/route.js`
- `lib/admin/support/reconciliation.js`
- `test/systemAdmin.support.handoffs.test.js`
- `test/systemAdmin.support.reconciliation.test.js`

### Tests

```bash
npx vitest run test/systemAdmin.support.handoffs.test.js test/systemAdmin.support.reconciliation.test.js
```

```
Test Files  2 passed (2)
     Tests  17 passed (17)
```
