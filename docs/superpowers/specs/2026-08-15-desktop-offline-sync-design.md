# Design: InsightBooks Desktop (offline operations + 24-hour sync)

**Date:** 2026-08-15  
**Status:** Approved (Approach 1 — Electron + snapshot + outbox)  
**Scope:** One Windows PC per business. Offline POS, invoices, customers, stock, and payments. Live check-in required every 24 hours.

## Goal

Ship a Windows desktop app that lets a shop run daily operations with no internet, then sync those records to the live InsightBooks server. If the PC has not completed a successful sync for 24 hours, new transactions are blocked until it connects again.

## Locked decisions

| Topic | Choice |
|-------|--------|
| Offline modules | POS, invoices, customers, stock, payments only |
| Online-only | Payroll, tax, reports, MRA EIS, admin, settings that call non-operational APIs |
| Devices | One offline PC per tenant (no multi-till merge in v1) |
| Shell | Electron (reuses `@madrimov/electron-pos-printer`) |
| Local store | SQLite snapshot + ordered outbox |
| Source of truth | Live PostgreSQL via existing Next.js APIs |
| Missed 24h sync | Full write lock (view existing records allowed; no new/edit POS, invoices, stock, payments) |
| Conflicts | Do not auto-merge. Failed outbox items stay in a Sync issues list |
| First launch | Internet required: sign in, bind this PC to the tenant, download snapshot, reserve document-number prefix |
| Platform v1 | Windows x64 installer |

## Non-goals (v1)

- macOS / Linux installers
- Several PCs working offline against the same tenant
- Offline payroll, tax returns, financial reports, MRA EIS, or platform admin
- Silent last-write-wins on stock or invoice conflicts
- Replacing the cloud app for users who stay online in the browser

## Current baseline

- SaaS is Next.js App Router + Prisma + PostgreSQL.
- `public/sw.js` only caches POS navigation/static assets; it does not persist writes.
- `next.config.mjs` already supports `NEXT_STANDALONE=1`.
- `@madrimov/electron-pos-printer` is already a dependency.
- Android APK download exists at `/download-app`; there is no Windows desktop runtime.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Electron (InsightBooks Desktop)                          │
│  ┌──────────────┐   ┌─────────────┐   ┌───────────────┐  │
│  │ Chromium     │──▶│ Local Next  │──▶│ SQLite        │  │
│  │ (same pages) │   │ standalone  │   │ snapshot +    │  │
│  └──────────────┘   │ API → SQLite│   │ outbox        │  │
│                     └─────────────┘   └───────────────┘  │
│  Sync worker (main process) ──online──▶ live cloud APIs  │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
              Live InsightBooks (Next + Postgres)
              /api/desktop/bind | snapshot | outbox | heartbeat
```

**Units**

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| Electron main | Window, installer, start local Next, run sync worker, 24h clock | OS, SQLite file |
| Desktop data source | Prisma-shaped read/write for operational APIs against SQLite; append outbox on writes | Snapshot schema, outbox |
| Snapshot store | Last known operational data for one tenant | SQLite |
| Outbox | Ordered, durable list of mutations not yet accepted by the server | Snapshot store |
| Cloud desktop APIs | Bind device, issue number prefix, snapshot, apply outbox, heartbeat | Prisma, existing posting services |
| Lock UI | Banner + write gate from `lastSuccessfulSyncAt` | Sync timestamps |

The existing Next UI stays the UI. Desktop does not fork POS/invoice pages.

**How the UI runs offline:** Electron starts the existing Next.js **standalone** server on `127.0.0.1` (already supported via `NEXT_STANDALONE=1`). Chromium loads that local origin. Operational API handlers call a shared `getOperationalStore()`: Prisma on the cloud, SQLite+outbox when `DESKTOP_RUNTIME=1`. A background sync worker in Electron main talks to the **live** cloud (`/api/desktop/*`) when the network is available. Desktop Next never requires local PostgreSQL. Payroll, tax, reports, MRA EIS, and admin routes on the local server return `DESKTOP_ONLINE_ONLY` without querying Postgres.

**Subsequent launches** work fully offline (until the 24-hour lock). Only first bind, unbind, and catching up the outbox need the internet.

## Local data

SQLite file: `%APPDATA%/InsightBooks/desktop.sqlite` (one file per Windows user). **v1 binds exactly one tenant per install.** Switching business requires an online unbind, which deletes the local DB, then a new bind. Reinstalling Windows or deleting the SQLite file requires a new bind (new `deviceId`, new prefix). A tenant may have only **one bound desktop device** at a time; a second bind from another PC is rejected until the first is unbound.

Tables (logical):

- `meta` — `tenantId`, `deviceId`, `numberPrefix`, `lastSuccessfulSyncAt`, `boundAt`
- `snapshot_*` — customers, products/stock, tax types, payment accounts, open invoices, recent payments, POS config
- `outbox` — `id`, `seq`, `createdAt`, `kind`, `payloadJson`, `status` (`pending` \| `syncing` \| `failed`), `errorMessage`, `serverId`
- `sync_issues` — failed items with operator-visible reason

Snapshot is replaced atomically after a successful pull (write to temp, then swap) so a crash cannot leave a half-applied snapshot.

## Document numbers

On bind, the server reserves a device prefix unique per tenant (example `TILL1`). Offline documents use `{prefix}-{type}-{seq}` from a local counter. The server never issues the same prefix to another device while this device is bound. Unbind (settings, online-only) releases the prefix.

## Offline write path

1. Check lock: if `now - lastSuccessfulSyncAt >= 24h`, reject with `DESKTOP_SYNC_REQUIRED`.
2. Apply change to SQLite snapshot (so the UI updates immediately).
3. Append outbox row (`pending`).
4. Return the same JSON shape the live API would return so existing pages keep working.

Allowed outbox kinds (v1):

- `customer.upsert`, `customer.archive`
- `stock.adjust` — quantity changes from the stock adjustment screens, plus deductions already performed by POS/invoice posting
- `invoice.create`, `invoice.update`, `invoice.void`, `invoice.payment` — same validation as the live invoice APIs
- `pos.sale`, `pos.void`, `pos.refund`, `pos.cashDay.open`, `pos.cashDay.close` — the live POS mutation set, including till open/close (sales already require an open till)
- `payment.create` — operational receipts/payments tied to invoices or POS

**Not in the outbox:** goods receipts / purchasing / supplier bills, payroll, tax, journals, reports, MRA EIS, admin, settings. Those routes return `DESKTOP_ONLINE_ONLY`. Stock in v1 means product list + quantities + adjustments, not purchasing.

## Online sync path

Trigger: app start if online; network restored; operator “Sync now”; timer while online (every 15 minutes). A successful sync also satisfies the 24-hour rule.

Order:

1. Heartbeat `POST /api/desktop/heartbeat` with `deviceId` (auth cookie/session).
2. Push outbox `pending` rows in `seq` order via `POST /api/desktop/outbox`.
3. On item success: mark `status=synced`, store `serverId`.
4. On item failure: mark `failed`, copy to `sync_issues`, **stop the push** (later items stay `pending`). There is **no skip**. The operator retries after fixing the cause (e.g. stock on the server), or unbinds (wipes local data). Failed items never apply locally-only as the live truth.
5. If the outbox has no `pending` or `failed` rows: pull snapshot `GET /api/desktop/snapshot`, replace local snapshot, set `lastSuccessfulSyncAt = serverNow`.
6. Do **not** pull a snapshot while any `pending` or `failed` row exists. Heartbeat alone does **not** update `lastSuccessfulSyncAt`.

**24-hour clock:** `lastSuccessfulSyncAt` updates only after a **full** successful sync (outbox drained or empty, then snapshot pull). A heartbeat-only ping does not extend the deadline.

## 24-hour lock

- `hoursSinceSync = (now - lastSuccessfulSyncAt) / 3600`
- Footer always shows last successful sync time (desktop only)
- `< 20h`: no warning banner
- `20h–24h`: warning banner with remaining time and Sync now
- `>= 24h`: write lock for operational modules; banner “Connect to the internet to sync. New sales are paused.”
- Viewing lists, invoices, and stock quantities still works
- Language switcher, logout, and Sync now remain available
- Lock is local (SQLite timestamp). Tampering with the clock: store both local time and last server `serverNow`; if local clock moves backward more than 5 minutes, treat as locked until a successful sync

## Cloud APIs (new)

All require an authenticated tenant user. These routes live on the **cloud** only. Unauthenticated callers get 401. A device that is not bound gets 403 except on `bind`. Browser users never need these routes.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/desktop/bind` | Create `DesktopDevice` (tenantId, deviceId, name, numberPrefix) |
| POST | `/api/desktop/unbind` | Release prefix; desktop wipes local DB after confirm |
| GET | `/api/desktop/snapshot` | Operational snapshot for this tenant + device |
| POST | `/api/desktop/outbox` | Apply one or a batch of outbox items using **existing** POS/invoice/stock/payment services (no second posting engine) |
| POST | `/api/desktop/heartbeat` | Return `serverNow`, device still bound, subscription still active |

Outbox apply must be idempotent: each item has a client `id`; repeating the same id returns the original server result.

If the tenant subscription is expired, heartbeat returns `SUBSCRIPTION_INACTIVE` and the desktop applies the same write lock as a missed 24h sync.

## UI changes (minimal)

- Desktop-only banner component in the tenant shell (hidden on web).
- Sync issues page/modal listing failed outbox items.
- Online-only modules: if `navigator.onLine === false` (or the local API returned `DESKTOP_ONLINE_ONLY`), show the existing permission/empty pattern plus “This area needs internet.”
- Do not duplicate POS/invoice screens.

## Security

- Session: same auth cookies as web, stored in Electron’s isolated session; refresh when online.
- SQLite file is user-profile local; v1 does not encrypt at rest (document as a known risk; do not store extra copies of passwords).
- Device bind is per tenant; a PC cannot download another tenant’s snapshot.
- Desktop APIs are not a backdoor around RBAC: outbox apply uses the same permission checks as the interactive APIs.

## Error handling

| Case | Behaviour |
|------|-----------|
| Offline write while locked | 403 `DESKTOP_SYNC_REQUIRED`; UI banner already visible |
| Outbox item fails (e.g. stock 0 on server) | Item `failed`; sync stops; snapshot not replaced |
| Mid-sync crash | Outbox statuses durable; resume from first `pending`/`syncing` (treat `syncing` as retry with same id) |
| No network on first launch | Cannot bind; show sign-in + “Internet required to set up this PC” |
| Subscription expired | Write lock; message from heartbeat |
| Unbind | Require online; then delete SQLite |

## Testing

- Unit: outbox ordering, lock threshold (20h/24h), clock-rollback lock, idempotent outbox ids.
- Unit: `getOperationalStore()` is used only by POS/invoice/customer/stock/payment routes; other `/api` paths are not written to SQLite.
- Integration (mocked live API): push two sales, pull snapshot, documents appear with server ids.
- Integration: failed middle item blocks later items and does not update `lastSuccessfulSyncAt`.
- Electron smoke (manual): install, bind, airplane mode, POS sale, go online, sale visible in web app.

## Rollout

1. Cloud bind/snapshot/outbox/heartbeat APIs + `DesktopDevice` Prisma model.  
2. SQLite data source + lock + banner (env `DESKTOP_RUNTIME=1` so local Next uses SQLite instead of Prisma).  
3. Electron shell + Windows installer.  
4. Internal till pilot, then download link next to the Android APK page.

## Success criteria

- A bound PC can record POS sales and invoices with the network unplugged.
- After reconnect, those documents exist on the live tenant with the reserved prefix.
- After 24 hours without a full sync, new sales are impossible until sync succeeds.
- Web users who never install desktop are unchanged.
