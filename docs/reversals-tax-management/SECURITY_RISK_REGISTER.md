# Security Risk Register

| ID | Risk | Mitigation |
|----|------|------------|
| R-S01 | Document reverse uses journalEntries.update not journal.reverse | Align RBAC Wave 2 |
| R-S02 | tax.settle unused | Enforce on settle route |
| R-S03 | No approval SoD for high-value reverse | Mitigated: `reversalRequireSeparateApprover` default true + pending UI + same-actor reject |
| R-S04 | Export permission without endpoint | Add export or remove dead gate |
