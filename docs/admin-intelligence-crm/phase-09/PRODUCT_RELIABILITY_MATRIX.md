# Product Reliability Gate Matrix

| Gate check | Fail state |
|------------|------------|
| Feature/module missing in catalogue | DEFINITION_MISSING |
| No producer / no events for metric | NOT_INSTRUMENTED |
| Definition version inactive | DEFINITION_MISSING |
| Freshness breach | STALE / DELAYED |
| Reconciliation fail | RECONCILIATION_FAILED |
| Critical DQ | DATA_QUALITY_BLOCKED |
| Sample below threshold | LOW_SAMPLE |
| Permission / portfolio | PERMISSION_RESTRICTED |
| Period unsupported | UNSUPPORTED_PERIOD |

**Never return numeric zero on gate failure.**
