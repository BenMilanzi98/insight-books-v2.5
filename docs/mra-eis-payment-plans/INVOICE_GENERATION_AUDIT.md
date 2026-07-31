# Invoice Generation Audit

**Date:** 2026-07-28

## Platform invoices — REUSE / EXTEND

- Created via `/api/admin/platform-billing/invoices` and renewals  
- Idempotency: `sha256(plat-inv:tenant:sub:periodStart:periodEnd)` + unique period constraint  
- Distinct from tenant `Invoice` / `Sale` / fiscal `EISInvoice`

## Gaps

| Gap | Tag |
|-----|-----|
| PayChangu does not create PlatformInvoice | DISCONNECTED |
| No setup/activation fee line types for EIS | INCOMPLETE |
| No usage overage invoice lines | INCOMPLETE |
| No MRA EIS purpose codes on invoice | EXTEND |
| Fiscal `EISInvoice` confused with SaaS bill | NOT_APPLICABLE for platform billing — document clearly |

## Rule

MRA EIS plan billing → **platform** invoices only. Never post SaaS charges into tenant customer AR.
