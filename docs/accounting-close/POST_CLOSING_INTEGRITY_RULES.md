# Post-Closing Integrity Rules (implemented codes)

| Code | Meaning |
|---|---|
| CLS-001 | Closing batch unbalanced |
| CLS-002 | Closing batch already posted |
| CLS-003 | Temporary account omitted / misclassified warning |
| CLS-005 | Permanent account in temporary closure |
| CLS-006/007 | Revenue/Expense remains non-zero after close |
| CLS-010 | CYE duplication / non-zero control under MODEL A |
| CLS-011 | RE duplication (guarded by single posted batch) |
| CLS-012 | Drawings closed incorrectly / remains non-zero |
| CLS-017 | PCTB unbalanced / failed |
| CLS-024 | Preview changed after approval |
| CLS-036 | Cross-tenant close data |

Full catalogue from the master prompt is enforced progressively; generator + PCTB cover the critical close-path rules.
