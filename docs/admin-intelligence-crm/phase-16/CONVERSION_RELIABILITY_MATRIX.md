# Conversion Reliability Matrix

| Gate | On fail | Present today | Class |
|------|---------|---------------|-------|
| Conversion identity | UNAVAILABLE | NOT_FOUND | NOT_FOUND |
| Accepted version + checksum | Block execute | Phase 15 readiness | CORRECT_AND_REUSABLE |
| Acceptance validity | Block | Acceptance model | CORRECT_AND_REUSABLE |
| Customer/Tenant/Sub source lineage | UNAVAILABLE metrics | NOT_FOUND | NOT_FOUND |
| Step history complete | Block finalize | NOT_FOUND | NOT_FOUND |
| Recon / DQ | Never false zero | Commercial pattern only | CORRECT_AND_REUSABLE pattern |
| Weighted Pipeline UI | Stay dark / gated | `WEIGHTED_PIPELINE_UI_ENABLED === false` | CORRECT_AND_REUSABLE |
| Permission / privacy | Forbidden / redact | CRM stub scope | FOUNDATION / CROSS_TENANT_RISK |
