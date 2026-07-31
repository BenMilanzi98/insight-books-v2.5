# Tax Engine Audit

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

- Catalog: `lib/malawiTaxCatalog.js` (standard VAT 17.5 example; `mraStandardVatTaxRateId` → `A`).
- Sale/invoice compute tax then `autoPostTaxEntry`.
- Relief supply can zero VAT on sales path.
- EIS payload taxRateId heuristic A/B/E in eisService — **not config-versioned MRA rates**.
- Rounding: Float-based — **BLOCKER risk** vs Phase 1 decimal contract.
- Levy support: incomplete vs MRA levyBreakDown.
- VAT5: API route exists; not full POS integration.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
