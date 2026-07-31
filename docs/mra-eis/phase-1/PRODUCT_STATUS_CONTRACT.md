# Product Status Contract

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

`POST /api/v1/utilities/product-status` body ProductIdentifier{productId, tin}

Purpose (OpenAPI): UNSPSC mapping status at MRA.

| Question | Answer |
|---|---|
| Read-only? | Yes (status check) |
| Required before every sale? | Not stated — do not assume | INF/RC |
| Cacheable? | Unknown | RC |
| Authoritative stock? | No — use inventory endpoints/portal | INF |

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
