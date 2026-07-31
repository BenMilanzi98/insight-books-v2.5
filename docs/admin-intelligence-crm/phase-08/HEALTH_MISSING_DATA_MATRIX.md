# Health Missing Data Matrix

| Situation | Dimension status | Score contribution | Confidence effect |
|-----------|------------------|--------------------|-------------------|
| Source query throws | FAILED | None (exclude); may null overall | → INSUFFICIENT or LOW |
| Tenant not applicable (e.g. no EIS product) | NOT_APPLICABLE | Exclude + renormalise remaining weights | Mild ↓ (document N/A list) |
| Source not instrumented (adoption, support, …) | NOT_APPLICABLE | Exclude (not in v1 base set) | No fake penalty |
| Engagement lastLogin null (never logged in) | SCORED low (or per rules) | Contributes low score | OK — evidence exists (absence of login is evidence) |
| Ownership missing | SCORED (relationship penalty) | Contributes | OK — aligns CUSTOMER_OWNER_MISSING |
| Signals ephemeral (table unavailable) | SCORED with limitation | Contributes | Confidence ≤ MEDIUM |
| &lt; 2 scored dims after policy | — | Overall score null | INSUFFICIENT |
| Treating missing as 0 | FORBIDDEN | — | — |

**Worked example:** commercial + engagement + relationship scored; mraEis N/A → weights become 0.35/0.80, 0.25/0.80, 0.20/0.80 (renormalised). Adoption never enters as 0.
