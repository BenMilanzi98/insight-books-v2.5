# Current Architecture — System Audit

| Status | **STUB — see phase docs for depth** |

## Runtime stack

- **Frontend:** Next.js App Router (`app/**/page.js`)
- **API:** Next.js route handlers (`app/api/**/route.js`)
- **Data:** PostgreSQL + Prisma ORM
- **Auth:** Session-based tenant context (see `lib/accessControl.js`, `lib/adminAuth.js`)

## Accounting architecture (dual state)

- **Legacy:** `JournalEntry`, `Transaction`, `lib/accountingEngine`
- **V2 target:** `AcctV2*`, `lib/accountingV2` posting coordinator, feature flags
- **Advisory (no GL):** `financialPlanning`, `loanReadiness`

## Deep dive documents

| Topic | Path |
|---|---|
| Phase 1 verified architecture | `docs/accounting-audit/CURRENT_ARCHITECTURE.md` |
| V2 architecture decisions | `docs/accounting-architecture/` |
| Data flow (cutover) | `docs/production-cutover/PRODUCTION_DATA_FLOW_MAP.md` |

## TO FILL

- Deployment topology (nodes, LB, DB replica)
- Environment-specific feature flag defaults
