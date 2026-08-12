# Design: POS Till Open/Close with Till Float GL funding

**Date:** 2026-08-11  
**Status:** Approved (Approach 1)  
**Related:** `lib/posCashDayService.js`, `components/pos/PosTillGateModals.jsx`, `/api/pos/cash-day/*`

## Goal

Make POS till opening appear once per business day, treat opening balance as optional, fund any entered float with real GL transfers into a dedicated **Till / Cash Float** account (Cash first, Capital if Cash is empty / short), remind once after 5pm to close, auto-close at midnight, allow manual reopen after close, and on close sweep **Till → Cash** — all simple and well traced.

## Locked decisions

| Topic | Choice |
|-------|--------|
| Approach | Extend `PosCashDay` + V2 transfer posting |
| Funding | Real GL (not operational-only) |
| Float account | Dedicated Till / Cash Float asset (create/map if missing) |
| Open sources | Cash → Till; if Cash empty → Capital → Till; if Cash partial → Cash first then Capital remainder |
| Opening amount | Optional (blank/0 = open, no funding journal) |
| Close | One sweep Till → Cash (float + day’s cash in Till) |
| Close reminder | Once after 17:00 Africa/Blantyre while open |
| Midnight | Auto-close OPEN days when business date rolls (lazy on access + any existing job) |
| Reopen | Allowed same day after CLOSED (same unique day row → OPEN again + optional new fund) |

## Current baseline

- Hard gate: sales require `PosCashDay.status = OPEN`.
- Open stores `openingBalance`; defaults/suggests system Cash ledger balance; no dedicated Till Float transfer on open.
- Close reminder: once per client session after hour ≥ 17 (Blantyre).
- Stale OPEN days with `businessDate < today` are auto-closed on access (`closeStalePosCashDays`).
- Same-day reopen is **blocked** (`ALREADY_CLOSED` + UI copy).
- Unique key: `@@unique([tenantId, branchKey, businessDate])` — one row per day.

## Accounts & mapping

1. **Till Float (destination on open / source on close)**  
   - Ensure CoA posting account + PaymentAccount (or CoA link) for POS till float.  
   - Prefer new system purpose `POS_TILL_FLOAT` (asset, debit normal). If product already maps a till float account, use mapping.  
   - Do **not** silently reuse Petty Cash unless already the tenant’s mapped till float.

2. **Cash (primary funding source / sweep destination)**  
   - Existing system Cash payment account (`getSystemCashPaymentAccount`).

3. **Capital (fallback funding source)**  
   - Resolve via CoA purpose for owner capital / equity contribution used for float (e.g. mapped `CAPITAL` / owner equity posting account).  
   - If Capital mapping missing when needed → **400/409** with clear setup message (no silent skip).

## Open flow (first open of the day)

1. Resolve business date = today in `Africa/Blantyre`.
2. `closeStalePosCashDays` for dates `< today`.
3. If row exists and `OPEN` → idempotent success / `ALREADY_OPEN`.
4. If no row → create `PosCashDay` with status `OPEN`, `openingBalance` = entered amount or `0`.
5. If amount `> 0`:
   - Read Cash available balance.
   - `cashPart = min(amount, max(cashBalance, 0))`.
   - `capitalPart = amount - cashPart`.
   - If `capitalPart > 0` and Capital unmapped → fail closed with setup error.
   - Post idempotent funding journal(s) via V2 transfer adapter:
     - Dr Till Float / Cr Cash for `cashPart` (if > 0)
     - Dr Till Float / Cr Capital for `capitalPart` (if > 0)  
     Prefer **one balanced multi-line journal** when both parts exist (simpler trail).
   - Persist journal id + `fundingCashAmount` / `fundingCapitalAmount` on the day.
6. If amount is `0`/empty → no journal; till opens for selling.
7. UI: opening field optional; show suggested Cash balance and note Capital fallback when Cash is 0/short.

## Close flow (manual or auto)

1. Load OPEN day; sum Till Float CoA balance for tenant (or tracked till balance for the day — prefer live Till CoA balance for sweep amount).
2. If Till balance `> 0`, post idempotent sweep: Dr Cash · Cr Till Float (`sourceType=PosCashDayClose`, `sourceId=dayId+closeSeq`).
3. Mark `CLOSED`, set `closedAt`, `closedById` (null if auto), `autoClosed` as appropriate; store `closeSweepJournalId`.
4. Keep existing sales/deposit snapshots behaviour.
5. Manual close remains available from POS UI; auto path = stale-day closer when Blantyre date advances (midnight rollover).

## Reopen (same business date)

Because of the unique `(tenantId, branchKey, businessDate)` constraint:

1. Allow transition `CLOSED` → `OPEN` on the **same** row (do not create a second day row).
2. Clear close markers needed for an open session (`closedAt`, `closedById`, `autoClosed=false`); increment `openCount` / set `reopenedAt`.
3. Optional opening amount again → new funding transfer with new open sequence for idempotency.
4. Remove UI/API `ALREADY_CLOSED` hard block for same-day reopen.
5. Sales allowed again only when status is `OPEN`.

## Reminders

- After 17:00 Blantyre, while till is OPEN: show close modal **once** per browser session (existing `tillClosePromptShownRef` behaviour).
- Dismiss / “Keep open” does not re-show that session.
- Opening modal: only when `requiresTillOpen` (not open); do not spam after successful open.

## Schema additions (minimal)

On `PosCashDay` (nullable where historical rows exist):

- `tillFloatAccountId` (PaymentAccount or CoA id — match existing pattern; prefer PaymentAccount id parallel to `systemCashAccountId`)
- `openFundingJournalId` String?
- `closeSweepJournalId` String?
- `fundingCashAmount` Float?  
- `fundingCapitalAmount` Float?
- `openCount` Int @default(1)
- `reopenedAt` DateTime?

Migration required; backfill not required for old closed days.

## Idempotency & audit

| Event | sourceType (example) | sourceId |
|-------|----------------------|----------|
| Open fund | `PosCashDayOpen` | `{dayId}:open:{openCount}` |
| Close sweep | `PosCashDayClose` | `{dayId}:close:{openCount}` |

Retry must not double-fund or double-sweep. Store journal ids on the day for drill-down.

## UI changes (`PosTillGateModals` + POS page)

- Opening balance optional; allow Open with empty/0.
- Show funding preview: from Cash / from Capital.
- When `tillClosed` same day: show **Reopen till** (not “come back tomorrow”).
- Close copy: sweep returns Till Float to Cash; midnight auto-close still mentioned.
- Keep sales blocked messaging until open.

## Error handling

| Case | Behaviour |
|------|-----------|
| Already OPEN | 409 `ALREADY_OPEN` |
| Closed → reopen | Allowed (update row) |
| Capital needed, unmapped | 409/400 with CoA setup guidance |
| Invalid amount (&lt; 0) | 400 |
| Period closed for journal date | Fail with period message (same as other V2 posts) |
| Missing Cash account | 400 setup error |

## Out of scope

- Posting every POS cash sale into Till Float (Approach 2).
- Multi-branch separate till registers (`branchKey` remains `none` for this slice).
- Changing deposit-to-bank UX beyond ensuring close sweep is coherent with existing deposits.

## Success criteria

- Open modal once per day until till is open; optional float; GL shows Cash/Capital → Till when amount &gt; 0.
- Close reminder once after 5pm; undeclared open days closed after midnight rollover.
- Close posts one Till → Cash sweep; reopen same day works with optional new funding.
- Journals idempotent and linked on `PosCashDay`.

## Self-review

- No placeholders.
- Reopen uses in-place status update (respects unique constraint) — consistent with Approach 1 intent.
- Partial Cash + Capital remainder documented.
- Midnight relies on Blantyre date rollover + existing stale closer (explicit).
