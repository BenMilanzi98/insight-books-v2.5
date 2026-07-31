# Setup Wizard Gap Register

**Date:** 2026-07-22  
**Source:** Forensic review vs master prompt (23-step controlled onboarding).  
**Severity:** CRITICAL / HIGH / MEDIUM / LOW  
**Status values:** OPEN | PARTIAL | WONT_FIX_YET

---

## Summary counts

| Severity | Count (OPEN/PARTIAL) |
|---|---|
| CRITICAL | 14 |
| HIGH | 18 |
| MEDIUM | 16 |
| LOW | 8 |
| **Total** | **56** |

---

## CRITICAL

| ID | Gap | Evidence | Impact |
|---|---|---|---|
| SW-C01 | No `BusinessSetupRun` aggregate / versioned steps | No Prisma model for setup run | Cannot resume, approve, post, reopen safely |
| SW-C02 | Wizard not connected to V2 Opening Balance Batch | Wizard → financial-setup / legacy; V2 API separate | Opening balances not posted through controlled path |
| SW-C03 | Legacy `postOpeningBalance` still invoked from setup-adjacent paths | Service throws; API 410 | Silent failure / incomplete GL |
| SW-C04 | No Opening Trial Balance preview gate | No setup TB preview before complete | Unbalanced setup can be “finished” |
| SW-C05 | No Assets = Liabilities + Equity gate | Not in wizard review | Completing unbalanced position |
| SW-C06 | Opening Receivables not orchestrated (subledger + AR control) | No setup AR step posting | AR control mismatch / revenue risk |
| SW-C07 | Opening Payables not orchestrated | No setup AP step posting | AP control mismatch / expense risk |
| SW-C08 | Opening Stock GL not via Posting Engine as setup event | Stock qty import without clearing journal | Inventory ≠ GL |
| SW-C09 | No subledger reconciliation centre before post | Missing | Control mismatches invisible |
| SW-C10 | No final post through engine from wizard | No setup post action | Duplicate / missing journals |
| SW-C11 | No idempotent setup final posting identity | No `BUSINESS_SETUP:…` key | Double-post risk on retry |
| SW-C12 | No protection for EXISTING_WITH_FINANCIAL_ACTIVITY | Soft wizard only | Duplicate openings on live books |
| SW-C13 | Direct / legacy balance mutation risk remains in adjacent paths | Dead OB + mixed modules | Non-canonical truth |
| SW-C14 | Setup “complete” without GL/TB/subledger proof | JSON wizard state | False readiness |

---

## HIGH

| ID | Gap | Notes |
|---|---|---|
| SW-H01 | No legal structure → equity options | Sole vs partnership vs company not wizard-driven |
| SW-H02 | No ownership / share / partner ratio step | Equity module exists separately |
| SW-H03 | FY + periods + OB date + cutover not first-class wizard step | Calendar V2 exists outside |
| SW-H04 | CoA setup not in wizard | CoA V2 exists |
| SW-H05 | System account mappings not wizard-validated | Mapping APIs exist |
| SW-H06 | Payment account OB not in V2 batch from wizard | Payment mgmt exists |
| SW-H07 | Customer import with preview/idempotency incomplete for setup | Clients module exists |
| SW-H08 | Supplier import incomplete for setup | Suppliers exist |
| SW-H09 | Fixed asset cost + accum dep opening journals not wizard-batched | Asset module exists |
| SW-H10 | Loan / liability opening not wizard-batched | Liability module exists |
| SW-H11 | Tax statutory OB step missing | Tax management exists |
| SW-H12 | Capital / RE / CYE duplicate prevention not setup-enforced | Equity V2 partial |
| SW-H13 | Manual TB control-account lock + override missing | — |
| SW-H14 | Approval / SoD for setup missing | Governance APIs exist |
| SW-H15 | Controlled reopen / reverse missing | — |
| SW-H16 | Supporting documents vault for setup missing | — |
| SW-H17 | Granular `setup.*` permissions missing | — |
| SW-H18 | Full-page resumable `/setup` experience missing | Modal + redirect only |

---

## MEDIUM

| ID | Gap |
|---|---|
| SW-M01 | Autosave + optimistic concurrency for multi-user edit |
| SW-M02 | Setup import templates pack (AR/AP/assets/loans/equity/TB) |
| SW-M03 | Setup Completion Pack (immutable PDF/Excel) |
| SW-M04 | Setup notifications lifecycle |
| SW-M05 | Typed setup errors catalogue (master list) |
| SW-M06 | Setup audit event catalogue completeness |
| SW-M07 | Multi-currency opening rate preservation end-to-end |
| SW-M08 | Opening Balance Equity resolution UI |
| SW-M09 | Domain journal batch (payment/AR/AP/stock/…) architecture |
| SW-M10 | Setup exports / reports pack |
| SW-M11 | Mobile / tablet responsive audit of full wizard |
| SW-M12 | Accessibility (stepper, dialogs, live regions) |
| SW-M13 | Background large import + pack generation |
| SW-M14 | Observability metrics for setup |
| SW-M15 | Historical data migration / reconstruct Setup Runs |
| SW-M16 | E2E workflows 1–6 automated |

---

## LOW

| ID | Gap |
|---|---|
| SW-L01 | Plain-language tooltips for Opening Balance Equity etc. |
| SW-L02 | Setup help / guided tips per step (partial tips exist) |
| SW-L03 | Skip optional step UX polish |
| SW-L04 | Progress % accuracy vs financial blockers |
| SW-L05 | Example Excel templates download hub |
| SW-L06 | Setup certificate / summary branding |
| SW-L07 | Conflict UI when two editors save same step |
| SW-L08 | Full docs tree (66 files) — only forensic subset written |

---

## Mapping: master steps → gap IDs

| Master step | Gap IDs |
|---|---|
| 1 Profile | SW-H18, profile fields scatter |
| 2 Ownership | SW-H01, SW-H02 |
| 3 Calendar / dates | SW-H03, SW-C12 |
| 4–5 CoA / mappings | SW-H04, SW-H05 |
| 6 Payment accounts | SW-H06, SW-C02 |
| 7–8 Customers / AR | SW-H07, SW-C06 |
| 9–10 Suppliers / AP | SW-H08, SW-C07 |
| 11–12 Items / stock | SW-C08, stock Slice 1 partial |
| 13–16 Assets / other / loans / tax | SW-H09–H11 |
| 17–18 Equity / manual TB | SW-H12, SW-H13 |
| 19–20 TB + reconcile | SW-C04, SW-C05, SW-C09 |
| 21 Documents | SW-H16 |
| 22–23 Approve + post | SW-H14, SW-C10, SW-C11, SW-C14 |

---

## Explicit non-gaps (reuse)

- Accounting V2 Posting Engine.
- `AcctV2OpeningBalanceBatch` approve/post pattern.
- Optional 10-step wizard shell + soft.
- Soft onboarding not forcing login into wizard.
- Domain modules (stock, assets, liabilities, equity, CoA, calendar).
