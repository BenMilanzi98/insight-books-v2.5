# Duplicate Billing Risk Register

Platform SaaS money must not be confused with tenant customer invoicing or MRA fiscal invoices.

## Money domains in the codebase

| Domain | Model(s) | Meaning | Admin relevance |
|--------|----------|---------|-----------------|
| Platform SaaS subscription | `AccountSubscription`, `BranchSubscription` | Tenant pays InsightBooks | Primary — KEEP |
| Tenant AR | `Invoice` (+ payments in tenant app) | Tenant bills their clients | **Not** platform billing |
| MRA / EIS fiscal | `EISInvoice`, MraEis receipt/transmission stack | Tax authority fiscalization | Separate compliance domain |
| Platform invoice ledger | **MISSING (`PlatformInvoice`)** | SaaS invoices/receipts to tenants | Required for Phase 5 |
| Affiliate commissions | `Affiliate*`, payouts | Partner economics | Adjacent |

## Registered risks

| ID | Risk | Evidence | Severity | Classification | Phase |
|----|------|----------|----------|----------------|-------|
| BILL-01 | Admin invoices API returns tenant `Invoice` rows | `app/api/admin/invoices/route.js` | Critical | DUPLICATE_BILLING_RISK | 5 (hotfix label in Phase 1) |
| BILL-02 | Admin invoices UI shows fake totals (156/142/…) | `billing/invoices/page.js` | High | STUB / DUPLICATE_BILLING_RISK | 5 |
| BILL-03 | Payments UI stub with no ledger | `billing/payments/page.js` | High | STUB / DUPLICATE_BILLING_RISK | 5 |
| BILL-04 | Billing overview disconnected from subscriptions truth | `billing/overview` | Medium | DISCONNECTED / DUPLICATE_BILLING_RISK | 5 |
| BILL-05 | `EISInvoice` linked to `AccountSubscription` may be misread as SaaS invoice | Schema relation | Medium | DUPLICATE_BILLING_RISK | 4–5 |
| BILL-06 | `subscription-payment` page overlaps tenant checkout semantics | `subscription-payment/page.js` | Medium | DUPLICATE_BILLING_RISK / REFACTOR | 5 |
| BILL-07 | Dashboard revenue widgets may mix SaaS vs tenant GMV | revenue-overview / analytics | Medium | DUPLICATE_BILLING_RISK | 6 |
| BILL-08 | No PlatformInvoice / PlatformPayment tables | Schema gap | Critical | MISSING / REIMPLEMENT | 5 |

## Locked product rules

1. **Subscriptions screen** remains the source of truth for SaaS entitlement state (`AccountSubscription`).
2. **Platform invoices/payments** (future) derive from subscription events / gateway settlements — never from tenant `Invoice`.
3. Until `PlatformInvoice` exists: hide or watermark invoices/payments UI as “Not available — stub”; do not wire to `/api/admin/invoices` as-is.
4. Rename or split `/api/admin/invoices` → e.g. `/api/admin/tenant-ar-invoices` (if still needed for support) vs `/api/admin/platform-invoices`.

## Phase 1 mitigation (no schema yet)

- Nav label: “Invoices (unavailable)” or remove from sidebar until Phase 5.
- API response header/warning field: `domain: "tenant_ar"` to prevent UI misuse.
- Docs/training: operators must use Subscriptions for SaaS status.
