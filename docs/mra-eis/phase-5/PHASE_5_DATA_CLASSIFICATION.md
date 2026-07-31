# Phase 5 Data Classification

| Class | Examples |
|---|---|
| PUBLIC/LOW | Status enums |
| INTERNAL | Worker IDs, sync metadata |
| CONFIDENTIAL | TIN, buyer TIN, snapshots, validation URLs, VAT5 cert refs |
| SECRET | JWT, terminal secret, TAC, buyer auth — **not stored in Phase 5 tables** |

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
