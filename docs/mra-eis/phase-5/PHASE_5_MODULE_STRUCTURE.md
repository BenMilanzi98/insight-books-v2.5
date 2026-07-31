# Phase 5 Module Structure

```
lib/mraEis/
├── domain/
│   ├── operationalEnums.js
│   ├── operationalStateMachines.js
│   ├── valueObjects/
│   ├── events/
│   ├── repositories/contracts.js
│   ├── errors.js
│   ├── permissions.js
│   ├── constants.js
│   └── stateMachines.js          # Phase 4 control
├── application/
│   ├── *Service.js               # Phase 4 control
│   └── services/                 # Phase 5 operational
├── infrastructure/
│   ├── outbox/
│   ├── persistence/
│   ├── fixtures/
│   ├── audit.js
│   └── idempotency.js
└── index.js
```

Import guards: no account-balance mutation, no stock mutation, no browser-only modules, no plaintext secret helpers, no production MRA client.

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
