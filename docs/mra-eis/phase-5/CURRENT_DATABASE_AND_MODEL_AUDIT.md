# Current Database And Model Audit

## ORM / conventions
- Prisma + PostgreSQL
- IDs: `cuid()`
- Timestamps: `DateTime` with `@updatedAt`
- Money: `Decimal(18,2)` / quantities `Decimal(18,6)`
- Tenant model exists; **Business = Tenant** (`businessId` aliases `tenantId`)
- Soft-delete: selective (`deletedAt` on some legacy models; EIS evidence uses supersede/deactivate)

## Core models inspected
| Model | Role | Phase 5 disposition |
|---|---|---|
| Tenant | Tenancy root | REUSE |
| Branch / Warehouse | Location | REUSE (FK by id + service checks) |
| Product / Service / Tax / PaymentMethod | Local catalogue | REUSE via mapping FKs |
| Sale / Invoice / JournalEntry | Accounting sources | LEGACY_READ_ONLY for EIS |
| AcctV2Outbox | Accounting outbox (undrained) | WRAP / parallel EIS outbox |
| EISInvoice / EISConfiguration / EISSubmissionLog | Legacy EIS | DEPRECATE_LATER |
| MraEis* Phase 4 control tables | Entitlement plane | REUSE |
| Tenant.eisEnabled | Legacy flag | EXTEND (synced false from control plane) |

## Existing EIS / EFD fields
- `Tenant.eisEnabled`
- Legacy `lib/eisService.js` + `EISInvoice.validationUrl` / terminal position / sequence helpers in `eisConfig.js`
- Local QR `/verify/{id}` (not MRA validation)
- No production vault credential store

## Outbox / queue
- `AcctV2Outbox` present but not drained by workers (Phase 2)
- Phase 5 adds dedicated `MraEisOutbox` with claim / SKIP LOCKED pattern

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
