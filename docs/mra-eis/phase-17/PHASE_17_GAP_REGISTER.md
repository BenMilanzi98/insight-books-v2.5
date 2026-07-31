# Phase 17 Gap Register

| ID | Gap | Severity | Status |
|---|---|---|---|
| G17-001 | Live MRA unblock-status production contract unverified | HIGH | BLOCKED |
| G17-002 | Live MRA unblock request submission not in verified contract | HIGH | BLOCKED |
| G17-003 | Full persistence of query attempts on all workers | MEDIUM | Schema ready; mock path memory |
| G17-004 | Unified Phase 18 admin fleet dashboards | MEDIUM | HANDOVER |
| G17-005 | Legacy Boolean migration dry-run across all tenants | MEDIUM | Plan documented; dry-run tooling deferred |
| G17-006 | Phase 13 success-code / hash blockers (carry-forward) | HIGH | Carry-forward |
| G17-007 | Phase 15 Last Online/Offline live | HIGH | Carry-forward |
| G17-008 | Phase 16 production offline certification | HIGH | Carry-forward |

---
*Phase 17 implementation. Restrictions are source/scope/environment-aware with immutable evidence. Multiple restrictions coexist; clearing one does not clear others. Most restrictive control wins. MRA blocks require verified MRA clearance. HTTP 200 alone is not clearance. Approval alone does not restore Terminal. Post-unblock revalidation is mandatory. Production unblock calls remain BLOCKED until contract verified. No credentials/JWT/private keys/BAC in evidence. No Journal/Stock repost. No fiscal-number reuse. No accepted Sale retransmission. Browser cannot set Terminal ACTIVE.*
