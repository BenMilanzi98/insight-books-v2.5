# Phase Input Validation (Phases 1–22 → 23)

| Input | Status | Notes |
|-------|--------|-------|
| Lead identity (`CrmLead`) | PASS | Stable leadNumber, source, channel |
| CRM Account / Contact | PASS | Present |
| Opportunity identity | PASS | `CrmOpportunity` |
| Customer / Tenant identity | PASS | Phases 7/20/21 |
| Subscription identity | PASS | Billing |
| Campaign identity | **FAIL** | No Marketing Campaign model |
| Source taxonomy (governed) | **FAIL** | Free-text only on Lead |
| Visitor identity policy | **FAIL** | Not implemented |
| Consent treatment (visitor analytics) | **PARTIAL** | Capture consent exists; no visitor plane |
| Attribution window policy | **FAIL** | Not implemented |
| Currency treatment (spend) | **FAIL** | No marketing spend |
| Revenue definition (P6) | PASS | Consume for ROAS |
| Multi-tenant isolation | PASS | Admin CRM patterns |
| Marketing-spend source | **FAIL** | Missing |
| Idempotency (capture) | PASS | `sourceIdempotencyKey` |

**Gate:** Full implementation must not claim READY until Campaign identity, taxonomy, visitor policy, attribution windows, and spend source contracts exist (Wave 1+).
