# Current First Value Audit

| Check | Class | Evidence |
|-------|-------|----------|
| Feature-specific first-value engine | NOT_FOUND | — |
| First-value uniqueness / facts | NOT_FOUND | — |
| Phase 7 “time to first value” | NOT_INSTRUMENTED | Blocked on FEATURE_USED |
| Candidate: first posted Invoice | CANDIDATE_EVIDENCE | Domain Invoice/Sale models |
| Candidate: first POS complete | CANDIDATE_EVIDENCE | `app/pos`, sales domain |
| Candidate: first MRA accepted fiscal | CANDIDATE_EVIDENCE | `MraEisFiscalReceipt` / accepted transmission |
| Page-view first value | FORBIDDEN | — |

**Wave 1–2:** Instrument candidates via AnalyticsEvent; first-value fact unique per (tenant, feature, ruleVersion).
