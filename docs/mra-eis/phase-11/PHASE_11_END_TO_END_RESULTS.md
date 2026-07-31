# End-to-End Results

Scenario coverage (unit/integration level):
1. EIS-disabled → not applicable, no bridge required
2. Eligible path → decision + bridge + outbox (requires DB fixtures for full E2E)
3. Credit invoice → one bridge; payment exclusion helper
4. Unmapped product → blocked preflight
5. Bridge recovery marker on post-commit failure
6. Split unsupported → blocked
7. Duplicate identity → idempotent
8. Stale config → terminal resolution blockers
9. Cross-tenant → rejected
10. No MRA HTTP in Phase 11 code paths

---
*Phase 11 implementation. Local sales eligibility + bridge only. No MRA Sale submission, fiscal number, QR, or “MRA validated” receipt. Bridge creates no Journal/Stock Movement. Customer payments are not Sales. Draft/Quote/Proforma excluded.*
