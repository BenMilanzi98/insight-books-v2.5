# Phase 8 Implementation Plan — Financial Calendar and Period Control

Workstreams A–AW from the master prompt. Status values: DONE / DEFERRED.
Key file references are relative to the repository root.

| WS | Task | Status | Key files | Evidence / tests |
| --- | --- | --- | --- | --- |
| A | Phase 1–7 evidence review | DONE | docs/accounting-periods/PHASE_1_TO_7_EVIDENCE_INDEX.md | index |
| B | Current implementation analysis | DONE | docs/accounting-periods/CURRENT_FINANCIAL_CALENDAR_ARCHITECTURE.md | doc |
| C | Financial-year domain model | DONE | prisma/schema.prisma (`AcctV2FinancialYear`), lib/accountingV2/periods/financialYearService.js | FY tests |
| D | Accounting-period domain model | DONE | prisma/schema.prisma (`AcctV2AccountingPeriod`) | generation tests |
| E | Financial Calendar configuration | DONE | `AcctV2FinancialCalendarConfig`, lib/accountingV2/periods/calendarConfigService.js | config tests |
| F | Financial-year creation | DONE | financialYearService.js (`previewFinancialYear`, `createFinancialYear`, `openFinancialYear`) | atomic-creation tests |
| G | Automatic period generation | DONE | lib/accountingV2/periods/periodGeneration.js | leap-year/mid-year tests |
| H | Overlap and gap validation | DONE | lib/accountingV2/periods/calendarIntegrityService.js (PER-101..PER-110) | integrity tests |
| I | Date-policy framework | DONE | lib/accountingV2/periods/datePolicy.js + DATE_POLICY_FRAMEWORK.md | policy tests |
| J | Period Resolution Service | DONE | lib/accountingV2/periods/periodResolutionService.js | resolution tests |
| K | Posting Engine integration | DONE | lib/accountingV2/engine/periodResolution.js (flag-gated V2 delegation) | posting integration tests |
| L | Operational date validation | DONE (guard APIs; module wiring = Phase 9) | periodResolutionService.js `validatePostingDate`; app/api/accounting-v2/periods/resolve | resolver tests |
| M | Open-period controls | DONE | periodResolutionService.js | tests |
| N | Backdating controls | DONE | datePolicy.js + periodResolutionService.js (reason/permission/audit) | backdating tests |
| O | Future-dating controls | DONE | datePolicy.js (tolerance policy) | future-dating tests |
| P | Period status transitions | DONE | lib/accountingV2/periods/periodLifecycleService.js (+`AcctV2PeriodStatusHistory`) | transition tests |
| Q | Close checklist framework | DONE | lib/accountingV2/periods/periodCloseChecklist.js (versioned template) | checklist tests |
| R–AA | TB/GL/bank/AR/AP/inventory/payroll/asset/loan/tax/equity/report close checks | DONE | periodCloseChecklist.js automated checks calling Phase 5/6/7 services | close-check tests |
| AB | Period exceptions | DONE | `AcctV2PeriodCloseException` + periodCloseService.js | exception tests |
| AC | Period close | DONE | lib/accountingV2/periods/periodCloseService.js (atomic close) | closure tests |
| AD | Period reopen | DONE | lib/accountingV2/periods/periodReopenService.js | reopening tests |
| AE | Period re-close | DONE | periodCloseService.js (new close run version) | re-close tests |
| AF | Adjustment-period controls | DONE (policy + flags; no 13th period by default) | CLOSED_PERIOD_ADJUSTMENTS.md | doc + resolver adjustment tests |
| AG | Report snapshots | DONE | periodCloseService.js → Phase 7 `snapshotReport` | snapshot tests |
| AH | Calendar UI | DONE | app/financial-calendar-v2/page.js | manual + build |
| AI | Period UI | DONE | app/financial-calendar-v2/page.js (period detail + close dashboard) | manual + build |
| AJ | APIs | DONE | app/api/accounting-v2/periods/** | route guard tests |
| AK | Permissions | DONE | lib/accountingV2/permissions.js (accountingPeriods.*) | security tests |
| AL | Notifications | DONE (outbox events; delivery channels existing) | periodCloseService.js / periodReopenService.js outbox writes | outbox assertions |
| AM | Audit trail | DONE | status history + auditLog writes in services | audit tests |
| AN | Background jobs | DONE | lib/accountingV2/periods/periodMonitoringService.js + integrity API | monitoring tests |
| AO | Integrity monitoring | DONE | calendarIntegrityService.js + monitoring service | integrity tests |
| AP | Migration | DONE | lib/accountingV2/periods/legacyPeriodMigrationService.js + LEGACY_PERIOD_MIGRATION_STRATEGY.md | migration tests |
| AQ | Automated tests | DONE | test/accountingV2.periods.test.js | vitest run |
| AR | Performance validation | DONE (design + doc; production benchmark = rollout Stage 2) | PERFORMANCE_VALIDATION.md | doc |
| AS | Controlled rollout | DONE | CONTROLLED_ROLLOUT.md + PERIOD_FLAGS | doc |
| AT | Phase 9 readiness | DONE | PHASE_9_READINESS.md | doc |
| AU | Phase 12 readiness | DONE | PHASE_12_READINESS.md | doc |
| AV | Phase 13 readiness | DONE | PHASE_13_READINESS.md | doc |
| AW | Final report | DONE | FINAL_PHASE_8_REPORT.md | doc |

Deferred (recorded, out of Phase 8 scope): operational-module wiring to the
guard APIs (Phase 9), year-end closing entries (Phase 12), bank-reconciliation
close evidence integration (Bank Reconciliation module), notification
delivery-channel expansion, 4-4-5 calendar strategies (no business
requirement).
