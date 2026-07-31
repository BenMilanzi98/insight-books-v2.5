# EIS-Relevant Route Inventory

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

| Route | Module | Auth | EIS relevance | Risk |
|---|---|---|---|---|
| POST /api/sales | POS finalize | session + perms | **Primary POS fiscal candidate**; post-commit eisService | Duplicate sales; best-effort EIS |
| POST /api/invoices | Invoice issue | session | Non-Draft posts + EIS submit | Draft vs issued; payment ≠ new EIS |
| POST /api/sales/[id]/void|refund | Corrections | sales.void/refund | Must map to MRA void/credit later | No EIS call today |
| POST /api/invoices/void|refund | Corrections | | Same | No EIS call |
| POST /api/credit-notes | Credit notes | | Future credit/debit note | Partial GL |
| /api/eis/* | Legacy EIS | session + hasEISAccess | Replace/rewrite | Unsafe secrets/settings |
| /api/cron/eis-sync | Cron | CRON_SECRET | Status sync | Not outbox |
| /api/admin/eis-subscriptions* | Entitlement | admin | Keep with fixes | hasEISAccess bug |
| GET /api/sales/[id]/receipt | Receipt PDF | | Receipt boundary | |
| /api/invoices/[id]/download/pdf|send | PDF/email | | After fiscal QR | Historical PDF immutability |
| /verify/[id] | Public verify | none | **Not MRA QR** | Mislabel risk |
| /pos, /eis/* | UI | page access | Operator surfaces | |
| Accounting V2 APIs | Journals/posting | session + businessId guard | Snapshot after posting | |

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
