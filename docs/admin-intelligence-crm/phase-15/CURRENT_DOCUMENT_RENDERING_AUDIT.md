# Current Document Rendering Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| CRM deterministic HTML→PDF renderer | NOT_FOUND | — |
| Render jobs / draft|internal|issued watermarks | NOT_FOUND | — |
| Tenant generateQuotationPdf | WRONG_DOMAIN / REUSE_WITH_RECONCILIATION | `lib/server-pdf.js` — tenant plane; regenerable |
| Tenant PDF download route | WRONG_DOMAIN / DOCUMENT_IMMUTABILITY_RISK | `app/api/quotations/[id]/download/pdf` — tmp files; not checksummed commercial artifacts |
| Checksummed private artifacts | NOT_FOUND | — |

**Implication:** Wave 3 real deterministic renderer + artifact checksums. May study tenant PDF stack for tech patterns only — not domain reuse.
