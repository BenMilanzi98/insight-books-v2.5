# Business Setup Wizard — Workspace

| Field | Value |
|---|---|
| Started | 2026-07-22 |
| Status | **CLOSED for this track** — core shipped; further work is backlog only |
| Spec | `docs/superpowers/specs/2026-07-22-business-setup-wizard-design.md` |
| Plan | `docs/superpowers/plans/2026-07-22-business-setup-wizard.md` |
| Final report | [FINAL_SETUP_WIZARD_REPORT.md](./FINAL_SETUP_WIZARD_REPORT.md) |
| Entry | `/setup` |

## Handoff (2026-07-22)

Track paused so other work can proceed. Resume later from the Final Report §4 gaps if needed.

**Verify:** `npx vitest run test/setupWizard`  
**Migrate:** `npx prisma migrate deploy` (includes `20260722160000_business_setup_run`)
| Current UX | Optional 10-step dashboard modal (`SetupWizardHost`) + `/setup` redirect |
| Opening GL authority | **Accounting V2** `AcctV2OpeningBalanceBatch` (API only; UI still calls dead legacy) |

## Read first

1. [CURRENT_SETUP_IMPLEMENTATION.md](./CURRENT_SETUP_IMPLEMENTATION.md)
2. [SETUP_WIZARD_GAP_REGISTER.md](./SETUP_WIZARD_GAP_REGISTER.md)
3. [OPENING_BALANCE_DATA_INTEGRITY_REPORT.md](./OPENING_BALANCE_DATA_INTEGRITY_REPORT.md)
4. [SETUP_WIZARD_TASKS.md](./SETUP_WIZARD_TASKS.md)

## Related existing docs

- `docs/accounting-posting-engine/OPENING_BALANCE_FRAMEWORK.md`
- `docs/accounting-repair/OPENING_BALANCE_REPAIR.md`
- Stock hybrid import: `docs/stock-management/` (Opening Stock import purpose exists)
