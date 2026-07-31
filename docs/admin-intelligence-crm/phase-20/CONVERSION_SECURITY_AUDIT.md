# Conversion Security Audit (PRD 20)

**Audited:** 2026-07-31

| Check | Status | Class | Evidence |
|-------|--------|-------|----------|
| CRM access on orchestrator / handoffs / reports | PARTIAL | EXTEND | `resolveCrmAccess` checks across modules |
| SoD Closed-Won / discount / completion | GAP | EXTEND | Wave 1 approvals SoD |
| Tenant isolation assert | PARTIAL | EXTEND | `isolation.js` |
| Reserved tenant slugs | READY | CORRECT_AND_REUSABLE | `RESERVED_TENANT_SLUGS` |
| Privileged user / Super Admin invite | READY | CORRECT_AND_REUSABLE | Hash-only invitations; no default passwords |
| Scope fail-closed (team/territory) | GAP | CARRY | `resolveCrmScope` stub — Wave 4 |
| Accounting side effects | READY | CORRECT_AND_REUSABLE | `accountingBoundary.js` FORBIDDEN journals |
| Fabricate ACTIVE/PAID | — | FORBIDDEN | Activation/payment honesty present |
| System CoA admin | READY | CORRECT_AND_REUSABLE | Remains removed (global invariant) |

**Implication:** Security baseline reusable; Wave 1 SoD + Wave 4 scope fail-closed are Critical/High.
