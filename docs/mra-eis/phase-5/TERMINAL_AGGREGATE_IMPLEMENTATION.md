# Terminal Aggregate

Table: `MraEisTerminal`
Service: `application/services/terminalService.js`
Repository helpers: `infrastructure/persistence/terminalRepository.js`

- Unique `(tenantId, businessId, environment, terminalLabel)`
- `offlineCertified` default false
- Versioned optimistic concurrency
- ACTIVE requires credential reference path
- BLOCKED cannot go directly to ACTIVE
- REVOKED is terminal

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
