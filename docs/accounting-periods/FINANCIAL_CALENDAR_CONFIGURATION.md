# Financial Calendar Configuration

Model: `AcctV2FinancialCalendarConfig` (one row per business).
Service: `lib/accountingV2/periods/calendarConfigService.js`.
API: `GET/PUT /api/accounting-v2/periods/config`.

## Settings (with safe defaults from `CALENDAR_CONFIG_DEFAULTS`)

| Setting | Default | Notes |
| --- | --- | --- |
| `fyStartMonth` / `fyStartDay` | 1 / 1 (January) | July–June, April–March etc. fully supported; leap-day anchors handled by `computeFinancialYearRange` |
| `timezone` | `Africa/Blantyre` | posting dates are date-only values interpreted in the business timezone; server UTC "now" converted before comparisons |
| `periodFrequency` | `MONTHLY` | 4-4-5 deliberately not implemented (no approved requirement) |
| `backdatingPolicy` | `PERMISSION_AND_REASON` | see BACKDATING_CONTROLS.md |
| `futureDatingPolicy` | `TOLERANCE_WITH_WARNING` | see FUTURE_DATING_CONTROLS.md |
| `futureToleranceDays` | 7 | |
| `defaultLockDayOfMonth` | null | optional rolling lock rules |
| `checklistTemplateId` / `Version` | `STANDARD_MONTHLY_CLOSE` / 1 | versioned, immutable templates |
| `requireCloseApproval` | true | second-person approval on close |
| `requireReopenApproval` | true | second-person approval on reopen |
| `recloseDeadlineDays` | 14 | re-close deadline after reopening |
| `snapshotOnClose` | true | Phase 7 snapshot generation at closure |

## Behaviour

- `getCalendarConfig` merges persisted values over defaults, so a business
  without a config row still gets a fully valid calendar policy.
- `updateCalendarConfig` validates month/day/policy values, **requires a
  reason** when lock-related settings change, and records previous/new values
  through `recordAccountingAudit`.
- Config never changes existing periods; it affects future year generation
  and posting-date policy evaluation only.
