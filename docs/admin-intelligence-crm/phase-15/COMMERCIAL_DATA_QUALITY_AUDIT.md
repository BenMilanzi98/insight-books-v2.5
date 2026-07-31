# Commercial Data Quality Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| CRM commercial DQ runners | NOT_FOUND | — |
| Opp estimate completeness (amount+currency+basis) | FOUNDATION | Enforced for proposal readiness CRITICAL item |
| Opp products optional WARN | FOUNDATION | Soft gate today |
| Orphan handoff without Account/Contact | FOUNDATION risk | Handoffs carry IDs — Wave 1 must validate on convert |
| Issued doc without Price Book snapshot | NOT_FOUND (gap) | Wave 2–3 DQ rules |
| Acceptance without checksum | NOT_FOUND (gap) | Wave 3–4 DQ |
| Fabricated commercial volume from Lead DEMO_REQUEST counts | FORBIDDEN | Honesty — do not invent proposal KPIs from Lead types alone |

**Implication:** Wave 4 DQ catalogue per design; early waves encode invariants in services/tests.
