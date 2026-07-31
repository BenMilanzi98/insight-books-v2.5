# Security Architecture

## Tenant isolation

- `AccountingContext.businessId` comes exclusively from the authenticated session
  (`contextFromSessionUser`); a client-supplied business id that differs throws
  `CrossTenantAccountingError` (403). This directly answers Phase 1 SEC-2 (query-string
  tenantId) for all V2 surfaces.
- Every repository read/write asserts row ownership (`assertSameBusiness`) — including
  idempotency-key lookups, so a forged key from another business is blocked (tested).
- The legacy posting adapter pre-validates line-account tenancy
  (`assertAccountsBelongToBusiness`) before delegating to `postGlEntry`, compensating for
  SEC-1 on every adapter-routed posting. The legacy engine itself is not modified in Phase 2
  (Phase 4 hardens it); direct legacy routes retain their Phase 1 risk rating (R-19/R-20 in
  the risk register).
- Background/import/webhook paths must construct a context (`sourceChannel`) — there is no
  context-free entry point into V2 services.

## Attack-surface controls

| Threat | Control |
|---|---|
| Mass assignment | Zod schemas whitelist fields; unknown keys stripped; DB models never bound to request bodies |
| Cross-tenant ID injection | session-derived context + per-row ownership assertions + FK-free tenant strings (no implicit joins) |
| Unauthorized flag / posting-mode changes | permission-gated API, tenant scope checks, mandatory reason, audit record; NEW_ENGINE blocked outright |
| Journal mutation | no update/delete on repository contract; `JournalImmutableError`; boundary tests forbid V2 writes to legacy financial tables |
| Audit-log mutation | append-only writes; no V2 code path updates/deletes `AuditLog` |
| Replay (request/webhook/import) | idempotency registry with content hash; replays return stored results; conflicts 409 |
| Sensitive-data logging | logger whitelists identifier fields; error `diagnostic` never serialized to clients (`toSafeJSON`) |
| Unvalidated metadata | metadata accepted as JSON but never interpreted for accounting decisions; size-limited at API schema |
| SQL injection | Prisma parameterized queries only; no raw SQL in V2 kernel |
| Raw-query tenant leaks | no `$queryRaw` in V2; legacy adapters use scoped Prisma queries |
| Background-job privilege escalation | jobs carry explicit context with `userId` + permissions; no service infers elevated scope |
| Frontend flag tampering | flags stored server-side, evaluated server-side; client pages cannot import flag infrastructure (boundary test) |

## Server-generated identifiers

`requestId`/`correlationId` default to server UUIDs; idempotency keys are derived
server-side from validated identity; architecture version is set by the kernel, never
accepted from input.

## Error hygiene

`AccountingV2Error.toSafeJSON()` exposes code, safe message, retryability, and correlation
ids only — no stack traces, SQL, connection strings, or other tenants' data. Diagnostics go
to the structured error log.
