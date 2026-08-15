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
