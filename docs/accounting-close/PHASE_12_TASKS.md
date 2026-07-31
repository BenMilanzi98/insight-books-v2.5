# Phase 12 Tasks

| ID | Workstream | Status | Close type | Dependencies | Notes |
|---|---|---|---|---|---|
| A | Evidence review | Done | Both | Phases 1–11 docs | Evidence index |
| B | Current architecture | Done | Both | Repo search | CURRENT_CLOSING_ARCHITECTURE |
| C | Target architecture | Done | Both | B | TARGET_CLOSING_ARCHITECTURE |
| D | Close configuration | Done | YE | CoA mappings | CloseV2Configuration |
| E | Month-end framework | Reuse P8 | PERIOD_END | Period close | No monthly temp close |
| F | Year-end framework | Done | YEAR_END | D | YearEndCloseRun |
| G | Close readiness | Done | YE | Bank/Equity/GL | Readiness engine |
| H–J | Checklists / tasks | Done | YE | G | STANDARD_YEAR_END_CLOSE |
| K–L | Exceptions / approvals | Done | YE | H | Entity + waive path |
| M–U | Module close checks | Done | YE | P9–P11 feeds | AR/AP/equity live; inv/payroll/assets/loans/tax heuristics |
| V–W | Suspense / inter-branch | Partial | YE | CoA | Manual checklist tasks |
| X–Z | Adjustments / ATB / FS | Done | YE | PE + reports | Adjustments via PE; ATB=TB |
| AA–AQ | Closing method / journals | Done | YE | PE | Batch + post |
| AR–AW | PCTB / carry-forward / FY close | Done | YE | Continuous GL | |
| AX–BB | Closed-year / reopen / reclose | Done | YE | F | |
| BC–BH | API / UI / perms / audit | Done | Both | | |
| BI–BN | Migration / tests / rollout / P13–14 | Done | | | Docs + domain tests |
| BO | Final report | Done | | | FINAL_PHASE_12_REPORT |

Default close method: `INCOME_SUMMARY_TO_RETAINED_EARNINGS` when Income Summary + RE mapped; else `DIRECT_TO_RETAINED_EARNINGS`.
