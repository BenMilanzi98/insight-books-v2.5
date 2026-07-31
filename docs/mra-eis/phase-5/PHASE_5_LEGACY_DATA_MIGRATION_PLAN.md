# Legacy Data Migration Plan

1. Dry-run `node scripts/mra-eis-phase5-legacy-classify.js`
2. Classify EISInvoice/EISConfiguration/Tenant.eisEnabled
3. Do **not** auto-create snapshots/transmissions
4. Ambiguous → manual review cases (later ops)
5. Preserve originals; no Journal/Sale/Stock writes

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
