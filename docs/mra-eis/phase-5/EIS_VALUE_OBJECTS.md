# EIS Value Objects

Implemented in `lib/mraEis/domain/valueObjects/index.js`:

- Money / Quantity (exact decimal strings)
- Checksum
- MraTin
- BusinessDate helpers
- IdempotencyKey
- assertTenantBusinessMatch

ORM stores primitives; VOs validate at domain boundaries.

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
