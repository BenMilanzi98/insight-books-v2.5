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

