# Phase 7 Gap Register

| ID | Gap | Severity | Mitigation |
|---|---|---|---|
| G7-01 | SaaS terminal identity (Q-017–019) unresolved | CRITICAL (prod) | Production create/activate blocked |
| G7-02 | Confirmation signer not productionEnabled | HIGH (prod) | Fail closed for PRODUCTION |
| G7-03 | No MRA status-poll recovery endpoint verified | HIGH | Unknown outcome → manual review |
| G7-04 | Live sandbox activation not executed | MEDIUM | Mock scenarios cover paths |
| G7-05 | Shared rate-limit store | LOW | In-process limiter; document for multi-node |
| G7-06 | Approval engine deep integration | MEDIUM | Production requires approvalId on reactivate/replace |
| G7-07 | Message-hash / offline crypto | N/A Phase 7 | Remain blocked |
| G7-08 | Prisma client generate after migrate | OPS | Required before runtime |

---
*Phase 7 implementation. No Sale submission. No fiscal number/QR. No Journal/Stock mutations. TAC ephemeral. JWT/secret encrypted. ACTIVE only after confirmation.*
