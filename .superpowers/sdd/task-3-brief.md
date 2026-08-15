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

