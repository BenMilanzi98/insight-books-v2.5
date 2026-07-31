# Current Approval Audit (PRD 20)

**Audited:** 2026-07-31

| Check | Status | Class | Evidence |
|-------|--------|-------|----------|
| Commercial approvals plane | PARTIAL | CORRECT_AND_REUSABLE / EXTEND | Tree phase-15 commercial approvals (`lib/admin/crm/commercial/**`) |
| Conversion request APPROVAL_REQUIRED | READY | CORRECT_AND_REUSABLE | Request status + `approveConversionRequest` |
| Discount / SoD on Closed-Won | GAP | EXTEND | Wave 1 — unapproved discount must block Closed-Won where policy requires |
| Superseded commercial invalidates approvals | GAP | EXTEND | Wave 1 — non-carried approvals must not pass readiness |
| Close approval status enum | FOUNDATION | REUSE_WITH_RECONCILIATION | `CRM_CLOSE_APPROVAL_STATUS` in `close.js` |
| Conversion-approvals thin hub | PARTIAL | FOUNDATION | Hub keys mention approvals; rich SoD UI polish WITH_BLOCKERS |

**Implication:** Wave 1 hardens required approvals/discount SoD into server readiness before Closed-Won/convert.
