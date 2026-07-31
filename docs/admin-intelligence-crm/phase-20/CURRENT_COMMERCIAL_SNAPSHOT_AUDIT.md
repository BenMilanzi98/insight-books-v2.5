# Current Commercial Snapshot Audit (PRD 20)

**Audited:** 2026-07-31

| Check | Status | Class | Evidence |
|-------|--------|-------|----------|
| Accepted snapshot drives Subscription | PARTIAL | EXTEND | `wave3Runner.js` `resolveAcceptedSnapshot`; `subscription.js` requires `acceptedSnapshot` |
| Snapshot missing → skip Wave 3 honestly | READY | CORRECT_AND_REUSABLE | `accepted_snapshot_required` — no fabricate |
| Checksum on acceptance | READY | CORRECT_AND_REUSABLE | Commercial acceptance `checksumSha256`; readiness blocker |
| Immutable conversion-time snapshot lock | GAP | EXTEND | Snapshot largely carried as JSON from plan/request; dedicated immutable lock + checksum after Closed-Won needs harden |
| Silent Proposal edit mutates snapshot | GAP | EXTEND | Wave 2 — material change must require amendment conversion |
| Opp estimate as contracted truth | — | FORBIDDEN / WRONG_SOURCE | Must not drive Subscription amounts |
| Completion certificate binds checksum | READY | CORRECT_AND_REUSABLE | `completion.js` `computeCompletionCertificateChecksum` |

**Implication:** Snapshot consumption is honest when present; Wave 2 adds immutability/lock so post-accept edits cannot silently mutate conversion commercial truth.
