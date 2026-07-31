# Target Module Structure

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Adapted to InsightBooks (JS-first, `lib/` + `app/api/`):

```
lib/mraEis/
  domain/          # aggregates, SMs, errors, specs
  application/     # commands, queries, policies, handlers
  infrastructure/  # prisma repos, vault, client, crypto, outbox, queue
  contracts/       # EligibleSaleFinalized, DTOs (internal)
app/api/mra-eis/   # tenant + admin routes (server)
app/eis/           # existing UI — rewire gradually
test/mraEis/       # unit/integration/contract/security
```

Do not put credential decryption or MraEisClient under `components/` or client bundles.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
