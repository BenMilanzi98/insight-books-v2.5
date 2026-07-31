# Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| Fiscal algorithm unverified | HIGH | UNVERIFIED_PHASE5 marker; Phase 12 blocked |
| Phase 1 crypto blockers | HIGH | Phase 6 handover lists interfaces only |
| Legacy fire-and-forget EIS | MED | Phase 4 gates; Phase 5 does not call MRA |
| Prisma generate EPERM on Windows | MED | Stop Next before generate |
| AcctV2Outbox undrained | MED | Separate MraEisOutbox; dispatcher later |

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
