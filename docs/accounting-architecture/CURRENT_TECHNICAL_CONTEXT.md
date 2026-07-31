# Current Technical Context (verified for Phase 2)

| Aspect | Reality |
|---|---|
| Framework | Next.js ^16.2.9, App Router, `app/api/**/route.js` handlers |
| Language | **JavaScript (ESM) with JSDoc** — not TypeScript. TS present only for tooling (`ts-node`, `typescript` devDeps). Phase 2 uses JSDoc typedefs + Zod (`zod ^4.1.12`) for runtime contracts |
| Runtime | Node.js 24 |
| Database | PostgreSQL (local 18.4; production per `.env`) |
| ORM | Prisma ^6 (`@prisma/client`), singleton at `lib/prisma.js`; migrations under `prisma/migrations` (timestamped folders); `db:migrate` / `db:migrate:deploy` scripts. Drizzle is a dependency but unused for accounting |
| Authentication | Custom session cookie; `getUserFromSession(request)` in `lib/auth.js` |
| Authorization | `hasPermission(user, permission)` + `requirePermission(request, permission)` in `lib/auth.js`; permission sets flattened by `lib/permissionUtils.js`; role helpers like `canManageAccountingPeriods` |
| Multi-tenancy | `tenantId` column scoping; session-derived tenant on well-behaved routes; no RLS |
| Service pattern | Plain exported functions in `lib/*.js`; domain kernels as folders (`lib/accountingEngine/`, `lib/accountingAudit/`) |
| Transactions | `prisma.$transaction(async (tx) => …)` with explicit `tx` passing (pattern in `postGlEntry`) |
| Events/queue | None. No queue framework, no event bus; cron-style routes gated by `CRON_SECRET` |
| Feature flags | **None existing** — Phase 2 introduces the first server-side flag framework |
| Audit trail | `AuditLog` model (action, entityType, entityId, userId, details, ipAddress, tenantId) |
| Decimal handling | `lib/money.js` — integer minor-unit (cent) arithmetic, MWK scale 2; Prisma `Decimal(18,2)` on modern tables; legacy Float on 48 models |
| Validation | Zod v4 available; used inconsistently in routes |
| Testing | Vitest ^4 (`npm test`); existing suites incl. `test/accountingAudit.test.js` |
| Logging | `console.*`; no structured logger — Phase 2 adds a scoped structured logger for accounting |
| Deployment | `next build`/`next start`; Docker compose available but local dev uses host Postgres |
| Legacy accounting | Dual ledgers (`Transaction`+lines, `JournalEntry`+lines), `postGlEntry` engine, stored balances (`Account.balance`, `AccountBalance`, `TenantSettings.ownerContributedCapital`) — full map in `docs/accounting-audit/` |

## Legacy compatibility requirements

- All existing routes and posting behaviour must keep working unchanged; V2 observes via
  adapters and (when flagged) shadow mode only.
- New tables are additive (`AcctV2*` prefix); no legacy column is renamed, dropped, or written.
- Default posting mode is `LEGACY` for every tenant until explicitly changed by an
  administrator through the server-side configuration.

## Convention decisions for Phase 2 code

- Kernel lives at `lib/accountingV2/` (mirrors `lib/accountingEngine/`, `lib/accountingAudit/`).
- Enums = frozen objects (`Object.freeze`), single definition module.
- Contracts = Zod schemas + factory functions returning frozen objects; consumer-facing
  "interfaces" are documented shapes enforced by `assertImplements` runtime checks and tests.
- Money = minor-unit integers via `lib/money.js` (`toMinor`/`fromMinor`); decimal strings at API
  boundaries; Prisma `Decimal` in V2 tables.
