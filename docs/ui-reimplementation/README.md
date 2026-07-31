# InsightBooks V2 — UI Reimplementation

**Date:** 2026-07-25  
**Constraint:** Presentation-only — no business logic, API, permission, route, or calculation changes.  
**Theme:** Light mode only (no dark-mode switcher).  
**Brand:** Preserve indigo `#6366f1` + slate sidebar chrome.

## Programme waves

| Wave | Status | Deliverable |
|------|--------|-------------|
| 0 Audit | Complete | Forensic audit pack + gap register |
| 1 Tokens | Complete | Semantic CSS tokens + typography |
| 2 AppShell | Complete | Shell / sidebar / header / page chrome |
| 3 Primitives | Complete | `components/ui/*` |
| 4 Patterns | Complete | List / Detail / Create-Edit / Report |
| 5 Tenant modules | Complete (first wave) | See MODULE_MIGRATION_STATUS.md |
| 6 Platform + affiliate | Complete | AdminShell + affiliate token polish |
| 7 QA | Complete | Tests + readiness docs |

## Key entry points

- Tokens: `app/globals.css`
- Tenant shell: `components/shell/AppShell.jsx`
- Admin shell: `components/shell/AdminShell.jsx`
- Primitives: `components/ui/`
- Patterns: `components/patterns/`
- Readiness: [FINAL_READINESS_DECISION.md](./FINAL_READINESS_DECISION.md)

## Snapshot (audit baseline)

- **188** UI pages under `app/`
- Feature modals keep business content; chrome migrates to shared `Dialog`
- Shell hide rules unchanged for auth / admin / affiliate / marketing

See [FINAL_GAP_REGISTER.md](./FINAL_GAP_REGISTER.md) and [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).
