# InsightBooks Desktop Offline Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Windows Electron app that runs POS, invoices, customers, stock, and payments against local SQLite when offline, syncs an ordered outbox to the live server, and write-locks those modules after 24 hours without a full successful sync.

**Architecture:** Cloud Next.js (Postgres) stays the source of truth. New `/api/desktop/*` routes bind one device per tenant, build an operational snapshot, apply outbox items through existing POS/invoice/stock/payment services, and heartbeat. The desktop runs Next standalone on `127.0.0.1` with `DESKTOP_RUNTIME=1`. Middleware rewrites allowlisted operational `/api/*` calls to `app/api/desktop-local/[...path]/route.js`, which reads/writes SQLite and appends outbox rows. Electron main owns the SQLite file, 15-minute sync worker (talks to the live cloud URL), and Windows installer. Local writes do **not** post GL; the cloud apply step does, using the existing engines.

**Tech Stack:** Next.js App Router, Prisma/PostgreSQL, Vitest, better-sqlite3, Electron + electron-builder (Windows x64 NSIS), existing `lib/auth.js` session cookie, `@madrimov/electron-pos-printer`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-15-desktop-offline-sync-design.md` — follow locked decisions exactly.
- Offline modules only: POS, invoices, customers, stock adjustments, payments. Everything else returns `{ code: 'DESKTOP_ONLINE_ONLY' }` with HTTP 503.
- One bound desktop device per tenant. Second bind is 409 until unbind.
- `lastSuccessfulSyncAt` updates only after outbox has no `pending`/`failed` rows **and** snapshot pull succeeds. Heartbeat alone does not extend the 24h deadline.
- 20h warning banner; 24h write lock; footer always shows last sync (desktop only).
- Clock rollback &gt; 5 minutes from `lastLocalNow` → lock until a successful sync.
- Failed outbox items: no skip. Sync stops. Operator retries or unbinds (wipe).
- Outbox apply is idempotent on client `id` (`DesktopOutboxReceipt`).
- Do not fork POS/invoice pages. Do not clone the accounting engine into SQLite.
- Do not encrypt SQLite at rest in v1. Do not store passwords in SQLite.
- Do not edit `insight/` duplicates unless a shared root import requires it.
- Do **not** commit unless the user explicitly asks (user git rule). If a task lists a commit step, skip it until asked.
- Prefer TDD: failing test → implement → green per task.
- Web/cloud users who never install desktop must be unchanged (`DESKTOP_RUNTIME` unset; no `ib_desktop` cookie).

## File map

| File | Responsibility |
|------|----------------|
| `lib/desktop/codes.js` | Error/status constants |
| `lib/desktop/lock.js` | Pure 20h/24h + clock-rollback lock |
| `lib/desktop/outboxState.js` | Pure outbox status transitions + push-stop rule |
| `lib/desktop/documentNumbers.js` | `{prefix}-{type}-{seq}` formatting + local counter helper |
| `lib/desktop/paths.js` | Operational vs online-only API prefix lists |
| `lib/desktop/runtime.js` | `isDesktopRuntime()`, cookie name |
| `prisma/schema.prisma` | `DesktopDevice`, `DesktopOutboxReceipt` |
| `prisma/migrations/20260815120000_desktop_device/migration.sql` | DDL |
| `lib/desktop/cloud/bind.js` | Bind/unbind + prefix allocation |
| `lib/desktop/cloud/snapshot.js` | Operational snapshot JSON |
| `lib/desktop/cloud/outboxApply.js` | Idempotent apply via existing services |
| `lib/desktop/cloud/heartbeat.js` | `serverNow` + subscription + still-bound |
| `app/api/desktop/bind/route.js` | POST bind |
| `app/api/desktop/unbind/route.js` | POST unbind |
| `app/api/desktop/snapshot/route.js` | GET snapshot |
| `app/api/desktop/outbox/route.js` | POST items |
| `app/api/desktop/heartbeat/route.js` | POST heartbeat |
| `lib/sales/createSale.js` | Extracted POS sale create (cloud) |
| `lib/desktop/sqlite/schema.sql` | Local tables |
| `lib/desktop/sqlite/db.js` | Open/migrate SQLite |
| `lib/desktop/sqlite/meta.js` | Bound meta + timestamps |
| `lib/desktop/sqlite/snapshotStore.js` | Atomic snapshot replace + reads/writes |
| `lib/desktop/sqlite/outboxStore.js` | Durable outbox |
| `lib/desktop/local/session.js` | Offline `getUserFromSession` from snapshot |
| `lib/desktop/local/handlers.js` | Dispatch allowlisted APIs |
| `app/api/desktop-local/[...path]/route.js` | Node entry for rewritten APIs |
| `lib/desktop/syncWorker.js` | Heartbeat → push → snapshot pull |
| `middleware.js` | Desktop rewrite + skip prisma guards |
| `lib/auth.js` | Desktop session short-circuit |
| `components/desktop/DesktopSyncBanner.jsx` | 20h/24h banner + Sync now |
| `components/desktop/DesktopSyncFooter.jsx` | Last synced |
| `app/desktop/sync-issues/page.js` | Failed outbox list |
| `components/shell/AppShell.jsx` | Mount banner/footer |
| `components/OnboardingGate.js` | No-op when desktop |
| `desktop/main.cjs` | Electron window, spawn Next, cookie, sync timer |
| `desktop/preload.cjs` | Minimal bridge |
| `desktop/package.json` | electron + electron-builder |
| `app/download-app/page.js` | Windows installer link |
| `test/desktop/*.test.js` | All automated coverage |

---

### Task 1: Lock, codes, and document numbers (pure)

**Files:**
- Create: `lib/desktop/codes.js`
- Create: `lib/desktop/lock.js`
- Create: `lib/desktop/documentNumbers.js`
- Create: `test/desktop/lock.test.js`
- Create: `test/desktop/documentNumbers.test.js`

**Interfaces:**
- Produces:
  - `DESKTOP_CODES = { SYNC_REQUIRED: 'DESKTOP_SYNC_REQUIRED', ONLINE_ONLY: 'DESKTOP_ONLINE_ONLY', SUBSCRIPTION_INACTIVE: 'SUBSCRIPTION_INACTIVE', DEVICE_BOUND: 'DEVICE_ALREADY_BOUND', NOT_BOUND: 'DEVICE_NOT_BOUND' }`
  - `LOCK_MS = 24 * 60 * 60 * 1000`
  - `WARN_MS = 20 * 60 * 60 * 1000`
  - `CLOCK_BACKSHIFT_MS = 5 * 60 * 1000`
  - `evaluateDesktopLock({ lastSuccessfulSyncAt, lastLocalNow, now, subscriptionActive }) → { locked: boolean, warning: boolean, hoursSinceSync: number, reason: 'stale' \| 'clock' \| 'subscription' \| null }`
  - `formatDesktopDocNumber({ prefix, type, seq }) → string` e.g. `TILL1-SALE-1`
  - `nextSeq(lastIssued) → number`

- [ ] **Step 1: Write failing tests**

Create `test/desktop/lock.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { evaluateDesktopLock, LOCK_MS, WARN_MS } from '../../lib/desktop/lock.js';

const HOUR = 60 * 60 * 1000;
const t0 = Date.parse('2026-08-15T10:00:00.000Z');

describe('evaluateDesktopLock', () => {
  it('is unlocked under 20h', () => {
    const r = evaluateDesktopLock({
      lastSuccessfulSyncAt: t0,
      lastLocalNow: t0,
      now: t0 + 19 * HOUR,
      subscriptionActive: true,
    });
    expect(r.locked).toBe(false);
    expect(r.warning).toBe(false);
    expect(r.reason).toBeNull();
  });

  it('warns between 20h and 24h', () => {
    const r = evaluateDesktopLock({
      lastSuccessfulSyncAt: t0,
      lastLocalNow: t0,
      now: t0 + 21 * HOUR,
      subscriptionActive: true,
    });
    expect(r.locked).toBe(false);
    expect(r.warning).toBe(true);
    expect(r.hoursSinceSync).toBeGreaterThanOrEqual(20);
  });

  it('locks at 24h', () => {
    const r = evaluateDesktopLock({
      lastSuccessfulSyncAt: t0,
      lastLocalNow: t0,
      now: t0 + LOCK_MS,
      subscriptionActive: true,
    });
    expect(r.locked).toBe(true);
    expect(r.reason).toBe('stale');
  });

  it('locks when local clock moves backward more than 5 minutes', () => {
    const r = evaluateDesktopLock({
      lastSuccessfulSyncAt: t0,
      lastLocalNow: t0 + 2 * HOUR,
      now: t0 + 2 * HOUR - 6 * 60 * 1000,
      subscriptionActive: true,
    });
    expect(r.locked).toBe(true);
    expect(r.reason).toBe('clock');
  });

  it('does not lock for a 4-minute backward blip', () => {
    const r = evaluateDesktopLock({
      lastSuccessfulSyncAt: t0,
      lastLocalNow: t0 + HOUR,
      now: t0 + HOUR - 4 * 60 * 1000,
      subscriptionActive: true,
    });
    expect(r.reason).not.toBe('clock');
  });

  it('locks when subscription is inactive', () => {
    const r = evaluateDesktopLock({
      lastSuccessfulSyncAt: t0,
      lastLocalNow: t0,
      now: t0 + HOUR,
      subscriptionActive: false,
    });
    expect(r.locked).toBe(true);
    expect(r.reason).toBe('subscription');
  });
});
```

Create `test/desktop/documentNumbers.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { formatDesktopDocNumber, nextSeq } from '../../lib/desktop/documentNumbers.js';

describe('formatDesktopDocNumber', () => {
  it('formats prefix-type-seq', () => {
    expect(formatDesktopDocNumber({ prefix: 'TILL1', type: 'SALE', seq: 12 })).toBe('TILL1-SALE-12');
  });
});

describe('nextSeq', () => {
  it('increments from lastIssued', () => {
    expect(nextSeq(0)).toBe(1);
    expect(nextSeq(7)).toBe(8);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/desktop/lock.test.js test/desktop/documentNumbers.test.js`

Expected: FAIL with "Cannot find module" for `lib/desktop/lock.js`.

- [ ] **Step 3: Write minimal implementation**

`lib/desktop/codes.js`:

```js
export const DESKTOP_CODES = {
  SYNC_REQUIRED: 'DESKTOP_SYNC_REQUIRED',
  ONLINE_ONLY: 'DESKTOP_ONLINE_ONLY',
  SUBSCRIPTION_INACTIVE: 'SUBSCRIPTION_INACTIVE',
  DEVICE_BOUND: 'DEVICE_ALREADY_BOUND',
  NOT_BOUND: 'DEVICE_NOT_BOUND',
};
```

`lib/desktop/lock.js`:

```js
export const LOCK_MS = 24 * 60 * 60 * 1000;
export const WARN_MS = 20 * 60 * 60 * 1000;
export const CLOCK_BACKSHIFT_MS = 5 * 60 * 1000;

export function evaluateDesktopLock({
  lastSuccessfulSyncAt,
  lastLocalNow,
  now,
  subscriptionActive,
}) {
  const nowMs = Number(now);
  const syncMs = Number(lastSuccessfulSyncAt);
  const lastLocalMs = Number(lastLocalNow);
  const hoursSinceSync = (nowMs - syncMs) / (60 * 60 * 1000);

  if (subscriptionActive === false) {
    return { locked: true, warning: false, hoursSinceSync, reason: 'subscription' };
  }
  if (Number.isFinite(lastLocalMs) && lastLocalMs - nowMs > CLOCK_BACKSHIFT_MS) {
    return { locked: true, warning: false, hoursSinceSync, reason: 'clock' };
  }
  if (nowMs - syncMs >= LOCK_MS) {
    return { locked: true, warning: true, hoursSinceSync, reason: 'stale' };
  }
  if (nowMs - syncMs >= WARN_MS) {
    return { locked: false, warning: true, hoursSinceSync, reason: null };
  }
  return { locked: false, warning: false, hoursSinceSync, reason: null };
}
```

`lib/desktop/documentNumbers.js`:

```js
export function formatDesktopDocNumber({ prefix, type, seq }) {
  return `${prefix}-${type}-${seq}`;
}

export function nextSeq(lastIssued) {
  return Number(lastIssued || 0) + 1;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/desktop/lock.test.js test/desktop/documentNumbers.test.js`

Expected: PASS

- [ ] **Step 5: Commit** (skip unless the user asked)

```bash
git add lib/desktop/codes.js lib/desktop/lock.js lib/desktop/documentNumbers.js test/desktop/lock.test.js test/desktop/documentNumbers.test.js
git commit -m "feat(desktop): add lock thresholds and document number helpers"
```

---

### Task 2: Pure outbox push rules

**Files:**
- Create: `lib/desktop/outboxState.js`
- Create: `test/desktop/outboxState.test.js`

**Interfaces:**
- Consumes: none
- Produces:
  - `OUTBOX_STATUS = { pending: 'pending', syncing: 'syncing', failed: 'failed', synced: 'synced' }`
  - `sortOutboxForPush(rows) → rows` ordered by `seq` ascending
  - `nextPushItem(rows) → row \| null` first `pending` or `syncing` (treat `syncing` as retry), **unless** any earlier `failed` exists (then `null`)
  - `canPullSnapshot(rows) → boolean` true only when no `pending`, `syncing`, or `failed`
  - `markPushFailure(rows, id, errorMessage) → rows` sets that id `failed`, leaves later items `pending`
  - `markPushSuccess(rows, id, serverId) → rows`

- [ ] **Step 1: Write failing tests**

```js
import { describe, expect, it } from 'vitest';
import {
  sortOutboxForPush,
  nextPushItem,
  canPullSnapshot,
  markPushFailure,
  markPushSuccess,
} from '../../lib/desktop/outboxState.js';

const rows = [
  { id: 'a', seq: 1, status: 'pending' },
  { id: 'b', seq: 2, status: 'pending' },
  { id: 'c', seq: 3, status: 'pending' },
];

describe('outbox push order', () => {
  it('pushes lowest seq first', () => {
    expect(nextPushItem(rows).id).toBe('a');
  });

  it('retries syncing before later pending', () => {
    const r = [
      { id: 'a', seq: 1, status: 'syncing' },
      { id: 'b', seq: 2, status: 'pending' },
    ];
    expect(nextPushItem(r).id).toBe('a');
  });

  it('stops when an earlier item failed', () => {
    const failed = markPushFailure(rows, 'b', 'stock 0');
    expect(failed.find((x) => x.id === 'b').status).toBe('failed');
    expect(failed.find((x) => x.id === 'c').status).toBe('pending');
    expect(nextPushItem(failed)).toBeNull();
    expect(canPullSnapshot(failed)).toBe(false);
  });

  it('allows snapshot pull only when drained', () => {
    let r = markPushSuccess(rows, 'a', 'srv-a');
    r = markPushSuccess(r, 'b', 'srv-b');
    r = markPushSuccess(r, 'c', 'srv-c');
    expect(canPullSnapshot(r)).toBe(true);
  });

  it('sorts by seq even if inserted out of order', () => {
    const mixed = [
      { id: 'c', seq: 3, status: 'pending' },
      { id: 'a', seq: 1, status: 'pending' },
    ];
    expect(sortOutboxForPush(mixed).map((x) => x.id)).toEqual(['a', 'c']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/desktop/outboxState.test.js`

Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```js
export const OUTBOX_STATUS = {
  pending: 'pending',
  syncing: 'syncing',
  failed: 'failed',
  synced: 'synced',
};

export function sortOutboxForPush(rows) {
  return [...rows].sort((a, b) => a.seq - b.seq);
}

export function nextPushItem(rows) {
  const sorted = sortOutboxForPush(rows);
  for (const row of sorted) {
    if (row.status === 'failed') return null;
    if (row.status === 'pending' || row.status === 'syncing') return row;
  }
  return null;
}

export function canPullSnapshot(rows) {
  return rows.every((r) => r.status === 'synced');
}

export function markPushFailure(rows, id, errorMessage) {
  return rows.map((r) =>
    r.id === id ? { ...r, status: 'failed', errorMessage } : r
  );
}

export function markPushSuccess(rows, id, serverId) {
  return rows.map((r) =>
    r.id === id ? { ...r, status: 'synced', serverId } : r
  );
}
```

Empty outbox: `canPullSnapshot([])` must be `true` (every() on [] is true). Add this assertion to the test file:

```js
  it('allows snapshot pull when outbox is empty', () => {
    expect(canPullSnapshot([])).toBe(true);
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/desktop/outboxState.test.js`

Expected: PASS

- [ ] **Step 5: Commit** (skip unless asked)

---

### Task 3: Operational path lists + runtime flag

**Files:**
- Create: `lib/desktop/runtime.js`
- Create: `lib/desktop/paths.js`
- Create: `test/desktop/paths.test.js`

**Interfaces:**
- Produces:
  - `DESKTOP_COOKIE = 'ib_desktop'`
  - `isDesktopRuntime() → process.env.DESKTOP_RUNTIME === '1'`
  - `isDesktopCookie(requestCookiesValue) → boolean`
  - `classifyDesktopApiPath(pathname) → 'operational' \| 'desktop-cloud' \| 'desktop-local' \| 'auth-ok' \| 'online-only'`
  - Operational prefixes: `/api/sales`, `/api/pos`, `/api/invoices`, `/api/clients`, `/api/stock`, `/api/payments`
  - `auth-ok`: `/api/auth/me`, `/api/auth/logout`, `/api/preferences/language`, `/api/auth/page-guard`, `/api/auth/api-guard`
  - `desktop-cloud`: `/api/desktop/bind|unbind|snapshot|outbox|heartbeat` (cloud only; local Next must not handle these against SQLite)
  - `desktop-local`: `/api/desktop-local`
  - Online-only exceptions inside operational prefixes (still `online-only`):
    - `/api/invoices/*/send`, `/api/invoices/upload`, `/api/invoices/export`, `/api/invoices/*/download`, `/api/invoices/*/attachments`
    - `/api/clients/send-email`, `/api/clients/bulk-upload`, `/api/clients/template`, `/api/clients/*/balance-reminder`
    - `/api/stock/receiving`, `/api/stock/basic-import`, `/api/stock/export`, `/api/stock/upload-image`, `/api/stock/basic-export`
    - `/api/payments/export`, `/api/payments/sync`
    - `/api/sales/export`, `/api/sales/receipts/export`, `/api/pos/cash-day/export`
    - `/api/pos/cash-day/deposit` (GL sweep to other accounts — online only)

- [ ] **Step 1: Write failing tests**

```js
import { describe, expect, it } from 'vitest';
import { classifyDesktopApiPath } from '../../lib/desktop/paths.js';

describe('classifyDesktopApiPath', () => {
  it('marks POS sale as operational', () => {
    expect(classifyDesktopApiPath('/api/sales')).toBe('operational');
    expect(classifyDesktopApiPath('/api/pos/cash-day/open')).toBe('operational');
  });

  it('marks invoice send as online-only', () => {
    expect(classifyDesktopApiPath('/api/invoices/abc/send')).toBe('online-only');
  });

  it('marks stock receiving as online-only', () => {
    expect(classifyDesktopApiPath('/api/stock/receiving')).toBe('online-only');
  });

  it('marks payroll as online-only', () => {
    expect(classifyDesktopApiPath('/api/payroll')).toBe('online-only');
    expect(classifyDesktopApiPath('/api/reports/trial-balance')).toBe('online-only');
  });

  it('allows language + me', () => {
    expect(classifyDesktopApiPath('/api/auth/me')).toBe('auth-ok');
    expect(classifyDesktopApiPath('/api/preferences/language')).toBe('auth-ok');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/desktop/paths.test.js`

Expected: FAIL (module not found)

- [ ] **Step 3: Implement `paths.js` and `runtime.js`**

`lib/desktop/runtime.js`:

```js
export const DESKTOP_COOKIE = 'ib_desktop';

export function isDesktopRuntime() {
  return process.env.DESKTOP_RUNTIME === '1';
}

export function isDesktopCookie(value) {
  return String(value || '') === '1';
}
```

Implement `classifyDesktopApiPath` with prefix startsWith checks. Exception list is tested with exact prefixes above; implement exceptions **before** the operational prefix match (longest-prefix / explicit deny list).

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/desktop/paths.test.js`

Expected: PASS

- [ ] **Step 5: Commit** (skip unless asked)

---

### Task 4: Prisma `DesktopDevice` + `DesktopOutboxReceipt`

**Files:**
- Modify: `prisma/schema.prisma` (Tenant relations + two new models)
- Create: `prisma/migrations/20260815120000_desktop_device/migration.sql`

**Interfaces:**
- Produces Prisma models:

```prisma
model DesktopDevice {
  id              String    @id @default(cuid())
  tenantId        String
  deviceId        String
  name            String
  numberPrefix    String
  boundAt         DateTime  @default(now())
  unboundAt       DateTime?
  lastHeartbeatAt DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  tenant          Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  receipts        DesktopOutboxReceipt[]

  @@unique([deviceId])
  @@index([tenantId, unboundAt])
  @@index([tenantId, numberPrefix])
}

model DesktopOutboxReceipt {
  id             String   @id
  tenantId       String
  deviceId       String
  kind           String
  serverEntityId String?
  resultJson     Json
  createdAt      DateTime @default(now())
  device         DesktopDevice @relation(fields: [deviceId], references: [deviceId], onDelete: Cascade)

  @@unique([tenantId, id])
  @@index([tenantId])
}
```

Add `desktopDevices DesktopDevice[]` on `Tenant`.

One-active-device is **application-enforced** (query `unboundAt: null`), not a unique constraint, so a tenant can re-bind after unbind and reuse `TILL1`.

- [ ] **Step 1: Write a schema smoke test**

Create `test/desktop/schemaModels.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('DesktopDevice schema', () => {
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
  it('declares DesktopDevice and DesktopOutboxReceipt', () => {
    expect(schema).toMatch(/model DesktopDevice/);
    expect(schema).toMatch(/model DesktopOutboxReceipt/);
    expect(schema).toMatch(/desktopDevices\s+DesktopDevice\[\]/);
  });
});
```

- [ ] **Step 2: Run test (fail), then add models + SQL, then pass**

Migration SQL:

```sql
CREATE TABLE "DesktopDevice" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "numberPrefix" TEXT NOT NULL,
  "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unboundAt" TIMESTAMP(3),
  "lastHeartbeatAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DesktopDevice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DesktopDevice_deviceId_key" ON "DesktopDevice"("deviceId");
CREATE INDEX "DesktopDevice_tenantId_unboundAt_idx" ON "DesktopDevice"("tenantId", "unboundAt");
CREATE INDEX "DesktopDevice_tenantId_numberPrefix_idx" ON "DesktopDevice"("tenantId", "numberPrefix");
ALTER TABLE "DesktopDevice" ADD CONSTRAINT "DesktopDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DesktopOutboxReceipt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "serverEntityId" TEXT,
  "resultJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DesktopOutboxReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DesktopOutboxReceipt_tenantId_id_key" ON "DesktopOutboxReceipt"("tenantId", "id");
CREATE INDEX "DesktopOutboxReceipt_tenantId_idx" ON "DesktopOutboxReceipt"("tenantId");
ALTER TABLE "DesktopOutboxReceipt" ADD CONSTRAINT "DesktopOutboxReceipt_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "DesktopDevice"("deviceId") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Generate client**

Run: `npx prisma generate`

Expected: client includes `desktopDevice` / `desktopOutboxReceipt`.

- [ ] **Step 4: Commit** (skip unless asked)

---

### Task 5: Cloud bind, unbind, heartbeat

**Files:**
- Create: `lib/desktop/cloud/bind.js`
- Create: `lib/desktop/cloud/heartbeat.js`
- Create: `app/api/desktop/bind/route.js`
- Create: `app/api/desktop/unbind/route.js`
- Create: `app/api/desktop/heartbeat/route.js`
- Create: `test/desktop/bind.test.js`
- Modify: `lib/tenantApiAccess.js` — add `{ prefix: '/api/desktop', anyOf: ['sales.create', 'invoices.create', 'inventory.update', 'payments.create', 'clients.create'] }` (any operational permission is enough to bind; handlers still `requireAuth`)

**Interfaces:**
- Consumes: `DESKTOP_CODES`, `getSubscriptionStatus` from `lib/subscriptionService.js`
- Produces:
  - `allocateNumberPrefix(existingPrefixes) → string` first unused `TILL1`…`TILL99`
  - `bindDesktopDevice({ prisma, tenantId, deviceId, name }) → { deviceId, numberPrefix, boundAt }`
  - `unbindDesktopDevice({ prisma, tenantId, deviceId }) → { ok: true }`
  - `heartbeatDesktopDevice({ prisma, tenantId, deviceId }) → { serverNow: string, bound: boolean, subscriptionActive: boolean, code?: string }`

Bind rules:
1. If another row for this `tenantId` has `unboundAt == null` and a **different** `deviceId` → throw `{ code: DESKTOP_CODES.DEVICE_BOUND }`
2. If this `deviceId` is already bound to this tenant → return existing prefix (idempotent)
3. If this `deviceId` exists on another tenant → throw 403
4. Else create with `allocateNumberPrefix`

Heartbeat: 401 if no user; 403 `NOT_BOUND` if device missing or `unboundAt` set; set `lastHeartbeatAt`; `subscriptionActive` is true when `getSubscriptionStatus(tenantId).status` is `'active'` or `'trial'`. If inactive, still return 200 with `subscriptionActive: false` and `code: SUBSCRIPTION_INACTIVE`.

- [ ] **Step 1: Write failing unit tests with an in-memory fake prisma**

```js
import { describe, expect, it } from 'vitest';
import { allocateNumberPrefix, bindDesktopDevice } from '../../lib/desktop/cloud/bind.js';
import { DESKTOP_CODES } from '../../lib/desktop/codes.js';

describe('allocateNumberPrefix', () => {
  it('starts at TILL1', () => {
    expect(allocateNumberPrefix([])).toBe('TILL1');
  });
  it('skips used prefixes', () => {
    expect(allocateNumberPrefix(['TILL1', 'TILL2'])).toBe('TILL3');
  });
});

function fakePrisma(seed = []) {
  const devices = [...seed];
  return {
    _devices: devices,
    desktopDevice: {
      findMany: async ({ where }) =>
        devices.filter((d) => d.tenantId === where.tenantId && (where.unboundAt === null ? d.unboundAt == null : true)),
      findFirst: async ({ where }) =>
        devices.find((d) => {
          if (where.tenantId && d.tenantId !== where.tenantId) return false;
          if (where.deviceId && d.deviceId !== where.deviceId) return false;
          if (where.unboundAt === null && d.unboundAt != null) return false;
          return true;
        }) || null,
      findUnique: async ({ where }) => devices.find((d) => d.deviceId === where.deviceId) || null,
      create: async ({ data }) => {
        const row = { ...data, unboundAt: null, boundAt: new Date() };
        devices.push(row);
        return row;
      },
    },
  };
}

describe('bindDesktopDevice', () => {
  it('rejects a second active device', async () => {
    const prisma = fakePrisma([
      { tenantId: 't1', deviceId: 'pc-a', numberPrefix: 'TILL1', unboundAt: null },
    ]);
    await expect(
      bindDesktopDevice({ prisma, tenantId: 't1', deviceId: 'pc-b', name: 'Shop' })
    ).rejects.toMatchObject({ code: DESKTOP_CODES.DEVICE_BOUND });
  });

  it('is idempotent for the same device', async () => {
    const prisma = fakePrisma([]);
    const a = await bindDesktopDevice({ prisma, tenantId: 't1', deviceId: 'pc-a', name: 'Shop' });
    const b = await bindDesktopDevice({ prisma, tenantId: 't1', deviceId: 'pc-a', name: 'Shop' });
    expect(a.numberPrefix).toBe('TILL1');
    expect(b.numberPrefix).toBe('TILL1');
  });
});
```

- [ ] **Step 2: Implement bind/heartbeat modules + thin routes**

Route pattern (all three):

```js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { bindDesktopDevice } from '@/lib/desktop/cloud/bind.js';
import { DESKTOP_CODES } from '@/lib/desktop/codes.js';

export async function POST(request) {
  const user = await getUserFromSession(request);
  if (!user?.tenantId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  try {
    const result = await bindDesktopDevice({
      prisma,
      tenantId: user.tenantId,
      deviceId: String(body.deviceId || ''),
      name: String(body.name || 'Till'),
    });
    return NextResponse.json(result);
  } catch (e) {
    const status = e.code === DESKTOP_CODES.DEVICE_BOUND ? 409 : 400;
    return NextResponse.json({ error: e.message, code: e.code }, { status });
  }
}
```

Unbind sets `unboundAt = now()` where `tenantId` + `deviceId` and `unboundAt` is null.

Heartbeat updates `lastHeartbeatAt` and returns ISO `serverNow: new Date().toISOString()`.

- [ ] **Step 3: Run tests**

Run: `npx vitest run test/desktop/bind.test.js`

Expected: PASS

- [ ] **Step 4: Commit** (skip unless asked)

---

### Task 6: Cloud snapshot builder

**Files:**
- Create: `lib/desktop/cloud/snapshot.js`
- Create: `app/api/desktop/snapshot/route.js`
- Create: `test/desktop/snapshot.test.js`

**Interfaces:**
- Produces: `buildDesktopSnapshot({ prisma, tenantId, userId }) → snapshot`

Snapshot shape (exact keys):

```js
{
  version: 1,
  tenantId: string,
  sessionUser: { id, name, email, tenantId, role: { id, name, permissions } },
  tenantSettings: { currencyCode, invoicePrefix, taxEnabled, defaultTaxRate, defaultLanguage },
  customers: Array,      // Client rows for tenant (isActive + archived)
  products: Array,       // Product + quantity + barcodes needed by POS
  taxTypes: Array,       // active tax types
  paymentAccounts: Array,
  openInvoices: Array,   // status not paid/void, include items
  recentPayments: Array, // last 90 days
  posConfig: { cashDay: object|null },
  serverNow: string,
}
```

GET `/api/desktop/snapshot` requires auth + bound device (`deviceId` query param). 403 `NOT_BOUND` otherwise.

- [ ] **Step 1: Write a test that the builder maps prisma results into those keys**

Use a fake prisma returning one client, one product, one tax type. Assert `snapshot.customers[0].id`, `snapshot.products[0].quantity`, `snapshot.version === 1`.

- [ ] **Step 2: Implement queries** (real prisma in `snapshot.js`; keep selects explicit — do not `include: true` the whole graph)

- [ ] **Step 3: Run** `npx vitest run test/desktop/snapshot.test.js` — Expected: PASS

- [ ] **Step 4: Commit** (skip unless asked)

---

### Task 7: Extract cloud `createSale` and idempotent outbox apply

**Files:**
- Create: `lib/sales/createSale.js` (move the existing POST body from `app/api/sales/route.js` **unchanged**, plus optional `saleNumber`)
- Modify: `app/api/sales/route.js` — POST becomes: auth → parse JSON → `createSale({ user, body, saleNumber })` → `NextResponse.json`
- Create: `lib/desktop/cloud/outboxApply.js`
- Create: `app/api/desktop/outbox/route.js`
- Create: `test/desktop/outboxApply.test.js`

**Interfaces:**
- Consumes: `createSale`, `openPosCashDay` / `closePosCashDay` from `lib/posCashDayService.js`, invoice/client/stock/payment existing functions as wired below
- Produces:
  - `createSale({ user, body, saleNumber }) → sale` — when `saleNumber` is a non-empty string, **do not** call `allocateNextSaleNumberReliable`; persist that number
  - `applyDesktopOutboxItem({ prisma, tenantId, user, deviceId, item: { id, kind, payload } }) → { serverId, result }`
  - Allowed `kind` values: `customer.upsert`, `customer.archive`, `stock.adjust`, `invoice.create`, `invoice.update`, `invoice.void`, `invoice.payment`, `pos.sale`, `pos.void`, `pos.refund`, `pos.cashDay.open`, `pos.cashDay.close`, `payment.create`
  - Unknown kind → throw `{ code: 'UNKNOWN_KIND' }`
  - If `DesktopOutboxReceipt` already has `{ tenantId, id }` → return stored `resultJson` without re-posting
  - After success, create receipt `{ id, tenantId, deviceId, kind, serverEntityId, resultJson }`

POST `/api/desktop/outbox` body: `{ deviceId, items: [{ id, kind, payload }] }`. Process **in array order**, stop on first failure, return `{ results: [...], stoppedAt?: id, error? }`. Do not apply later items after a failure.

- [ ] **Step 1: Idempotency tests with fake prisma + fake handlers**

```js
import { describe, expect, it, vi } from 'vitest';
import { applyDesktopOutboxItem } from '../../lib/desktop/cloud/outboxApply.js';

describe('applyDesktopOutboxItem', () => {
  it('returns the original result on duplicate id', async () => {
    const receipts = [
      { tenantId: 't1', id: 'm1', resultJson: { serverId: 'sale-1' }, serverEntityId: 'sale-1' },
    ];
    const createSale = vi.fn();
    const prisma = {
      desktopOutboxReceipt: {
        findUnique: async ({ where }) =>
          receipts.find((r) => r.tenantId === where.tenantId_id.tenantId && r.id === where.tenantId_id.id) || null,
        create: async ({ data }) => {
          receipts.push(data);
          return data;
        },
      },
    };
    const first = await applyDesktopOutboxItem({
      prisma,
      tenantId: 't1',
      user: { id: 'u1', tenantId: 't1' },
      deviceId: 'pc-a',
      item: { id: 'm1', kind: 'pos.sale', payload: {} },
      handlers: { 'pos.sale': createSale },
    });
    expect(first.serverId).toBe('sale-1');
    expect(createSale).not.toHaveBeenCalled();
  });

  it('calls handler once for a new id', async () => {
    const receipts = [];
    const createSale = vi.fn(async () => ({ id: 'sale-2' }));
    const prisma = {
      desktopOutboxReceipt: {
        findUnique: async () => null,
        create: async ({ data }) => {
          receipts.push(data);
          return data;
        },
      },
    };
    const r = await applyDesktopOutboxItem({
      prisma,
      tenantId: 't1',
      user: { id: 'u1', tenantId: 't1' },
      deviceId: 'pc-a',
      item: { id: 'm2', kind: 'pos.sale', payload: { total: 1 }, saleNumber: 'TILL1-SALE-1' },
      handlers: { 'pos.sale': createSale },
    });
    expect(createSale).toHaveBeenCalledTimes(1);
    expect(r.serverId).toBe('sale-2');
    expect(receipts).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Implement `applyDesktopOutboxItem` with injectable `handlers` defaulting to real services**

Default handlers:
- `'pos.sale'` → `createSale({ user, body: payload, saleNumber: payload.saleNumber })` then `serverId = sale.id`
- `'pos.cashDay.open'` → `openPosCashDay({ tenantId, userId: user.id, ...payload })`
- `'pos.cashDay.close'` → existing close function from `lib/posCashDayService.js`
- `'pos.void'` → move the POST body of `app/api/sales/[id]/void/route.js` into `lib/sales/voidSale.js` as `voidSale({ user, saleId })`; route becomes a wrapper
- `'pos.refund'` → move the POST body of `app/api/sales/[id]/refund/route.js` into `lib/sales/refundSale.js` as `refundSale({ user, saleId, body })`
- `'invoice.create'` → move invoice POST create from `app/api/invoices/route.js` into `lib/invoices/createInvoice.js` as `createInvoice({ user, body, invoiceNumber })` (optional `invoiceNumber` skips `allocateNextInvNumberReliable`)
- `'invoice.update'` → move PUT/PATCH from `app/api/invoices/[id]/route.js` into `lib/invoices/updateInvoice.js`
- `'invoice.void'` → move `app/api/invoices/void/route.js` into `lib/invoices/voidInvoice.js`
- `'invoice.payment'` → move `app/api/invoices/partial-payment/route.js` into `lib/invoices/recordInvoicePayment.js`
- `'customer.upsert'` → prisma `client` upsert using the same fields as `app/api/clients/route.js` POST / `app/api/clients/[id]/route.js` PUT
- `'customer.archive'` → set `isActive: false` on `client` as `app/api/clients/[id]/route.js` does for archive
- `'stock.adjust'` → prisma product quantity update using the same validation as `app/api/stock/[id]/route.js` PATCH
- `'payment.create'` → move POST body of `app/api/payments/route.js` into `lib/payments/createPayment.js` as `createPayment({ user, body })`

`createSale` extract: cut the POST implementation from `app/api/sales/route.js` into `lib/sales/createSale.js`. The only behavior change allowed is: if `saleNumber` is passed, skip `allocateNextSaleNumberReliable` and use it.

- [ ] **Step 3: Run** `npx vitest run test/desktop/outboxApply.test.js`

Expected: PASS

Also run a quick sanity: `npx vitest run test/saleItemBaseQuantity.test.js` to ensure the extract did not break sale math.

- [ ] **Step 4: Commit** (skip unless asked)

---

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

### Task 9: Local operational handlers + write lock

**Files:**
- Create: `lib/desktop/local/handlers.js`
- Create: `lib/desktop/local/writeGate.js`
- Create: `app/api/desktop-local/[...path]/route.js`
- Create: `test/desktop/localHandlers.test.js`

**Interfaces:**
- Consumes: sqlite stores, `evaluateDesktopLock`, `formatDesktopDocNumber`, `DESKTOP_CODES`
- Produces:
  - `handleDesktopLocal({ db, method, pathname, searchParams, body, now }) → { status, json }`
  - `assertWritable(db, now)` throws `{ code: DESKTOP_CODES.SYNC_REQUIRED, status: 403 }` when lock.locked
  - Local POS sale POST `/sales`:
    1. `assertWritable`
    2. decrement product quantities in `products`
    3. allocate `TILL1-SALE-N` via `doc_counters` type `SALE`
    4. insert `sales` row
    5. `appendOutbox` kind `pos.sale` with payload + `saleNumber`
    6. return JSON shaped like cloud sale create (`success`/`sale` keys matching `app/api/sales/route.js` POST response)
  - Local GET `/sales` lists `sales` table + snapshot
  - Local POST `/pos/cash-day/open` and `/close` similarly with kinds `pos.cashDay.open` / `pos.cashDay.close`
  - Local customer POST/PUT, invoice POST/PUT/void/payment, stock PATCH quantity, payment POST — each: lock check → mutate snapshot table → outbox
  - GET is allowed while locked; POST/PUT/PATCH/DELETE of operational resources is not

Catch-all route:

```js
import { NextResponse } from 'next/server';
import { isDesktopRuntime } from '@/lib/desktop/runtime.js';
import { DESKTOP_CODES } from '@/lib/desktop/codes.js';
import { getDesktopDbFromEnv } from '@/lib/desktop/sqlite/db.js';
import { handleDesktopLocal } from '@/lib/desktop/local/handlers.js';
import { getUserFromSession } from '@/lib/auth';

export async function GET(request, ctx) { return dispatch(request, ctx); }
export async function POST(request, ctx) { return dispatch(request, ctx); }
export async function PUT(request, ctx) { return dispatch(request, ctx); }
export async function PATCH(request, ctx) { return dispatch(request, ctx); }
export async function DELETE(request, ctx) { return dispatch(request, ctx); }

async function dispatch(request, ctx) {
  if (!isDesktopRuntime()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const user = await getUserFromSession(request);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const parts = (await ctx.params).path || [];
  const pathname = '/api/' + parts.join('/');
  const body = ['GET', 'HEAD'].includes(request.method) ? null : await request.json().catch(() => ({}));
  const result = handleDesktopLocal({
    db: getDesktopDbFromEnv(),
    method: request.method,
    pathname,
    searchParams: Object.fromEntries(new URL(request.url).searchParams),
    body,
    now: Date.now(),
    user,
  });
  return NextResponse.json(result.json, { status: result.status });
}
```

`getDesktopDbFromEnv()` opens `process.env.DESKTOP_SQLITE_PATH` or `%APPDATA%/InsightBooks/desktop.sqlite` via `lib/desktop/sqlite/userDataPath.js` (`join(process.env.APPDATA, 'InsightBooks', 'desktop.sqlite')` on win32). Tests pass an explicit db.

- [ ] **Step 1: Failing tests for sale + lock**

```js
import { describe, expect, it } from 'vitest';
import { openDesktopDb } from '../../lib/desktop/sqlite/db.js';
import { replaceSnapshot } from '../../lib/desktop/sqlite/snapshotStore.js';
import { writeMeta } from '../../lib/desktop/sqlite/meta.js';
import { handleDesktopLocal } from '../../lib/desktop/local/handlers.js';
import { listOutbox } from '../../lib/desktop/sqlite/outboxStore.js';
import { DESKTOP_CODES } from '../../lib/desktop/codes.js';

const t0 = Date.parse('2026-08-15T10:00:00.000Z');

function seed(db) {
  writeMeta(db, {
    tenantId: 't1',
    deviceId: 'pc-a',
    numberPrefix: 'TILL1',
    lastSuccessfulSyncAt: String(t0),
    lastLocalNow: String(t0),
    lastServerNow: '2026-08-15T10:00:00.000Z',
    subscriptionActive: 'true',
  });
  replaceSnapshot(db, {
    version: 1,
    tenantId: 't1',
    products: [{ id: 'p1', quantity: 10, name: 'Bread', sellingPrice: 1000 }],
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
}

describe('handleDesktopLocal POS sale', () => {
  it('writes sale, decrements stock, appends outbox', () => {
    const db = openDesktopDb(':memory:');
    seed(db);
    const res = handleDesktopLocal({
      db,
      method: 'POST',
      pathname: '/api/sales',
      body: { items: [{ productId: 'p1', quantity: 2, price: 1000 }], payments: [] },
      now: t0 + 60 * 1000,
      user: { id: 'u1', tenantId: 't1' },
    });
    expect(res.status).toBe(200);
    expect(res.json.sale.saleNumber).toBe('TILL1-SALE-1');
    expect(listOutbox(db)[0].kind).toBe('pos.sale');
  });

  it('rejects writes after 24h', () => {
    const db = openDesktopDb(':memory:');
    seed(db);
    const res = handleDesktopLocal({
      db,
      method: 'POST',
      pathname: '/api/sales',
      body: { items: [{ productId: 'p1', quantity: 1, price: 1000 }] },
      now: t0 + 24 * 60 * 60 * 1000,
      user: { id: 'u1', tenantId: 't1' },
    });
    expect(res.status).toBe(403);
    expect(res.json.code).toBe(DESKTOP_CODES.SYNC_REQUIRED);
  });

  it('allows GET while locked', () => {
    const db = openDesktopDb(':memory:');
    seed(db);
    const res = handleDesktopLocal({
      db,
      method: 'GET',
      pathname: '/api/sales',
      body: null,
      now: t0 + 24 * 60 * 60 * 1000,
      user: { id: 'u1', tenantId: 't1' },
    });
    expect(res.status).toBe(200);
  });
});
```

POS page may expect `{ sales: [] }` or a paginated object — match the current GET response keys from `app/api/sales/route.js` (copy the JSON field names; do not invent a new envelope).

- [ ] **Step 2: Implement handlers for the allowlisted kinds** (sales/pos/clients/invoices/stock/payments). Unmatched operational path → 501 with a clear error so missing handlers are obvious.

- [ ] **Step 3: Run** `npx vitest run test/desktop/localHandlers.test.js` — Expected: PASS

- [ ] **Step 4: Commit** (skip unless asked)

---

### Task 10: Desktop auth, middleware rewrite, online-only

**Files:**
- Create: `lib/desktop/local/session.js`
- Modify: `lib/auth.js` — at the top of `getUserFromSession`, if `isDesktopRuntime()`, return `getDesktopSessionUser(request)` (load `sessionUser` from sqlite; still require a valid `session` cookie whose `userId` matches)
- Modify: `middleware.js`
- Modify: `lib/tenantApiAccess.js` if needed so `/api/desktop-local` is not 401 from edge guard
- Create: `test/desktop/session.test.js`
- Create: `test/desktop/middlewareClassify.test.js` (unit-test the classify helper; do not boot Next middleware)

**Interfaces:**
- Produces: `getDesktopSessionUser(request) → user | null`
- Middleware when cookie `ib_desktop=1`:
  1. Skip `finishApiRouteAccess` / `finishTenantRouteAccess` prisma guards (those call `/api/auth/api-guard` which needs Postgres)
  2. If `classifyDesktopApiPath` is `operational`, rewrite to `/api/desktop-local` + original path without `/api` prefix (example: `/api/sales` → `/api/desktop-local/sales`)
  3. If `online-only` API → JSON 503 `{ code: DESKTOP_CODES.ONLINE_ONLY, error: 'This area needs internet.' }`
  4. If `desktop-cloud` on local runtime → 404 (Electron sync worker calls the live origin, not 127.0.0.1)
  5. Allow `auth-ok` and `/api/desktop-local` through
  6. Skip cutover freeze for desktop cookie (till must sell while cloud is in maintenance only if already bound — still skip cutover locally)

First-launch login stays on the **cloud** origin (Electron); local Next is not used until sqlite has `sessionUser`.

Onboarding: modify `components/OnboardingGate.js` so if `document.cookie` includes `ib_desktop=1`, render children immediately (onboarding already completed in cloud).

- [ ] **Step 1: Session tests**

```js
import { describe, expect, it } from 'vitest';
import { openDesktopDb } from '../../lib/desktop/sqlite/db.js';
import { replaceSnapshot } from '../../lib/desktop/sqlite/snapshotStore.js';
import { getDesktopSessionUserFromDb } from '../../lib/desktop/local/session.js';

it('returns snapshot user when ids match', () => {
  const db = openDesktopDb(':memory:');
  replaceSnapshot(db, {
    version: 1,
    tenantId: 't1',
    sessionUser: {
      id: 'u1',
      name: 'Ada',
      email: 'ada@example.com',
      tenantId: 't1',
      role: { id: 'r1', name: 'Admin', permissions: ['sales.create'] },
    },
    products: [],
    customers: [],
    taxTypes: [],
    paymentAccounts: [],
    openInvoices: [],
    recentPayments: [],
    tenantSettings: {},
    posConfig: {},
    serverNow: '2026-08-15T10:00:00.000Z',
  });
  const user = getDesktopSessionUserFromDb(db, { userId: 'u1', tenantId: 't1' });
  expect(user.email).toBe('ada@example.com');
  expect(user.role.permissions).toContain('sales.create');
});
```

- [ ] **Step 2: Implement session + middleware branches** (keep existing non-desktop flow byte-identical)

- [ ] **Step 3: Run** `npx vitest run test/desktop/session.test.js test/desktop/paths.test.js test/desktop/middlewareClassify.test.js`

Expected: PASS

- [ ] **Step 4: Commit** (skip unless asked)

---

### Task 11: Sync worker (heartbeat → push → snapshot)

**Files:**
- Create: `lib/desktop/syncWorker.js`
- Create: `test/desktop/syncWorker.test.js`

**Interfaces:**
- Consumes: `outboxState.js`, sqlite stores, lock.js
- Produces: `runDesktopSync({ db, cloud, now }) → { ok, lastSuccessfulSyncAt?, error?, failedItemId? }`

`cloud` is an injected client:

```js
{
  heartbeat: async ({ deviceId }) => ({ serverNow, bound, subscriptionActive, code }),
  pushItems: async ({ deviceId, items }) => ({ results, stoppedAt, error }),
  pullSnapshot: async ({ deviceId }) => snapshot,
}
```

Algorithm (exact):
1. `heartbeat`. If `!bound` → return error `NOT_BOUND`. Write `subscriptionActive` into meta. If `!subscriptionActive` → return `{ ok: false, error: SUBSCRIPTION_INACTIVE }` without pulling.
2. `listOutbox` not synced. While `nextPushItem`:
   - mark `syncing`
   - `pushItems` with **that one item** (or a batch that the server applies in order and stops — client still sends remaining only after success)
   - on success `markPushSuccess` persisted
   - on failure `markPushFailure`, copy to sync issues (failed outbox row is enough), **return** without snapshot pull
3. If `canPullSnapshot(listOutbox(db))`:
   - `pullSnapshot`
   - `replaceSnapshot`
   - `writeMeta({ lastSuccessfulSyncAt: Date.parse(serverNow), lastServerNow: serverNow, lastLocalNow: String(now) })`
   - return `{ ok: true, lastSuccessfulSyncAt }`
4. Heartbeat-only (outbox not drained) must **not** write `lastSuccessfulSyncAt`

Also export `syncStatusFromDb(db, now)` → `{ locked, warning, hoursSinceSync, lastSuccessfulSyncAt, pendingCount, failedCount }` for the banner.

- [ ] **Step 1: Failing tests**

```js
import { describe, expect, it, vi } from 'vitest';
import { openDesktopDb } from '../../lib/desktop/sqlite/db.js';
import { replaceSnapshot } from '../../lib/desktop/sqlite/snapshotStore.js';
import { appendOutbox, listOutbox } from '../../lib/desktop/sqlite/outboxStore.js';
import { writeMeta, readMeta } from '../../lib/desktop/sqlite/meta.js';
import { runDesktopSync } from '../../lib/desktop/syncWorker.js';

const t0 = Date.parse('2026-08-15T10:00:00.000Z');

function seedDb() {
  const db = openDesktopDb(':memory:');
  writeMeta(db, {
    tenantId: 't1',
    deviceId: 'pc-a',
    numberPrefix: 'TILL1',
    lastSuccessfulSyncAt: String(t0),
    lastLocalNow: String(t0),
    lastServerNow: '2026-08-15T10:00:00.000Z',
    subscriptionActive: 'true',
  });
  replaceSnapshot(db, {
    version: 1,
    tenantId: 't1',
    products: [],
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
  return db;
}

describe('runDesktopSync', () => {
  it('does not refresh lastSuccessfulSyncAt on heartbeat-only when outbox failed', async () => {
    const db = seedDb();
    appendOutbox(db, { id: 'm1', kind: 'pos.sale', payload: {} });
    appendOutbox(db, { id: 'm2', kind: 'pos.sale', payload: {} });
    const cloud = {
      heartbeat: async () => ({
        serverNow: '2026-08-15T12:00:00.000Z',
        bound: true,
        subscriptionActive: true,
      }),
      pushItems: async ({ items }) => {
        if (items[0].id === 'm1') {
          return { results: [], stoppedAt: 'm1', error: 'stock 0' };
        }
        throw new Error('must not push m2');
      },
      pullSnapshot: vi.fn(),
    };
    const r = await runDesktopSync({ db, cloud, now: t0 + 2 * 60 * 60 * 1000 });
    expect(r.ok).toBe(false);
    expect(listOutbox(db).find((x) => x.id === 'm1').status).toBe('failed');
    expect(listOutbox(db).find((x) => x.id === 'm2').status).toBe('pending');
    expect(cloud.pullSnapshot).not.toHaveBeenCalled();
    expect(readMeta(db).lastSuccessfulSyncAt).toBe(String(t0));
  });

  it('pushes two sales then pulls snapshot and stamps lastSuccessfulSyncAt', async () => {
    const db = seedDb();
    appendOutbox(db, { id: 'm1', kind: 'pos.sale', payload: {} });
    appendOutbox(db, { id: 'm2', kind: 'pos.sale', payload: {} });
    const cloud = {
      heartbeat: async () => ({
        serverNow: '2026-08-15T12:00:00.000Z',
        bound: true,
        subscriptionActive: true,
      }),
      pushItems: async ({ items }) => ({
        results: [{ id: items[0].id, serverId: 'srv-' + items[0].id }],
      }),
      pullSnapshot: async () => ({
        version: 1,
        tenantId: 't1',
        products: [{ id: 'p1', quantity: 9, name: 'Bread' }],
        customers: [],
        taxTypes: [],
        paymentAccounts: [],
        openInvoices: [],
        recentPayments: [],
        sessionUser: { id: 'u1' },
        tenantSettings: {},
        posConfig: {},
        serverNow: '2026-08-15T12:00:00.000Z',
      }),
    };
    const r = await runDesktopSync({ db, cloud, now: t0 + 1000 });
    expect(r.ok).toBe(true);
    expect(readMeta(db).lastSuccessfulSyncAt).toBe(String(Date.parse('2026-08-15T12:00:00.000Z')));
  });
});
```

- [ ] **Step 2: Implement `runDesktopSync` + a `createCloudClient({ baseUrl, cookie })` that fetch()es `/api/desktop/heartbeat|outbox|snapshot` with credentials**

- [ ] **Step 3: Run** `npx vitest run test/desktop/syncWorker.test.js` — Expected: PASS

- [ ] **Step 4: Commit** (skip unless asked)

---

### Task 12: Banner, footer, sync issues UI

**Files:**
- Create: `app/api/desktop-local/sync-status/route.js` (or handle `/sync-status` inside desktop-local dispatch — pathname `/api/sync-status` is **not** operational; add `classify` value `desktop-local` for `/api/desktop-local/sync-status` only)
- Create: `components/desktop/DesktopSyncBanner.jsx`
- Create: `components/desktop/DesktopSyncFooter.jsx`
- Create: `app/desktop/sync-issues/page.js`
- Modify: `components/shell/AppShell.jsx` — render banner above `<main>`, footer line in existing footer region
- Modify: `locales/en/common.json` and `locales/ny/common.json` with keys:
  - `desktop.banner.warning` en: `Sync required soon. {hours} hours left.` ny: `Kufunika kulumikizana posachedwa. Maola {hours} otsala.`
  - `desktop.banner.locked` en: `Connect to the internet to sync. New sales are paused.` ny: `Lumikizani intaneti kuti mugwirizanitse. Malonda atsopano aletsedwa.`
  - `desktop.footer.lastSynced` en: `Last synced: {time}` ny: `Kugwirizanitsa komaliza: {time}`
  - `desktop.syncNow` en: `Sync now` ny: `Gwirizanitsani tsopano`
  - `desktop.syncIssues` en: `Sync issues` ny: `Mavuto a kugwirizanitsa`
  - `desktop.onlineOnly` en: `This area needs internet.` ny: `Malo ano amafunika intaneti.`

**Interfaces:**
- Banner hidden unless `ib_desktop=1` (check cookie in the client component).
- Poll `GET /api/desktop-local/sync-status` every 60s.
- Warning (20–24h): remaining hours + Sync now (`POST /api/desktop-local/sync-now` which calls `runDesktopSync`).
- Locked (≥24h or clock/subscription): locked copy; Sync now still enabled; POS/invoice **pages** stay viewable.
- Footer always shows last sync time on desktop.
- Sync issues page lists failed outbox `id`, `kind`, `errorMessage` (no skip button).

- [ ] **Step 1: Add a unit test for remaining-hours copy helper**

Create `lib/desktop/lockCopy.js`:

```js
export function hoursLeft(lockMs, hoursSinceSync) {
  return Math.max(0, lockMs / 3600000 - hoursSinceSync);
}
```

Test `hoursLeft(LOCK_MS, 21) === 3`.

- [ ] **Step 2: Implement components; mount in AppShell only when desktop cookie present** (read `document.cookie` on client; never show on web)

- [ ] **Step 3: Run** `npx vitest run test/desktop/lock.test.js` plus the new copy test

- [ ] **Step 4: Commit** (skip unless asked)

---

### Task 13: Electron shell + Windows installer + download link

**Files:**
- Create: `desktop/package.json`
- Create: `desktop/main.cjs`
- Create: `desktop/preload.cjs`
- Create: `desktop/electron-builder.yml`
- Create: `desktop/README.md` (build commands only)
- Modify: `package.json` (root) — scripts `"desktop:dev"`, `"desktop:build"`
- Modify: `app/download-app/page.js` — add Windows x64 download card next to the APK card, linking `/downloads/InsightBooks-desktop-setup.exe` (same pattern as APK; file may be absent until CI publishes — page already handles pending dates)

**Interfaces:**
- `desktop/main.cjs`:
  1. `userData` = `app.getPath('userData')` → SQLite path `join(userData, 'desktop.sqlite')`
  2. Generate and persist `deviceId` (uuid) in `userData/device.json`
  3. If meta not bound: `BrowserWindow` loads `DESKTOP_CLOUD_URL` (env, default production origin) + `/auth/login?desktop=1`. After login, renderer (or a small `/desktop/setup` cloud page) POSTs `/api/desktop/bind` with `deviceId`, GET snapshot, then IPC `desktop:importSnapshot` writes sqlite + session cookie into the Electron session, then load local Next
  4. If bound: spawn Next standalone (`node server.js`) with env `DESKTOP_RUNTIME=1`, `PORT=3791`, `HOSTNAME=127.0.0.1`, `DESKTOP_SQLITE_PATH=...`, `DESKTOP_CLOUD_URL=...`. Wait until `http://127.0.0.1:3791` responds. Set cookie `ib_desktop=1` on that origin. Load it
  5. Every 15 minutes and on `app.on('browser-window-created')` if online, run `runDesktopSync` in the **main** process (better-sqlite3 + fetch to cloud). Also on `net.on('online')` if available
  6. Unbind: online POST `/api/desktop/unbind`, then delete sqlite and relaunch setup

Cloud `/desktop/setup` page (create `app/desktop/setup/page.js`): authenticated, shows “Set up this PC”, calls bind + snapshot download via fetch, then `window.desktopBridge.finishSetup(snapshot, sessionCookie)`. Add `/desktop/setup` to middleware public? No — requires session. Do not hide AppShell if we want branding; simplest is a dedicated client page.

`desktop/package.json` scripts:
- `"start": "electron ."`
- `"dist": "electron-builder --win nsis --x64"`

electron-builder `win.target: nsis`, `artifactName: InsightBooks-desktop-setup.exe`. Extra resources: Next standalone output from `npm run build:standalone` at repo root (document in README: build Next first, then `npm run dist` in `desktop/`).

Do not add mac/linux targets.

- [ ] **Step 1: Write a unit test for setup payload validation**

`lib/desktop/setupPayload.js`:

```js
export function assertSetupSnapshot(snapshot) {
  if (!snapshot || snapshot.version !== 1 || !snapshot.tenantId) {
    throw new Error('Invalid snapshot');
  }
  return true;
}
```

Test valid vs missing tenantId.

- [ ] **Step 2: Implement Electron main + setup page + download-app Windows card**

Keep Electron code CommonJS (`.cjs`) so it runs without ESM issues. Import compiled sync worker via `path.join(__dirname, '..', 'lib', 'desktop', 'syncWorker.js')` only if the root package `"type"` allows; otherwise duplicate a tiny CJS wrapper `desktop/runSync.cjs` that dynamic-imports the ESM module.

- [ ] **Step 3: Manual smoke (do not claim done without this checklist in the PR)**
  1. Bind with network
  2. Airplane mode → POS sale
  3. Online → sale visible in web app with `TILL1-SALE-…`
  4. Confirm web browser without the app is unchanged

- [ ] **Step 4: Commit** (skip unless asked)

---

## Self-review (spec coverage)

| Spec requirement | Task |
|------------------|------|
| Electron + SQLite + outbox | 8, 9, 13 |
| One PC per tenant / bind prefix | 5 |
| First launch internet + snapshot | 6, 13 |
| Offline POS/invoices/customers/stock/payments | 9, 10 |
| Online-only payroll/tax/reports/MRA/admin | 3, 10 |
| Ordered outbox, stop on fail, no skip | 2, 7, 11 |
| Snapshot pull only when drained | 2, 11 |
| 20h banner / 24h write lock | 1, 9, 12 |
| Clock rollback lock | 1, 9 |
| Heartbeat does not extend deadline | 11 |
| Idempotent outbox ids | 7 |
| Subscription inactive = write lock | 1, 5, 11 |
| Unbind wipes sqlite | 5, 13 |
| Minimal UI, no forked POS pages | 10, 12 |
| Windows x64 installer + download link | 13 |
| Tests listed in spec | 1, 2, 7, 8, 9, 11 |

Out of this plan (spec non-goals): macOS/Linux, multi-till, offline payroll/tax/reports, last-write-wins, SQLite encryption.
