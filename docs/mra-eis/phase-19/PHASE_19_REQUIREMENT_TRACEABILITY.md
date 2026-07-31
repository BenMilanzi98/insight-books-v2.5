# Phase 19 Requirement Traceability

| Requirement | Source | Target | Transformation | Validation | Ownership | Environment | Duplicate | Reconciliation | Security | Rollback | Approval |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Source registry | External DB/file | `MraEisMigrationSourceSystem` | Metadata only | readOnlyVerified | tenantScope | environmentClassification | N/A | manifest row counts | credentialReference opaque | N/A | Production source register |
| Extraction | Source rows | Manifest | Checksum SHA-256 | schema fingerprint | hints | hints | natural keys | counts | secrets excluded | N/A | Production extract |
| POS Sale evidence | Legacy sale | Historical EIS evidence stub | `migration-transform-v1` | decision engine | conclusive tenant/business | explicit | fiscal# / MRA ID | financial flags only | no JWT/BAC | migration-created only | Production migrate |
| Receipt artifact | Archive | Quarantine or historical | checksum | receipt≠acceptance | proven | explicit | artifact checksum | receipt recon | redacted | migration-created only | restricted export |
| Journal | Existing | LINK only | none | balanced + ownership | same tenant/business | N/A | journal source ref | totals | N/A | never delete Journals | N/A |
| Stock Movement | Existing | LINK only | none | qty/warehouse | same | N/A | movement source ref | qty | N/A | never delete Stock | N/A |
| Fiscal number | Legacy | Preserve | none | uniqueness | terminal scope | env match | duplicate engine | sequence report | N/A | never change numbers | sequence init review |
| Transmission | Legacy | Historical read-only | none | not dispatchable | proven | explicit | attempt order | attempt count | evidence checksum | migration-created only | accepted-evidence import |

---
*Phase 19 — Existing-data discovery, assessment, reconciliation and controlled additive migration. Default for ambiguous data: QUARANTINE AND MANUAL REVIEW. No historical Sale submission. No Journal/Stock replay. No fiscal-number generation or mutation. No plaintext credentials/JWT/TAC/private keys/BAC. Dry Run required before Production. Rollback = migration-created records only; lineage and Audit survive.*
