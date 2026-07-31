# Legacy Compatibility Layer

All legacy accounting access from V2 code is isolated in
`lib/accountingV2/infrastructure/legacy/` — enforced by boundary tests (no other V2 file may
import legacy accounting modules). Adapters do not "correct" legacy data; inherited defects
are documented per adapter and remain visible.

| Adapter | Reads | Writes | Inherited defects (documented) | Removed in | Controlling flag |
|---|---|---|---|---|---|
| `legacyPostingAdapter` | `Transaction`/`JournalEntry` by source | Delegates to `postGlEntry` ONLY on explicit opt-in in LEGACY mode (no production route wired) | SEC-1 missing tenant filter (compensated by `assertAccountsBelongToBusiness` pre-check); TOCTOU duplicate check (compensated by registry constraint) | Phase 4/9 | posting mode |
| `legacyLedgerQueryAdapter` | `buildOfficialLedgerTotals` + posted `TransactionLine` drill-down | none | JRN-009 header journals distort balances; stored-balance drift invisible | Phase 5 | `accountingV2NewLedgerQuery` |
| `legacyTrialBalanceAdapter` | `buildTrialBalance` | none | TB-003 header accounts not skipped | Phase 7 | `accountingV2NewTrialBalance` |
| `legacyPeriodResolver` | `AccountingPeriod` rows | none | date-inferred periods, overlaps/gaps; **policy inversion**: V2 denies where legacy fails open, both outcomes reported (`postingAllowed` vs `legacyWouldAllow`) | Phase 8 | `strictPeriodControl` |
| `legacyAccountMappingAdapter` | `Account` by legacy hardcoded codes | none — never auto-creates | duplicated/repurposed codes in pre-blueprint tenants; missing mapping → `MissingAccountMappingError`, no fallback | Phase 3 | n/a (contract behaviour) |
| `legacyReversalAdapter` | reversal state of `Transaction` rows | none | originals keep status `posted` after reversal; engine-bypass reversal branches | Phase 5/9 | n/a (read-only) |

Testing requirements: adapter behaviour is covered by the posting/period suites
(deny-by-default resolution, tenancy assertion, legacy comparison reads) plus boundary tests
proving no other entry points exist. Adapter outputs against known legacy behaviour on real
data are exercised through the shadow comparison path.

Passing through an adapter does NOT certify legacy data as correct — comparison results carry
severities and the Phase 1 findings remain authoritative until Phase 6 repairs data.
