# Current Onboarding Request Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| `CustomerOnboardingRequest` model | NOT_FOUND | No Prisma model; no SQL wave script for Phase 17 |
| `ONR-YYYY-######` numbering | NOT_FOUND | Numbering exists for conversion (`CVR-`) / meetings / support — not onboarding requests |
| `consumeOnboardingHandoff` | NOT_FOUND | Spec/plan name only; not implemented |
| Auto-create from Phase 16 handoff | NOT_FOUND | Emit path exists (`createOnboardingHandoff`); consume path absent |
| Accept / reject / convert Request | NOT_FOUND | — |
| Required pins (Customer/Tenant/Subscription) | REUSE_WITH_RECONCILIATION | Available on conversion + handoff `payloadJson` (`conversionId`, `tenantId`); Request must pin explicitly in Wave 1 |
| Request status machine | NOT_FOUND | Spec statuses `NEW`…`ARCHIVED` not coded |
| Idempotency on handoff consume | EXTEND pattern | Handoff emit uses `idempotencyKey` unique on `CrmConversionDomainHandoff` — Request consume must mirror |
| Duplicate Request review | NOT_FOUND | — |
| API `onboarding-requests/**` | NOT_FOUND | No `app/api/admin/customer-success/onboarding-requests/**` |

**Implication:** Wave 1 BLOCKER greenfield — Request spine + consume + numbering + status history.
