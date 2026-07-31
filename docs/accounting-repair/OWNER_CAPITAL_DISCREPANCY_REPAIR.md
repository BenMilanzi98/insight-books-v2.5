# Owner Capital Discrepancy Repair (MK1,000,000 vs MK2,000,000)

## Question

Owner capital was contributed as MK1,000,000 but surfaces as MK2,000,000. Which
of the ~17 candidate duplication mechanisms is actually responsible?

## Forensic method

`scripts/accounting-repair-capital-trace.mjs` traces every equity and liability
account per business from the UI-visible number down to source records, layer by
layer: stored `Account.balance` / `openingBalance` fields → legacy journal-line
totals → V2 journal-line totals → canonical GL totals (Phase 5 authority rules)
→ header-only journals (`totalAmount` set, zero lines) → parent/child rollups →
reversal handling → cross-ledger (legacy+V2) double counting.

## Findings (dev dataset, QA-Accounting tenant)

The duplication mechanism reproduced in this dataset is **stored-balance +
journal double counting with header-only journal ancestry**:

- Equity account `3102` carries a stored balance with **zero supporting
  canonical journal lines** (`STORED_BALANCE_DIFFERENCE`, CONFIRMED, measured).
- Two legacy **header-only capital journals** exist (`totalAmount` populated,
  no lines — `UNSUPPORTED_HISTORICAL_RECORD`), the origin of the stored figure.
- Any report summing stored balances alongside journal-derived balances counts
  the capital twice: journal-derived MK X + stored MK X = 2X. This is exactly
  the MK1M→MK2M shape.
- Liabilities in the same dataset reconcile (no unsupported liability found),
  isolating the defect to the equity/stored-balance path.

## Resolution by mechanism

| Mechanism | Repair | Journal? |
|---|---|---|
| Stored balance double-counted with journals | Canonical ledger (Phase 5) excludes stored fields — authority rule already deployed; `REPORT_ONLY_REPAIR` for any remaining report reading `Account.balance`; stored value kept as legacy metadata | No |
| Header-only journals (no lines) | If migration evidence proves the contribution → approved `MISSING_JOURNAL_REPAIR` creating the lined journal ONCE; else exception | Only with evidence |
| Duplicate capital journal (creation + approval, import rerun) | `DUPLICATE_EFFECT_REPAIR` reversal of the duplicate | Yes |
| Opening capital + contribution journal | `DUPLICATE_EFFECT_REPAIR` per `OPENING_BALANCE_REPAIR.md` | Yes |
| Parent/child or alias double count | Hierarchy/mapping fix (`REPORT_ONLY_REPAIR`) — Phase 5 GL posts to leaf accounts and rolls up once | No |
| Legacy+V2 both counted | Phase 5 authority rules; reverse a non-authoritative ACTIVE duplicate if one has real effect | Only if a true duplicate is active |
| Projection stale | `PROJECTION_REBUILD` | No |

**No arbitrary adjustment is ever posted to force MK1,000,000.** The repair
corrects only the proven mechanism; the balance lands on MK1M because the
double-count is removed, not because it was targeted.

## Verification (per acceptance criteria)

After repair: General Ledger, Capital Account view, Balance Sheet equity,
Statement of Changes in Equity and the owner statement must all agree on the
evidenced amount, and no query path may count the event twice. Test fixtures
prove the MK1M outcome for the duplicate-journal and stored-balance mechanisms
(capital test group in `accountingV2.repair.test.js`).
