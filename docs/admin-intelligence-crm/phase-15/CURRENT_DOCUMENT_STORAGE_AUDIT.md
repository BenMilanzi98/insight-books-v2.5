# Current Document Storage Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| CRM commercial artifact store | NOT_FOUND | — |
| Artifact hash / size / MIME / private location | NOT_FOUND | — |
| Issued PDF silent replace guard | NOT_FOUND | DOCUMENT_IMMUTABILITY_RISK until Wave 3 |
| Tenant tmp quotation PDFs | WRONG_DOMAIN | `tmp/quotation-*.pdf` pattern |
| Regeneration = new artifact | NOT_FOUND | Design requirement |

**Implication:** Wave 3 private storage with immutability for issued artifacts.
