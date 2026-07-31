# Phase 9 Incident Runbooks

| Incident | Action |
|---|---|
| Overlapping actives | Supersede one; investigate concurrency |
| Stale after config sync | Revalidate; re-verify mappings |
| Tax treatment conflict | Correct treatment; do not activate |
| Split payment blocked | Use single tender or wait MRA clarification |
| Cross-tenant attempt | Audit + alert; reject |

---
*Phase 9 implementation. Suggestions never auto-activate. No Product/Service sync. No Sale submission. No fiscal numbers. No Journal/Stock mutations. Zero-rated ≠ exempt. VAT5 separate. Split payments fail-closed. Virtual Warehouse blocked pending MRA clarification.*
