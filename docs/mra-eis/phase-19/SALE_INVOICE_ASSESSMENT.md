# Sale / Invoice Assessment

`classifySaleOrInvoice` — EIS_ACCEPTED_PROVEN requires Response Evidence + MRA ID. RECEIPT_WITHOUT_RESPONSE / STATUS_WITHOUT_EVIDENCE quarantine. EIS_ELIGIBLE_NOT_SUBMITTED → historical read-only, MUST_NOT_AUTO_SUBMIT.

---
*Phase 19 — Existing-data discovery, assessment, reconciliation and controlled additive migration. Default for ambiguous data: QUARANTINE AND MANUAL REVIEW. No historical Sale submission. No Journal/Stock replay. No fiscal-number generation or mutation. No plaintext credentials/JWT/TAC/private keys/BAC. Dry Run required before Production. Rollback = migration-created records only; lineage and Audit survive.*
