# MRA Block / Unblock Contract Decision

| Surface | Decision |
|---|---|
| Block from Sales response | PROVISIONAL_SANDBOX_ONLY |
| Block from configuration | PROVISIONAL_SANDBOX_ONLY |
| Unblock status mock | PROVISIONAL_SANDBOX_ONLY |
| Unblock status live sandbox | BLOCKED |
| Unblock status production | BLOCKED |
| Unblock request submission production | BLOCKED |
| HTTP 200 alone | NOT clearance |
| Implementation | Mock status query only; support references stored as evidence |

---
*Phase 17 implementation. Restrictions are source/scope/environment-aware with immutable evidence. Multiple restrictions coexist; clearing one does not clear others. Most restrictive control wins. MRA blocks require verified MRA clearance. HTTP 200 alone is not clearance. Approval alone does not restore Terminal. Post-unblock revalidation is mandatory. Production unblock calls remain BLOCKED until contract verified. No credentials/JWT/private keys/BAC in evidence. No Journal/Stock repost. No fiscal-number reuse. No accepted Sale retransmission. Browser cannot set Terminal ACTIVE.*
