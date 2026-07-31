# Phase 5 Database Migrations

Single additive migration (repo convention; one deployable unit for foundation):

`prisma/migrations/20260722230000_mra_eis_phase5_foundation/migration.sql`

Groups conceptually: enums-as-strings, terminal/credentials, config/sites, catalogue/mappings, fiscal/snapshot, transmission/response/projection, vat5/offline/recon/sync/review/alert/outbox + indexes/partial uniques.

Rollback: forward-only preferred; DROP TABLE cascade only in non-prod after backup (see rollback plan).

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
