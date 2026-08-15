### Task 8: SQLite schema, snapshot replace, outbox store

**Files:**
- Create: `lib/desktop/sqlite/schema.sql`
- Create: `lib/desktop/sqlite/db.js`
- Create: `lib/desktop/sqlite/meta.js`
- Create: `lib/desktop/sqlite/snapshotStore.js`
- Create: `lib/desktop/sqlite/outboxStore.js`
- Create: `test/desktop/sqliteStore.test.js`
- Modify: `package.json` — add dependency `better-sqlite3`

**Interfaces:**
- Consumes: `outboxState.js`, snapshot shape from Task 6
- Produces:
  - `openDesktopDb(filePath) → Database` (create tables if missing)
  - `replaceSnapshot(db, snapshot)` — write to temp tables / transaction then swap; crash-safe
  - `readMeta(db) → { tenantId, deviceId, numberPrefix, lastSuccessfulSyncAt, lastServerNow, lastLocalNow, boundAt, subscriptionActive }`
  - `writeMeta(db, patch)`
  - `appendOutbox(db, { id, kind, payload }) → row` with monotonic `seq`
  - `listOutbox(db) → rows`
  - `updateOutbox(db, id, patch)`
  - `listSyncIssues(db) → failed rows`

Schema:

```sql
CREATE TABLE IF NOT EXISTS meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS snapshot_json (
  entity TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  quantity REAL NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS doc_counters (
  type TEXT PRIMARY KEY,
  lastIssued INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL UNIQUE,
  createdAt TEXT NOT NULL,
  kind TEXT NOT NULL,
  payloadJson TEXT NOT NULL,
  status TEXT NOT NULL,
  errorMessage TEXT,
  serverId TEXT
);
```

`replaceSnapshot` must wrap in `db.transaction(() => { ... })`: delete entity tables, insert from snapshot, set `lastServerNow`. It must **not** delete `outbox` rows. It must **not** set `lastSuccessfulSyncAt` (the sync worker does that after `canPullSnapshot`).

- [ ] **Step 1: Write failing tests using `:memory:`**

```js
import { describe, expect, it } from 'vitest';
import { openDesktopDb } from '../../lib/desktop/sqlite/db.js';
import { replaceSnapshot, getProduct } from '../../lib/desktop/sqlite/snapshotStore.js';
import { appendOutbox, listOutbox } from '../../lib/desktop/sqlite/outboxStore.js';
import { canPullSnapshot } from '../../lib/desktop/outboxState.js';
import { writeMeta, readMeta } from '../../lib/desktop/sqlite/meta.js';

describe('sqlite snapshot + outbox', () => {
  it('replaces products atomically and keeps outbox', () => {
    const db = openDesktopDb(':memory:');
    appendOutbox(db, { id: 'm1', kind: 'pos.sale', payload: { n: 1 } });
    replaceSnapshot(db, {
      version: 1,
      tenantId: 't1',
      products: [{ id: 'p1', quantity: 5, name: 'Bread' }],
      customers: [],
      taxTypes: [],
      paymentAccounts: [],
      openInvoices: [],
      recentPayments: [],
      sessionUser: { id: 'u1' },
      tenantSettings: {},
      posConfig: {},
      serverNow: '2026-08-15T10:00:00.000Z',
    });
    expect(getProduct(db, 'p1').quantity).toBe(5);
    expect(listOutbox(db)).toHaveLength(1);
    replaceSnapshot(db, {
      version: 1,
      tenantId: 't1',
      products: [{ id: 'p1', quantity: 4, name: 'Bread' }],
      customers: [],
      taxTypes: [],
      paymentAccounts: [],
      openInvoices: [],
      recentPayments: [],
      sessionUser: { id: 'u1' },
      tenantSettings: {},
      posConfig: {},
      serverNow: '2026-08-15T11:00:00.000Z',
    });
    expect(getProduct(db, 'p1').quantity).toBe(4);
    expect(listOutbox(db)).toHaveLength(1);
  });

  it('assigns increasing seq', () => {
    const db = openDesktopDb(':memory:');
    appendOutbox(db, { id: 'a', kind: 'pos.sale', payload: {} });
    appendOutbox(db, { id: 'b', kind: 'pos.sale', payload: {} });
    expect(listOutbox(db).map((r) => r.seq)).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Install better-sqlite3 and implement**

Run: `npm install better-sqlite3`

`openDesktopDb` runs `schema.sql` on open. `appendOutbox` inserts `status='pending'`, `seq = MAX(seq)+1` (or 1).

- [ ] **Step 3: Run** `npx vitest run test/desktop/sqliteStore.test.js` — Expected: PASS

- [ ] **Step 4: Commit** (skip unless asked)

---

