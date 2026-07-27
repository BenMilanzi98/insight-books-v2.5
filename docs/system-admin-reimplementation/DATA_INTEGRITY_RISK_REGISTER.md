# Data Integrity Risk Register (System Admin)

| ID | Risk | Evidence | Severity | Classification | Phase |
|----|------|----------|----------|----------------|-------|
| DI-01 | Admin permissions JSON untyped / unconstrained | `Admin.permissions Json` | High | INCOMPLETE | 1 |
| DI-02 | Role string free-form | `Admin.role` | Medium | INCOMPLETE | 1 |
| DI-03 | Settings not persisted but UI claims success | `global-settings`, `/api/admin/settings` hardcoded | High | STUB / DATA | 6 |
| DI-04 | Mock roles diverge from real authz | `users/roles` | Medium | STUB / DISCONNECTED | 1 |
| DI-05 | Duplicate stub pages write no data but display “records” | affiliate-system, audit-logs | Medium | STUB | 1 |
| DI-06 | Multiple audit stores | AdminAuditLog, AuditLog, AdminActivityLog (User FK), SecV2AuditEvent, MraEisControlAuditEvent | High | CONSOLIDATE | 6 |
| DI-07 | AdminActivityLog → User relation | Schema bug/legacy | Medium | REFACTOR | 6 |
| DI-08 | Subscription status / isActive dual fields | `AccountSubscription.status` + `isActive` | Medium | INCOMPLETE | 3 |
| DI-09 | Trial expiry jobs vs manual activation races | `trials/expire`, manual-activation | Medium | DATA | 3 |
| DI-10 | SystemCoaDefinition singleton vs tenant Account drift | apply/migration | High | CROSS_TENANT_RISK / DATA | 1 |
| DI-11 | EmailLog status vs actual provider delivery | email-history | Medium | INCOMPLETE | 3 |
| DI-12 | MobileAppConfig singleton concurrency | `id=global` updates | Low | DATA | 3 |
| DI-13 | Affiliate totals denormalized | `totalCommissions`, `totalReferrals`, `totalSales` on Affiliate | Medium | DATA | 3 |
| DI-14 | Missing PlatformInvoice → operators invent truth in UI | stub invoices | High | DUPLICATE_BILLING_RISK / DATA | 5 |
| DI-15 | EISInvoice.status stringly typed | fiscal pipeline | Medium | EXTEND (EIS) | 4 |
| DI-16 | Orphaned referrals if tenant deleted without payout rules | AffiliateReferral → Tenant | Medium | DATA | 3 |

## Integrity principles for reimplementation

1. One write path per domain; stubs must not look like persisted data.
2. Mutations require AdminAuditLog with before/after or entity id.
3. Prefer computed metrics over denormalized counters unless reconciled by jobs.
4. Introduce PlatformInvoice with unique invoice numbers and FK to subscription/payment intent.
5. Align role/permission catalogs with a single encoder (no parallel mock lists).
