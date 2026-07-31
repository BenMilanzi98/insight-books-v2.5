# Pipeline Reliability Gate Matrix

| Fail condition | Gate state |
|----------------|------------|
| No CrmOpportunity / Pipeline instrumented | NOT_INSTRUMENTED |
| Foundations OPPORTUNITY_PIPELINE still contract-only | NOT_AVAILABLE (pre-Wave 1) |
| Weighted Pipeline UI/report requested before Phase 16 | NOT_AVAILABLE |
| Email / WhatsApp Lead volume used as Pipeline source | NOT_AVAILABLE |
| Missing stage / amount / close-date history | PARTIAL_HISTORY |
| READY handoff vs Opportunity recon fail | RECONCILIATION_FAILED |
| Critical DQ (currency missing, fabricated amount) | DATA_QUALITY_BLOCKED |
| Permission / territory scope deny | PERMISSION_RESTRICTED |
| Pipeline version / stage definition missing | DEFINITION_MISSING |
| analytics-pipeline health used as sales KPI | WRONG_DOMAIN (reject) |

**Never return numeric zero on gate failure.** Never invent Opportunity / funnel / win-rate volume.
