# InsightBooks Integration Assumptions

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

| ID | Assumption | Official support | Risk | Validate in | Status |
|---|---|---|---|---|---|
| A-001 | One EIS entitlement per tenant + ops toggle | Master prompt / IB design | Med | Phase 2 | ASSUMPTION |
| A-002 | Multiple terminals per business possible | Likely | High if wrong | MRA Q-018/19 | ASSUMPTION |
| A-003 | Branch maps to siteId | Config site fields | Med | Phase 2/3 | ASSUMPTION |
| A-004 | Local items map to MRA product codes | Pre-int guide | High | Phase 3 | ASSUMPTION |
| A-005 | Local tax maps to MRA taxRateId | Config taxrates | High | Phase 3 | ASSUMPTION |
| A-006 | Accounting posts before/after MRA acceptance needs policy | Not MRA | High | Phase 3 | ASSUMPTION |
| A-007 | Transactional Outbox for submit | Engineering | Med | Phase 3 | ASSUMPTION |
| A-008 | Offline supported only after certification | Guide/FAQ | High | Cert | ASSUMPTION |
| A-009 | No historical bulk fiscalization without MRA | Safety | High | Counsel/MRA | ASSUMPTION |

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
