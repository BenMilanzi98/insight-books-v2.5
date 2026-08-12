### Task 3: Sidebar — three hubs + redirects + route permissions

**Files:**
- Modify: `components/Sidebar/Sidebar.js` (all three nav definitions: expandable subItems, `rental` group, `rentalSubItems`)
- Modify: `next.config.mjs` redirects
- Modify: path permission map in Sidebar (`"/rentals/hirings"`, `"/rentals/reports"`)

**Interfaces:**
- Produces: operators only see three links; old URLs redirect.

- [ ] **Step 1: Update sidebar subItems everywhere to**

```js
{ href: "/rentals", text: "Rentals", icon: "Rentals", permission: "rentals.view" },
{ href: "/rentals/hirings", text: "Hirings", icon: "Hiring", permission: "rentals.view" },
{ href: "/rentals/reports", text: "Reports", icon: "Reports", permission: "rentals.view" },
```

Remove Contracts V2, Quotations V2, Rental reconcile, Quantity rentals, Supplier hiring from sidebar arrays. Keep `ROUTE_PERMISSIONS` entries for deep-link pages if they still need access when visited directly.

Add:

```js
"/rentals/hirings": ["rentals.view"],
"/rentals/reports": ["rentals.view"],
```

- [ ] **Step 2: Redirects in `next.config.mjs`**

```js
{
  source: '/rentals/hiring',
  destination: '/rentals/hirings?tab=customer',
  permanent: false,
},
{
  source: '/rentals/inbound-hiring',
  destination: '/rentals/hirings?tab=supplier',
  permanent: false,
},
```

Note: Next.js redirects may strip query on some versions — if `?tab=` is unreliable, implement thin pages at old paths that `redirect()` from `next/navigation` with tab query instead.

Preferred fallback — replace `app/rentals/hiring/page.js`:

```js
import { redirect } from 'next/navigation';
export default function LegacyHiringRedirect() {
  redirect('/rentals/hirings?tab=customer');
}
```

And `app/rentals/inbound-hiring/page.js` → redirect to supplier tab (move UI into extracted component first in Task 4, then redirect this file).

- [ ] **Step 3: Manual check**

With `npm run dev`, open sidebar under Rental & Hiring — only three items. Hit `/rentals/hiring` — lands on Hirings customer tab (after Task 4 page exists; until then redirect may 404 — order Task 4 immediately after or create stub page in this task).

- [ ] **Step 4: Stub pages if Task 4 not yet done**

Create minimal `app/rentals/hirings/page.js` and `app/rentals/reports/page.js` placeholders (“Coming soon”) so redirects do not 404; Task 4/5 replace stubs.

- [ ] **Step 5: Commit only if user asked**

---

