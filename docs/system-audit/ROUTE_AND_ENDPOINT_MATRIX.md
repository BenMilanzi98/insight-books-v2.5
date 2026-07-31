# Route and Endpoint Matrix

| Field | Value |
|---|---|
| Full matrix | `artifacts/system-audit/inventory-counts.json` → `apis[]` (**681 routes**) |
| UI routes | Same artifact → `pages[]` (**157 pages**) |
| Validation | Static discovery — **not** live HTTP contract testing |

---

## Methodology

1. **Discovery** — `node scripts/generate-system-audit-inventory.cjs` walks `app/api/**/route.js` and `app/**/page.js`.
2. **Classification** — routes grouped by first path segment(s) and mapped to lib packages where applicable.
3. **HTTP verbs** — inferred from exported `GET`/`POST`/`PUT`/`PATCH`/`DELETE` functions per file; not exhaustively verified in this pass.
4. **Auth** — assumed tenant-scoped session/API key unless route under `/api/admin` or documented public; per-route auth audit **PENDING** (`API_SECURITY_AUDIT.md`).
5. **Full matrix** — the JSON artifact is the authoritative exhaustive list; this document samples major V2 namespaces only.

---

## Major V2 API namespaces (sample)

### Accounting V2 (`/api/accounting-v2`) — 33 routes

| Route | Typical verbs | Capability |
|---|---|---|
| `/posting-engine` | POST | Coordinate V2 posting |
| `/journals`, `/journals/[id]`, `/journals/[id]/[action]` | GET, POST | Journal CRUD / workflow |
| `/events` | GET, POST | Accounting events stream |
| `/ledger`, `/ledger/account/[id]`, `/ledger/journals` | GET | Canonical ledger queries |
| `/ledger/rebuild`, `/ledger/reconciliation`, `/ledger/export` | POST, GET | Rebuild & recon |
| `/periods`, `/periods/[id]`, `/periods/config`, `/periods/resolve` | GET, POST, PATCH | Financial calendar |
| `/periods/financial-years`, `/periods/integrity`, `/periods/migration` | GET, POST | FY & integrity |
| `/opening-balances`, `/opening-balances/[id]/[action]` | GET, POST | Opening balance workflow |
| `/reports/generate`, `/reports/kpis`, `/reports/drill-down` | GET, POST | V2 reports |
| `/reports/runs`, `/reports/runs/[id]`, `/reports/cache`, `/reports/export` | GET, POST | Report runs & cache |
| `/reports/reconciliation` | GET | Report vs GL reconciliation |
| `/repair/anomalies`, `/repair/batches`, `/repair/exceptions` | GET, POST | Repair engine |

### CoA V2 (`/api/coa-v2`) — 12 routes

| Route | Capability |
|---|---|
| `/validate`, `/duplicates`, `/export` | Validation & export |
| `/mappings`, `/mappings/[id]` | Purpose → account registry |
| `/templates`, `/templates/apply` | Template application |
| `/consolidation-plans`, `/consolidation-plans/[id]` | Merge/consolidation |
| `/accounts/[id]/lifecycle`, `/accounts/[id]/usage` | Account lifecycle |
| `/expense-accounts` | Expense picker pipeline |

### Bank reconciliation (`/api/bank-reconciliation`) — 12 routes

| Route | Capability |
|---|---|
| `/accounts`, `/config` | Bank account setup |
| `/import/preview`, `/import/confirm` | Statement import |
| `/reconciliations`, `/reconciliations/[id]`, `/reconciliations/[id]/[action]` | Recon sessions |
| `/matches`, `/matches/[id]/[action]` | Match/unmatch |
| `/candidates`, `/adjust`, `/export/[id]` | Matching & adjustments |

### Equity management (`/api/equity-management`) — 10 routes

| Route | Capability |
|---|---|
| `/owners`, `/owners/[id]` | Owner CRUD |
| `/holdings`, `/transactions`, `/transactions/[id]/[action]` | Holdings & workflow |
| `/dividends`, `/reconcile`, `/dashboard` | Dividends & dashboard |
| `/statements/[relationshipId]`, `/config` | Statements & config |

### Accounting close (`/api/accounting-close`) — 6 routes

| Route | Capability |
|---|---|
| `/runs`, `/runs/[id]`, `/runs/[id]/[action]` | Close run workflow |
| `/readiness`, `/config`, `/reopen` | Pre-close checks & reopen |

### Financial planning (`/api/financial-planning`) — 12 routes

| Route | Capability |
|---|---|
| `/forecasts`, `/forecasts/[id]`, `/forecasts/[id]/export` | Forecast CRUD |
| `/budgets`, `/scenarios`, `/assumptions` | Planning inputs |
| `/project`, `/variance`, `/historical` | Projection & variance |
| `/readiness`, `/config`, `/ai` | Readiness & AI assist |

**Invariant:** advisory module — **must not post to GL** (REG-PLAN-NOGL).

### Loan readiness (`/api/loan-readiness`) — 6 routes

| Route | Capability |
|---|---|
| `/assessments`, `/assessments/[id]` | Assessment CRUD |
| `/calculate`, `/config`, `/export`, `/ai` | Scoring & export |

**Invariant:** advisory module — **must not post to GL** (REG-LRD-NOGL).

### Security governance (`/api/security-governance`) — 7 routes

| Route | Capability |
|---|---|
| `/dashboard`, `/audit`, `/alerts` | Monitoring |
| `/sessions`, `/api-keys`, `/approvals`, `/actor` | Access & SoD |

### System health & cutover (`/api/system`) — 6 routes

| Route | Capability |
|---|---|
| `/health`, `/health/live`, `/health/ready` | Liveness/readiness probes |
| `/cutover/status`, `/cutover/gates` | Phase 18 gate evaluation |
| `/accounting-architecture` | Architecture status API |

---

## Major UI routes (sample)

| Page path | API prefix |
|---|---|
| `/general-ledger-v2` | `/api/accounting-v2/ledger` |
| `/financial-calendar-v2` | `/api/accounting-v2/periods` |
| `/reports-v2` | `/api/accounting-v2/reports` |
| `/chart-of-accounts/governance` | `/api/coa-v2` |
| `/bank-reconciliation` | `/api/bank-reconciliation` |
| `/equity-management` | `/api/equity-management` |
| `/accounting-close` | `/api/accounting-close` |
| `/financial-planning` | `/api/financial-planning` |
| `/loan-readiness` | `/api/loan-readiness` |
| `/security-governance` | `/api/security-governance` |

---

## Gaps

- Per-route auth matrix: **PENDING** (`AUTHENTICATION_AUTHORIZATION_AUDIT.md`).
- OpenAPI / typed client: **not generated**.
- E2E route smoke (Playwright): **deferred Phase 17** (`docs/quality-assurance/TEST_GAP_REGISTER.md` GAP-QA-015).
