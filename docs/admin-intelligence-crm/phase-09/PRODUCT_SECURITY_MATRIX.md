# Product Security Matrix

| Action | Permission (planned) | Scope |
|--------|----------------------|-------|
| View overview / modules / features | `productAnalytics.view*` | Aggregate + portfolio where customer-bound |
| View user-level detail | `viewUserLevelData` | Explicit; CS portfolio |
| Manage definitions | `manageDefinitions` | SoD with approver |
| Run reconciliation | `runReconciliation` | Technical |
| Export / schedule | `export` / `scheduleReports` | Recheck on download |
| Acknowledge signals | `acknowledgeSignals` | Portfolio for CS |

Executives: aggregates. CS: portfolio. Sales: handoff context only. Auditor: read-only.
