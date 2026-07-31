# Phase 17 Tasks

| Stream | Status |
|---|---|
| Restriction dependency audit | DONE |
| Gap register | DONE |
| MRA block/unblock contract decision | DONE (mock provisional; prod BLOCKED) |
| Source / Reason / Scope / Precedence registries | DONE |
| Capability matrix + Effective Compliance Capability | DONE |
| Restriction aggregate + evidence + projection | DONE |
| Ingestion / idempotency / expiry policy | DONE |
| Platform emergency pause | DONE |
| Tenant / Business / Site / Terminal / Agent / Device / Cert / Credential / Config / Sequence / Queue restrictions | DONE (via reason registry + ingest) |
| Pending-work classification | DONE |
| Unblock Request + approvals + mock status | DONE |
| Post-unblock revalidation + gradual restoration | DONE |
| Workers (claim leases) | DONE |
| API + UI | DONE |
| Permissions | DONE |
| Unsafe fail-open / direct ACTIVE disabled | DONE |
| Unit tests | DONE |
| Docs + Phase 18 handover | DONE |
| Live/production MRA unblock endpoint | BLOCKED |
| Full Prisma-backed Unblock Status Attempts persistence in all paths | PARTIAL (memory + schema; API uses memory when mock) |
| Full System Admin cross-tenant dashboard polish | DEFERRED to Phase 18 |

---
*Phase 17 implementation. Restrictions are source/scope/environment-aware with immutable evidence. Multiple restrictions coexist; clearing one does not clear others. Most restrictive control wins. MRA blocks require verified MRA clearance. HTTP 200 alone is not clearance. Approval alone does not restore Terminal. Post-unblock revalidation is mandatory. Production unblock calls remain BLOCKED until contract verified. No credentials/JWT/private keys/BAC in evidence. No Journal/Stock repost. No fiscal-number reuse. No accepted Sale retransmission. Browser cannot set Terminal ACTIVE.*
