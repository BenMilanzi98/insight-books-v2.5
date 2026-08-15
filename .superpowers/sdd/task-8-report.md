# Task 8 Report: SQLite schema, snapshot replace, outbox store

## TDD

### RED
```
npx vitest run test/desktop/sqliteStore.test.js
→ FAIL: Cannot find module '../../lib/desktop/sqlite/db.js'
```

### GREEN
```
npm install better-sqlite3   # compiled successfully on Windows
npx vitest run test/desktop/sqliteStore.test.js
→ PASS: 2 tests (sqlite snapshot + outbox)
```

## Deliverables

| File | Purpose |
|------|---------|
| `lib/desktop/sqlite/schema.sql` | meta, snapshot_json, entity tables, outbox |
| `lib/desktop/sqlite/db.js` | `openDesktopDb`, `getDesktopDbFromEnv` |
| `lib/desktop/sqlite/meta.js` | `readMeta`, `writeMeta` |
| `lib/desktop/sqlite/snapshotStore.js` | `replaceSnapshot`, `getProduct` |
| `lib/desktop/sqlite/outboxStore.js` | `appendOutbox`, `listOutbox`, `updateOutbox`, `listSyncIssues` |
| `test/desktop/sqliteStore.test.js` | atomic replace + monotonic seq |
| `package.json` / `package-lock.json` | `better-sqlite3` dependency |

## Behavior verified

- `replaceSnapshot` runs in a transaction; clears entity tables only (not `outbox` or `meta` keys unrelated to patch).
- Sets `lastServerNow` and `tenantId`; does **not** set `lastSuccessfulSyncAt`.
- Outbox survives snapshot replace; `seq` increments 1, 2, …
- `appendOutbox` inserts `status='pending'`.

## Concerns

None. `better-sqlite3` installed and native module loaded on Windows without compile errors.
