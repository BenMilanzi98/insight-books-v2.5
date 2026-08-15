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

