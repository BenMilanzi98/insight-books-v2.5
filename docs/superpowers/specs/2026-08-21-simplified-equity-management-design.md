# Simplified Equity Management — Design Spec

**Date:** 2026-08-21  
**Status:** Approved  
**Approach:** Simplify in place (keep EqV2 + Posting Engine; remove approval ceremony)

---

## 1. Goals

1. Equity Management is **simple and straightforward** — no multi-step approve/preview ritual.
2. **No approval / SoD** on the happy path — create posts the journal immediately.
3. Support: **Owners**, **Capital contribution**, **Owner/partner drawing**, **Declare dividend**, **Pay dividend**.
4. **Bank/cash account** chosen each time from tenant payment accounts (dropdown).
5. Clear errors when equity CoA mappings are missing (do not fail with opaque 422 approve/preview).

Non-goals: share issuance/transfer UI, owner loans UI, recon redesign, rewriting Posting Engine.

---

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Scope | Owners + contribution + drawing + dividends |
| Bank account | Pick each time (payment accounts dropdown) |
| Dividends | Two actions: Declare, then Pay |
| Architecture | Simplify existing EqV2 module |
| Approval | Not required; direct post |

---

## 3. UX

Single page `/equity-management` with three sections:

### 3.1 Owners
- List active owners/partners/shareholders
- Form: name + relationship type → **Create** (status ACTIVE immediately)

### 3.2 Record transaction
- Type: Contribution | Drawing | Declare dividend | Pay dividend
- Fields: owner (required except maybe declare if multi-owner allocation — for simple path: pick owner or “all owners by ownership %” for declare; **simple: declare total amount + allocate equally or to selected owners**)
- Amount, date
- Bank/payment account when type is Contribution, Drawing, or Pay dividend
- Single primary button: **Post**

### 3.3 History
- Posted (and failed) transactions: number, type, owner, amount, date, status, journal ref if any
- No approve / submit / preview buttons

Remove / hide: multi-step “Create → approve → preview → post”, SoD messaging, heavy config unless needed for legal structure once.

---

## 4. API / service behaviour

### 4.1 Direct post

`POST /api/equity-management/transactions` accepts body including `bankAccountId` (when needed) and posts in the same request:

1. `createEquityTransaction` with `approvalStatus: NOT_REQUIRED`, `status: APPROVED`
2. Immediately `postEquityTransaction` (skip submit/approve/preview)

Optional query/body `post: false` for rare draft-only (not exposed in UI).

### 4.2 Config defaults

On read/upsert of equity config, force for runtime happy path:

- `requireContributionApproval = false`
- `requireDrawingApproval = false`
- `requireDividendApproval = false`
- `requireSeparateApprover = false`

(Existing rows updated when config is loaded/saved, or ignored by create path.)

### 4.3 Dividends

- **Declare:** creates declaration + equity tx + posts Dr RE / Cr Dividends payable  
- **Pay:** selects open declaration (or declaration id), bank account, posts Dr Dividends payable / Cr bank  

No approve steps in `dividendService`.

### 4.4 Errors

Map missing bank / missing CoA purpose to **400** with message like:  
`Map “Owner capital” (or Retained earnings / Dividends payable / Drawings) under Chart of Accounts before posting.`

---

## 5. Accounting (unchanged substance)

| Action | Debit | Credit |
|--------|-------|--------|
| Contribution | Bank/cash | Owner capital |
| Drawing | Owner drawings | Bank/cash |
| Declare dividend | Retained earnings | Dividends payable |
| Pay dividend | Dividends payable | Bank/cash |

---

## 6. Acceptance

1. User can add an owner and post a contribution in **one Post click** with bank selected.  
2. Drawing and dividend declare/pay work the same way (no approve).  
3. Approve/preview are not required by the UI.  
4. Posted journal appears on the transaction and in GL.  
5. Missing CoA mapping shows a clear message, not a silent SoD failure.

---

## 7. Files to touch

- `app/equity-management/page.js` — rewrite UI  
- `lib/equityManagement/application/transactionService.js` — direct post helper; disable approval requirement  
- `lib/equityManagement/application/dividendService.js` — auto-post declare/pay  
- `lib/equityManagement/application/configService.js` — default approvals off  
- `app/api/equity-management/transactions/route.js` — create+post  
- `app/api/equity-management/dividends/route.js` — simplify actions  
- Tests: update workflow tests for direct post
