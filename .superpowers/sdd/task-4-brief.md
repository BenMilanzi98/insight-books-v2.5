### Task 4: Hirings workspace (Customer + Supplier tabs)

**Files:**
- Create: `components/rentals/InboundHiringPanel.jsx` (move client UI from inbound page)
- Create/Replace: `app/rentals/hirings/page.js`
- Replace: `app/rentals/hiring/page.js` → redirect
- Replace: `app/rentals/inbound-hiring/page.js` → redirect after extract
- Reuse: `app/rentals/RentalsClient.js` with `mode="hiring"`

**Interfaces:**
- Consumes: `?tab=customer|supplier` (default `customer`)
- Produces: single page with two tabs; supplier panel uses existing `/api/hiring-v2/*`

- [ ] **Step 1: Extract inbound UI**

Move the client component body from `app/rentals/inbound-hiring/page.js` into `components/rentals/InboundHiringPanel.jsx` as `export default function InboundHiringPanel()`. Keep API calls identical.

- [ ] **Step 2: Build `app/rentals/hirings/page.js`**

Client page pattern:

```jsx
'use client';
import { useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PermissionGuard from '@/components/PermissionGuard';
import PosStylePageHeader from '@/components/shell/PosStylePageHeader';
import RentalsClient from '../RentalsClient';
import InboundHiringPanel from '@/components/rentals/InboundHiringPanel';

export default function HiringsPage() {
  const search = useSearchParams();
  const router = useRouter();
  const tab = search.get('tab') === 'supplier' ? 'supplier' : 'customer';

  const setTab = (next) => {
    router.replace(`/rentals/hirings?tab=${next}`);
  };

  return (
    <PermissionGuard permissions={['rentals.view']}>
      <div className="w-full p-4 sm:p-6">
        <PosStylePageHeader
          title="Hirings"
          subtitle="Customer hire (outbound) and supplier hire (inbound)"
        />
        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => setTab('customer')} className={tab === 'customer' ? 'font-semibold' : ''}>
            Customer hire
          </button>
          <button type="button" onClick={() => setTab('supplier')} className={tab === 'supplier' ? 'font-semibold' : ''}>
            Supplier hire
          </button>
        </div>
        {tab === 'customer' ? <RentalsClient mode="hiring" embedded /> : <InboundHiringPanel />}
      </div>
    </PermissionGuard>
  );
}
```

If `RentalsClient` always renders its own full page chrome, add optional `embedded` prop to suppress duplicate title when true (minimal change: hide outer H1 when `embedded`).

Wrap with `Suspense` for `useSearchParams` if Next requires it.

- [ ] **Step 3: Redirects from old pages**

`hiring/page.js` and `inbound-hiring/page.js` become server redirects.

- [ ] **Step 4: Smoke check**

- Customer tab books → invoice with `isRentalInvoice` appears on `/invoices`.
- Supplier tab lists requests — no customer invoice created.

- [ ] **Step 5: Commit only if user asked**

---

