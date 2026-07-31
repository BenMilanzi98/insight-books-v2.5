# Support Reliability Gate Matrix

| Fail condition | Gate state |
|----------------|------------|
| No ticket source | NOT_INSTRUMENTED |
| Missing status/SLA history | PARTIAL_HISTORY / SLA_CONTEXT_MISSING |
| Recon fail | RECONCILIATION_FAILED |
| Critical DQ | DATA_QUALITY_BLOCKED |
| Stale watermark | STALE / DELAYED |
| Permission / queue scope | PERMISSION_RESTRICTED |

**Never return numeric zero on gate failure.**
