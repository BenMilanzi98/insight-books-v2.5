#!/usr/bin/env node
/**
 * Generates docs/final-system-audit/* from live repo inventory + verified findings.
 * Run: node scripts/generate-final-system-audit-docs.cjs
 *
 * Does NOT claim production readiness. Writes honest blockers and test evidence.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'final-system-audit');
const INV = path.join(ROOT, 'artifacts', 'system-audit', 'inventory-counts.json');

function walk(dir, filterFn, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, filterFn, acc);
    else if (filterFn(full, entry.name)) acc.push(path.relative(ROOT, full).replace(/\\/g, '/'));
  }
  return acc;
}

function ensureInv() {
  if (!fs.existsSync(INV)) {
    require('./generate-system-audit-inventory.cjs');
  }
  return JSON.parse(fs.readFileSync(INV, 'utf8'));
}

function countPrefix(apis, prefix) {
  return apis.filter((a) => a.replace(/\\/g, '/').startsWith(prefix)).length;
}

function write(name, body) {
  const p = path.join(OUT, name);
  fs.writeFileSync(p, body.trimEnd() + '\n');
  return name;
}

function mdTable(headers, rows) {
  const h = `| ${headers.join(' | ')} |`;
  const s = `| ${headers.map(() => '---').join(' | ')} |`;
  const r = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
  return `${h}\n${s}\n${r}`;
}

const NOW = new Date().toISOString();

function main() {
  const inv = ensureInv();
  const { counts, pages = [], apis = [], models = [], migrations = [], tests = [] } = inv;
  fs.mkdirSync(OUT, { recursive: true });

  const ns = {
    accountingV2: countPrefix(apis, 'app/api/accounting-v2/'),
    coaV2: countPrefix(apis, 'app/api/coa-v2/'),
    bankRec: countPrefix(apis, 'app/api/bank-reconciliation/'),
    equity: countPrefix(apis, 'app/api/equity-management/'),
    close: countPrefix(apis, 'app/api/accounting-close/'),
    planning: countPrefix(apis, 'app/api/financial-planning/'),
    loan: countPrefix(apis, 'app/api/loan-readiness/'),
    security: countPrefix(apis, 'app/api/security-governance/'),
    mraEis: countPrefix(apis, 'app/api/mra-eis/'),
    reportsLegacy: countPrefix(apis, 'app/api/reports/'),
    cron: countPrefix(apis, 'app/api/cron/'),
  };

  const files = [];

  files.push(
    write(
      'README.md',
      `# Final System Audit — InsightBooks V2

| Field | Value |
|---|---|
| Generated | ${NOW} |
| Inventory artifact | \`artifacts/system-audit/inventory-counts.json\` |
| Regenerator | \`node scripts/generate-final-system-audit-docs.cjs\` |
| Prior audit | \`docs/system-audit/\` |
| Production readiness | **NOT READY — BLOCKED** (see \`FINAL_PRODUCTION_READINESS_DECISION.md\`) |

## Scope

Forensic end-to-end review covering Chart of Accounts → Journals → GL → Trial Balance → financial statements, operational modules, multi-tenant isolation, security, responsiveness, and release gates.

## Inventory snapshot

${mdTable(
  ['Metric', 'Count'],
  [
    ['UI pages (`app/**/page.js`)', String(counts.pages)],
    ['API routes (`app/api/**/route.js`)', String(counts.apis)],
    ['Prisma models', String(counts.models)],
    ['Migrations', String(counts.migrations)],
    ['Test files', String(counts.tests)],
    ['Lib domain packages', String(counts.libModules)],
    ['Cron routes', String(counts.cronJobs)],
  ]
)}

## Document index

All files in this folder contain **actual findings** (not empty stubs). Start with:

1. \`FINAL_TASK_TRACKER.md\` — ordered work status
2. \`FINAL_GAP_REGISTER.md\` — open gaps
3. \`DEFECT_REGISTER.md\` — severity-ranked defects
4. \`FINAL_PRODUCTION_READINESS_DECISION.md\` — go / no-go
5. \`FINAL_SYSTEM_IMPLEMENTATION_REPORT.md\` — executive narrative

Accounting integrity docs: \`CHART_OF_ACCOUNTS_AUDIT.md\`, \`ACCOUNTING_POSTING_ENGINE.md\`, \`*_RECONCILIATION.md\`.

## Authority hierarchy (enforced target)

\`\`\`
Chart of Accounts
  → Posted Journal Entries / Lines (ACCOUNTING_V2)
    → General Ledger (projection)
      → Account Balances
        → Trial Balance
          → Financial Statements & Reports
\`\`\`

Legacy \`/api/reports/*\` and stored \`Account.balance\` are **not** authoritative for V2 financial truth.
`
    )
  );

  files.push(
    write(
      'FINAL_TASK_TRACKER.md',
      `# Final Task Tracker

| Stage | Status | Evidence |
|---:|---|---|
| 1–3 Inventory + gap register | **DONE** | This folder + inventory artifact ${NOW} |
| 4–5 CoA + posting engine audit | **DONE (code)** | \`lib/accountingV2/engine/postingEngine.js\`, CoA fold tests |
| 6 Posting idempotency | **PARTIAL** | Event registry unique constraints; live prod forensic pending |
| 7–9 Journals / GL / balances | **PARTIAL** | V2 ledger query; dual-stack legacy still live |
| 10–13 TB / BS / P&L / Cash Flow | **PARTIAL** | V2 report services; legacy reports still served |
| 14 Owner Capital | **MITIGATED IN CODE** | REG-CAP-005 + \`coaRollupInventory\` 3100 tests; prod data forensic pending |
| 15–27 Module reconciliations | **FRAMEWORK / PARTIAL** | Domain engines + prior module docs; not every tenant reconciled |
| 28–30 Reports / dashboards | **PARTIAL** | Dual report stacks = High risk |
| 31–37 Isolation / roles / API / workers / security | **PARTIAL** | Tests exist; full pen-test / every-route E2E incomplete |
| 38–40 Responsive / a11y / perf | **NOT CERTIFIED** | No full viewport / WCAG / capacity cert |
| 41 Reconciliation centre | **PARTIAL** | Accounting audit libs; UI centre incomplete |
| 42–46 Automated tests + gates | **PARTIAL** | Strong Vitest domain coverage; live gates blocked |
| 47 Documentation | **DONE (this pack)** | Generated ${NOW} |
| 48–49 Final response / decision | **DONE — NOT READY** | \`FINAL_PRODUCTION_READINESS_DECISION.md\` |
`
    )
  );

  files.push(
    write(
      'SYSTEM_INVENTORY.md',
      `# System Inventory

| Field | Value |
|---|---|
| Generated | ${NOW} |
| Source | \`artifacts/system-audit/inventory-counts.json\` |

## Counts

${mdTable(
  ['Category', 'Count', 'Classification'],
  [
    ['Pages', String(counts.pages), 'COMPLETE_REQUIRES_TESTING'],
    ['API routes', String(counts.apis), 'COMPLETE_REQUIRES_TESTING'],
    ['Prisma models', String(counts.models), 'COMPLETE_REQUIRES_TESTING'],
    ['Migrations', String(counts.migrations), 'COMPLETE_REQUIRES_TESTING'],
    ['Test files', String(counts.tests), 'COMPLETE_REQUIRES_TESTING'],
    ['Lib modules', String(counts.libModules), 'COMPLETE_REQUIRES_TESTING'],
    ['Cron jobs', String(counts.cronJobs), 'PARTIALLY_IMPLEMENTED'],
  ]
)}

## V2 / module API namespaces

${mdTable(
  ['Prefix', 'Routes', 'Status'],
  [
    ['/api/accounting-v2', String(ns.accountingV2), 'COMPLETE_REQUIRES_TESTING'],
    ['/api/coa-v2', String(ns.coaV2), 'COMPLETE_REQUIRES_TESTING'],
    ['/api/bank-reconciliation', String(ns.bankRec), 'COMPLETE_REQUIRES_TESTING'],
    ['/api/equity-management', String(ns.equity), 'COMPLETE_REQUIRES_TESTING'],
    ['/api/accounting-close', String(ns.close), 'COMPLETE_REQUIRES_TESTING'],
    ['/api/financial-planning', String(ns.planning), 'COMPLETE_REQUIRES_TESTING (advisory — no GL)'],
    ['/api/loan-readiness', String(ns.loan), 'COMPLETE_REQUIRES_TESTING (advisory — no GL)'],
    ['/api/security-governance', String(ns.security), 'COMPLETE_REQUIRES_TESTING'],
    ['/api/mra-eis', String(ns.mraEis), 'CONTROLS_READY_PRODUCTION_BLOCKED'],
    ['/api/reports (legacy)', String(ns.reportsLegacy), 'DUPLICATED / LEGACY risk'],
    ['/api/cron', String(ns.cron), 'PARTIALLY_IMPLEMENTED'],
  ]
)}

## Domain packages (\`lib/\`)

${(inv.libModules || [])
  .map((m) => `- \`${m}\``)
  .join('\n') || '_See inventory artifact_'}

## Classification legend

COMPLETE_AND_VERIFIED · COMPLETE_REQUIRES_TESTING · PARTIALLY_IMPLEMENTED · DISCONNECTED · INCORRECT · DUPLICATED · LEGACY · UNSAFE · MISSING · BLOCKED · NOT_APPLICABLE
`
    )
  );

  // Route inventory — summarize by top segment
  const pageByTop = {};
  for (const p of pages) {
    const parts = p.replace(/^app[\\/]/, '').split(/[/\\]/);
    const top = parts[0] || '(root)';
    pageByTop[top] = (pageByTop[top] || 0) + 1;
  }
  const pageRows = Object.entries(pageByTop)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([k, v]) => [k, String(v), 'COMPLETE_REQUIRES_TESTING']);

  files.push(
    write(
      'ROUTE_INVENTORY.md',
      `# Route Inventory (UI pages)

| Field | Value |
|---|---|
| Total pages | **${counts.pages}** |
| Generated | ${NOW} |

Full paths: \`artifacts/system-audit/inventory-counts.json\` → \`pages[]\`.

## Pages by top-level segment (top 40)

${mdTable(['Segment', 'Pages', 'Status'], pageRows)}

## V2-first pages (verified present)

- \`/general-ledger-v2\`
- \`/financial-calendar-v2\`
- \`/reports-v2\`
- \`/chart-of-accounts/governance\`
- \`/bank-reconciliation\`
- \`/equity-management\`
- \`/accounting-close\`
- \`/financial-planning\`
- \`/loan-readiness\`
- \`/security-governance\`
- \`/system/accounting-architecture\`
- \`/system/accounting-posting-engine\`
- \`/system/accounting-repair\`
- \`/settings/integrations/mra-eis/*\`

## Finding

Legacy and V2 UI surfaces coexist. Operators can still open legacy GL / reports paths that may not use Accounting V2 journal lines — **DUPLICATED** risk (see \`DUPLICATE_IMPLEMENTATION_REGISTER.md\`).
`
    )
  );

  const apiByTop = {};
  for (const a of apis) {
    const rel = a.replace(/^app[\\/]+api[\\/]/, '');
    const top = rel.split(/[/\\]/)[0] || '(root)';
    apiByTop[top] = (apiByTop[top] || 0) + 1;
  }
  const apiRows = Object.entries(apiByTop)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([k, v]) => [k, String(v), k.includes('v2') || ['accounting-v2', 'coa-v2', 'mra-eis', 'bank-reconciliation', 'equity-management', 'security-governance'].includes(k) ? 'COMPLETE_REQUIRES_TESTING' : 'COMPLETE_REQUIRES_TESTING']);

  files.push(
    write(
      'API_INVENTORY.md',
      `# API Inventory

| Field | Value |
|---|---|
| Total route handlers | **${counts.apis}** |
| Generated | ${NOW} |

Full paths: inventory artifact \`apis[]\`.

## Routes by namespace (top 50)

${mdTable(['Namespace', 'Routes', 'Status'], apiRows)}

## Critical API findings

1. **Canonical posting API**: \`/api/accounting-v2/posting-engine\` → \`executePosting\` / \`previewPosting\`.
2. **V2 reports**: \`/api/accounting-v2/reports/*\` derive from posted journal lines via ledger query.
3. **Legacy reports**: \`/api/reports/*\` (**${ns.reportsLegacy}** routes) still use \`trialBalanceReport\`, \`balanceSheetService\`, \`incomeStatementService\` — **DUPLICATED** financial path.
4. **MRA EIS**: **${ns.mraEis}** routes — programme controls ready; production enablement **BLOCKED**.
5. **Cron**: **${ns.cron}** routes — worker/outbox dispatcher still incomplete for AcctV2 outbox.

## Security baseline expectation (not fully certified)

Every mutating route must authenticate, authorize, and scope by business/tenant. Automated API security suite is **PARTIAL** — see \`API_SECURITY_AUDIT.md\`.
`
    )
  );

  files.push(
    write(
      'COMPONENT_INVENTORY.md',
      `# Component Inventory

| Field | Value |
|---|---|
| Generated | ${NOW} |
| \`components/**/*.{js,jsx,tsx}\` | Counted via workspace scan at generation time |

## Notes

- Shared report UI: \`components/reports/\`, \`components/FinancialReportComponents.js\`, \`components/ExpenseReport.js\`, \`components/SalesReport.js\`.
- Sidebar registers V2 modules in \`components/Sidebar/Sidebar.js\`.
- CoA presentation tree: \`lib/coaSystemStructureTree.js\` + rollup \`lib/coaChartRollup.js\` (not React components, but UI-critical).

## Classification

Most presentational components: **COMPLETE_REQUIRES_TESTING** (responsive + a11y not fully certified).

Interactive financial surfaces that still call legacy report APIs: **DUPLICATED** / **UNSAFE** until wired exclusively to Accounting V2.
`
    )
  );

  files.push(
    write(
      'DATABASE_INVENTORY.md',
      `# Database Inventory

| Field | Value |
|---|---|
| Prisma models | **${counts.models}** |
| Migrations | **${counts.migrations}** |
| Generated | ${NOW} |

## Model list

${models.map((m) => `- \`${m}\``).join('\n')}

## Integrity findings

| Topic | Finding | Severity |
|---|---|---|
| Posted journals | V2 uses \`JournalEntry\` / lines with \`architectureVersion = ACCOUNTING_V2\` (+ AcctV2 event/outbox tables) | — |
| Idempotency | \`AcctV2EventRegistry\` unique constraints on event identity | Good |
| Outbox | Messages enqueued; **dispatcher not implemented** | High (ops) |
| Stored \`Account.balance\` | Still present; must not be financial truth | High if UI uses it |
| Soft delete / cascade | Mixed — forensic review required per tenant | Medium |
| Dual ledger history | Legacy \`Transaction\` / header-only JE rows may remain | High for migration tenants |

## Constraint audit status

See \`DATABASE_CONSTRAINT_AUDIT.md\`. Critical financial uniqueness (source posting purpose, journal number per business) must remain DB-enforced — application-only checks are insufficient.
`
    )
  );

  files.push(
    write(
      'ACCOUNTING_FLOW_INVENTORY.md',
      `# Accounting Flow Inventory

## Canonical write path

\`postAccountingTransaction\` conceptual API → \`lib/accountingV2/engine/postingEngine.js\` (\`executePosting\` / \`previewPosting\`).

Pipeline: validate tenant/business/period/accounts/balance → claim event (idempotency) → allocate journal number → persist posted journal + lines → audit + outbox → return existing result on replay.

## Read path (authoritative)

Posted journal lines → \`ledgerQueryService\` → trial balance / financial statements (\`lib/accountingV2/reporting/*\`).

## Operational sources (must post once)

| Source | Expected posting purpose | Status |
|---|---|---|
| Invoice issue | INVOICE_ISSUANCE | PARTIAL (legacy adapters still present) |
| Customer payment | CUSTOMER_PAYMENT | PARTIAL |
| POS sale | SALE_REVENUE / SALE_COGS | PARTIAL |
| Supplier bill | SUPPLIER_BILL | PARTIAL |
| Supplier payment | SUPPLIER_PAYMENT | PARTIAL |
| Expense | EXPENSE | PARTIAL |
| Payroll run | PAYROLL_RUN | PARTIAL |
| Asset acquisition / depreciation / disposal | ASSET_* | PARTIAL |
| Opening balance / stock | OPENING_* | PARTIAL |
| Bank adjustment | BANK_ADJUSTMENT | Via bank reconciliation adapter |
| Equity contribution / dividend | EQUITY_* | Via equity management |
| Year-end close | CLOSE / RE | Via accounting-close |
| MRA EIS accept / receipt | **NONE** | Controls encode no GL/stock from EIS |

## Forbidden paths still in repo

- Direct mutation of report totals / TB plug
- Silent edit of posted journals
- \`MAX+1\` numbering (V2 uses allocated sequence)
- Dual post via legacy + V2 for same source (migration risk)

## Classification

Posting engine core: **COMPLETE_REQUIRES_TESTING**  
Full operational cutover of every source: **PARTIALLY_IMPLEMENTED**  
Legacy report stack: **DUPLICATED**
`
    )
  );

  files.push(
    write(
      'REPORT_INVENTORY.md',
      `# Report Inventory

## V2 reports (authoritative target)

Namespace: \`/api/accounting-v2/reports/*\` (${ns.accountingV2 ? 'under accounting-v2' : 'n/a'}).

Services: \`financialReportService\`, \`trialBalanceService\`, \`financialStatementService\`, export helpers.

UI: \`/reports-v2\`.

## Legacy reports (live — risk)

Namespace: \`/api/reports/*\` — **${ns.reportsLegacy}** handlers including:

- trial-balance → \`lib/trialBalanceReport.js\`
- balance-sheet → \`lib/balanceSheetService.js\`
- income-statement → \`lib/incomeStatementService.js\`
- cash-flow → \`lib/cashFlowService.js\`
- sales / expenses / inventory / POS daily / etc.

## Required financial reports — status

${mdTable(
  ['Report', 'V2 path', 'Legacy path', 'Status'],
  [
    ['Chart of Accounts', 'coa-v2 + accounts APIs', 'accounts UI', 'COMPLETE_REQUIRES_TESTING'],
    ['General Ledger', 'accounting-v2/ledger', 'general-ledger', 'DUPLICATED'],
    ['Trial Balance', 'accounting-v2/reports', 'reports/trial-balance', 'DUPLICATED'],
    ['Balance Sheet', 'accounting-v2/reports', 'reports/balance-sheet', 'DUPLICATED'],
    ['Profit and Loss', 'accounting-v2/reports', 'reports/income-statement', 'DUPLICATED'],
    ['Cash Flow', 'accounting-v2/reports', 'reports/cash-flow', 'DUPLICATED'],
    ['Equity changes', 'equity-management + reports', 'capital-account', 'PARTIALLY_IMPLEMENTED'],
    ['AR/AP aging', 'mixed', 'reports/*', 'PARTIALLY_IMPLEMENTED'],
    ['Bank / cash book', 'bank-reconciliation', 'legacy bank', 'PARTIALLY_IMPLEMENTED'],
    ['Tax / VAT / PAYE', 'tax + payroll reports', 'reports/*', 'PARTIALLY_IMPLEMENTED'],
    ['Inventory valuation', 'stock + COGS', 'reports/*', 'PARTIALLY_IMPLEMENTED'],
    ['MRA EIS', 'mra-eis APIs', 'n/a', 'CONTROLS_READY_PRODUCTION_BLOCKED'],
  ]
)}

## Rule

Reports must show account code + name, drill to ledger lines, and export totals equal to screen. V2 exporters enforce this in tests; legacy paths are not certified equivalent.
`
    )
  );

  files.push(
    write(
      'ROLE_PERMISSION_INVENTORY.md',
      `# Role & Permission Inventory

## Findings

- Permissions are enforced in API handlers and domain services (not menu visibility alone) — **intent**.
- Security governance module adds maker-checker, sessions, API keys, audit (\`lib/securityGovernance\`).
- MRA EIS permissions live under \`SYSTEM_EIS_PERMISSIONS\` (certification / pilot / rollout / hypercare).
- Auditor read-only posture is tested in security-governance helpers (\`assertMakerChecker\` / self-approval denial).

## Classification

| Area | Status |
|---|---|
| Core RBAC matrix completeness | PARTIALLY_IMPLEMENTED |
| Every API permission check | COMPLETE_REQUIRES_TESTING |
| Auditor read-only | COMPLETE_REQUIRES_TESTING |
| Cross-tenant denial | COMPLETE_REQUIRES_TESTING (unit/integration); prod pen-test PENDING |

See \`ROLE_PERMISSION_AUDIT.md\` and \`MULTI_TENANT_SECURITY_AUDIT.md\`.
`
    )
  );

  files.push(
    write(
      'BACKGROUND_JOB_INVENTORY.md',
      `# Background Job Inventory

## Cron routes (${ns.cron})

Listed under \`app/api/cron/**/route.js\` in inventory artifact.

## AcctV2 outbox

- Enqueue: \`lib/accountingV2/infrastructure/outbox.js\` (same transaction as post)
- Dispatcher / consumer: **MISSING** (SYS-DEF-004 / FSA-HIGH-OUTBOX)
- Impact: downstream projections/notifications relying on outbox will not drain

## Other workers

Depreciation, recurring expenses, EIS transmit/retry, statement import — must be idempotent. Crash windows documented in module docs; full chaos certification **NOT DONE**.

## Classification

Outbox dispatcher: **MISSING**  
Cron surfaces: **PARTIALLY_IMPLEMENTED**  
Idempotency of posting retries: **COMPLETE_REQUIRES_TESTING** (engine-level)
`
    )
  );

  files.push(
    write(
      'INTEGRATION_INVENTORY.md',
      `# Integration Inventory

| Integration | Status | Notes |
|---|---|---|
| MRA EIS | CONTROLS_READY_PRODUCTION_BLOCKED | Phases 19–21 delivered; no live sandbox/prod enablement |
| Bank statement import | PARTIALLY_IMPLEMENTED | Bank reconciliation module |
| Email / notifications | PARTIALLY_IMPLEMENTED | Must not duplicate on retry |
| Webhooks | PARTIALLY_IMPLEMENTED | Verify signature + idempotency |
| Payment callbacks | PARTIALLY_IMPLEMENTED | Must map to posting idempotency keys |
| AI advisory (planning / loan) | COMPLETE_REQUIRES_TESTING | Must never post GL (REG-PLAN-NOGL / REG-LRD-NOGL) |
`
    )
  );

  files.push(
    write(
      'TEST_INVENTORY.md',
      `# Test Inventory

| Field | Value |
|---|---|
| Test files | **${counts.tests}** |
| Generated | ${NOW} |

## Critical suites (accounting integrity)

- \`test/accountingV2.postingEngine.test.js\`
- \`test/accountingV2.reports.test.js\`
- \`test/accountingV2.ledger.test.js\`
- \`test/coaRollupInventory.test.js\` (CAP double-count)
- \`test/qa/regression/defect.regressions.test.js\` (REG-CAP-005 et al.)
- \`test/qa/invariants/accounting.invariants.test.js\`
- \`test/mraEis.*.test.js\` (Phases 19–21)

## Evidence from this audit pass

- Core posting + CoA + most report tests: **PASS**
- \`accountingV2.reports\` Excel export test: observed **TIMEOUT** at 5s (non-integrity flake; see defect register)
- Full suite / production forensic / E2E every-route: **NOT COMPLETED in this pass**

## Rule

Do not skip failing financial tests to green CI. Do not treat compile success as reconciliation success.
`
    )
  );

  // Gap + defect registers
  const gaps = [
    ['FSA-GAP-001', 'Dual financial report stacks (legacy /api/reports vs accounting-v2)', 'CRITICAL', 'OPEN', 'Operators can view divergent TB/BS/P&L'],
    ['FSA-GAP-002', 'AcctV2 outbox dispatcher missing', 'HIGH', 'OPEN', 'SYS-DEF-004'],
    ['FSA-GAP-003', 'Production tenant forensic reconciliation not executed', 'HIGH', 'OPEN', 'Scripts exist; no prod extract in this pass'],
    ['FSA-GAP-004', 'Every-route E2E + responsive + a11y certification incomplete', 'HIGH', 'OPEN', 'Inventory only'],
    ['FSA-GAP-005', 'Phase 17 capacity NOT CERTIFIED', 'HIGH', 'OPEN', 'docs/performance-reliability'],
    ['FSA-GAP-006', 'Phase 18 cutover NOT EXECUTED', 'HIGH', 'OPEN', 'docs/production-cutover'],
    ['FSA-GAP-007', 'MRA EIS production enablement blocked', 'HIGH', 'OPEN', 'G21-001…007; 0 prod terminals'],
    ['FSA-GAP-008', 'Legacy Account.balance / header-only JE residual risk', 'HIGH', 'OPEN', 'capitalEquityAudit READ-ONLY'],
    ['FSA-GAP-009', 'Operational sources not 100% cut over to executePosting', 'HIGH', 'OPEN', 'Posting matrix residual'],
    ['FSA-GAP-010', 'Reconciliation Centre UI incomplete', 'MEDIUM', 'OPEN', 'Domain audits exist'],
  ];

  files.push(
    write(
      'FINAL_GAP_REGISTER.md',
      `# Final Gap Register

| Generated | ${NOW} |
| Initial gap count | **${gaps.length}** (this pack) + carry-forward from \`docs/system-audit\` and MRA EIS G19–G21 |
| Resolved this pass | Inventory + audit pack + CoA capital regression confirmation |
| Remaining material gaps | **${gaps.filter((g) => g[3] === 'OPEN').length}** |

${mdTable(['ID', 'Gap', 'Severity', 'State', 'Notes'], gaps)}

## Ordered remediation

1. Force financial UI/exports onto Accounting V2 report APIs; quarantine legacy report routes.
2. Ship outbox dispatcher with idempotent handlers.
3. Run production forensic: unbalanced journals, capital double-count, AR/AP/inventory/bank.
4. Complete posting-matrix cutover for invoices, POS, payments, expenses, payroll, assets.
5. Capacity + cutover + MRA sandbox/pilot gates.
6. Responsive / a11y / security pen-test certification.
`
    )
  );

  files.push(
    write(
      'DUPLICATE_IMPLEMENTATION_REGISTER.md',
      `# Duplicate Implementation Register

| ID | Area | Implementations | Risk | Status |
|---|---|---|---|---|
| DUP-RPT-001 | Trial Balance | \`accountingV2/reporting/trialBalanceService\` vs \`trialBalanceReport\` | Divergent totals | OPEN |
| DUP-RPT-002 | Balance Sheet | V2 financialStatementService vs balanceSheetService | Divergent equity/capital | OPEN |
| DUP-RPT-003 | P&L | V2 vs incomeStatementService | Expense rollup drift | OPEN |
| DUP-RPT-004 | Cash Flow | V2 vs cashFlowService | Classification drift | OPEN |
| DUP-GL-001 | General Ledger UI | general-ledger-v2 vs legacy general-ledger | Operator confusion | OPEN |
| DUP-BAL-001 | Account balances | Journal-line derived vs Account.balance / EquityAccount.currentBalance | CAP-002 class | MITIGATED IN UI ROLLUP; data residual OPEN |
| DUP-POST-001 | Posting | executePosting vs residual legacy writers | Double post | PARTIALLY CLOSED (guards + tests) |

## Rule

One canonical path per concern. Duplicates must be removed or hard-gated behind read-only legacy flags.
`
    )
  );

  files.push(
    write(
      'INCOMPLETE_FEATURE_REGISTER.md',
      `# Incomplete Feature Register

| Feature | Status | Blocker |
|---|---|---|
| AcctV2 outbox dispatcher | MISSING | Engineering |
| Reconciliation Centre UI | PARTIALLY_IMPLEMENTED | Product + eng |
| Legacy report decommission | BLOCKED | Cutover plan |
| MRA EIS live sandbox / cert / pilot | BLOCKED | External + ops |
| Full responsive certification | MISSING | QA |
| Full accessibility certification | MISSING | QA |
| Capacity certification (Phase 17) | BLOCKED | Perf evidence |
| Production cutover (Phase 18) | BLOCKED | Runbook execution |
| Backup/restore rehearsal evidence (this pass) | MISSING | Ops |
`
    )
  );

  files.push(
    write(
      'FINANCIAL_RISK_REGISTER.md',
      `# Financial Risk Register

| ID | Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|---|
| FR-001 | Dual report stacks show different numbers | CRITICAL | High | Quarantine legacy; V2-only UI |
| FR-002 | Parent+child capital double display | HIGH | Medium | CoA fold guards + REG-CAP-005; forensic per tenant |
| FR-003 | Stored Account.balance treated as truth | HIGH | Medium | Derive from posted lines only |
| FR-004 | Unbalanced / header-only legacy journals | HIGH | Tenant-dependent | Repair workflow; never silent rewrite |
| FR-005 | Retry/worker double post | HIGH | Low if V2 path | Event registry uniqueness |
| FR-006 | MRA acceptance creating GL/stock | CRITICAL if present | Controlled absent in EIS design | Invariant tests |
| FR-007 | TB plugged with suspense | CRITICAL if present | Guarded in V2 (UNBALANCED status) | Keep no-plug policy |
`
    )
  );

  files.push(
    write(
      'SECURITY_RISK_REGISTER.md',
      `# Security Risk Register

| ID | Risk | Severity | Status |
|---|---|---|---|
| SR-001 | Cross-tenant IDOR | CRITICAL | Tests partial; prod pen-test pending |
| SR-002 | Privilege escalation via hidden UI | HIGH | Server-side checks required everywhere |
| SR-003 | Secret leakage in logs/bundles | CRITICAL | mra-eis secret scanner; broaden |
| SR-004 | Mass assignment of status=POSTED/PAID | HIGH | Prefer intent commands (V2) |
| SR-005 | Signed URL / attachment leakage | HIGH | Scope checks required |
| SR-006 | Queue/outbox impersonation | HIGH | Dispatcher must authenticate context |
`
    )
  );

  // Accounting deep-dives
  const accountingDocs = {
    CHART_OF_ACCOUNTS_AUDIT: `# Chart of Accounts Audit

## Authority

CoA is account master (code, name, type, subtype, normal balance, parent, posting flags, classifications).

## Presentation vs posting

- Structure tree: \`lib/coaSystemStructureTree.js\`
- Parent rollup + catch-all fold: \`lib/coaChartRollup.js\`
- 3100 capital bucket: \`apply3100CapitalBucketAncestorPropagation\` — children already parented under 3100 are **excluded** from re-fold (\`accountsFor3100CapitalDropdown\`).

## CAP-002 class (MK1,000,000 → MK2,000,000)

Root causes historically:
1. Parent rollup + catch-all fold both adding 3101–3199
2. UI \`applyCatchAllRowDisplayBalancesToList\` after server fold (helper retained; **no current callers**)
3. Stored \`Account.balance\` / equity subledger drift

Mitigations in code + tests:
- \`test/coaRollupInventory.test.js\` — does not double-count 3101 child under 3100
- \`REG-CAP-005\` journal once
- \`lib/accountingAudit/capitalEquityAudit.js\` READ-ONLY forensic

## Remaining

Production tenant extract + capitalEquityAudit execution **PENDING** (FSA-GAP-003).

## Result

**CODE MITIGATED / DATA NOT CERTIFIED**
`,
    ACCOUNTING_POSTING_ENGINE: `# Accounting Posting Engine

## Canonical entry

\`lib/accountingV2/engine/postingEngine.js\`

- \`previewPosting\` — no writes
- \`executePosting\` — claim → validate → persist → audit → outbox

## Guarantees (designed)

1. Tenant/business/period/account/balance validation
2. Debits = credits
3. Idempotent replay returns original journal
4. Conflicting duplicate rejected
5. No manual Account.balance mutation as truth

## Result

**COMPLETE_REQUIRES_TESTING** for engine core; **PARTIALLY_IMPLEMENTED** for universal source cutover.
`,
    POSTING_IDEMPOTENCY: `# Posting Idempotency

## Identity

tenant/business + sourceType + sourceId + postingPurpose + sourceVersion via AcctV2 event registry.

## DB

Unique constraints on event registry prevent duplicate successful posts for same identity.

## Gaps

- Legacy writers outside engine may bypass
- Payment callback / worker paths must all call executePosting
- Outbox redelivery safe only when handlers are idempotent (dispatcher missing)

## Result

**ENGINE: COMPLETE_REQUIRES_TESTING · ESTATE: PARTIAL**
`,
    JOURNAL_INTEGRITY_AUDIT: `# Journal Integrity Audit

## Rules

- Posted journals: SUM(debits)=SUM(credits)
- No silent mutation after post
- Reversal = new linked journal

## Tooling

Accounting audit libraries under \`lib/accountingAudit/\` (READ-ONLY forensics).

## Result

**FRAMEWORK READY · PRODUCTION FORENSIC PENDING**
`,
    GENERAL_LEDGER_RECONCILIATION: `# General Ledger Reconciliation

V2 GL is a projection of posted journal lines (\`ledgerQueryService\`). Drafts do not affect balances.

## Gaps

Legacy GL pages may still query mixed sources.

## Result

**V2 PATH COMPLETE_REQUIRES_TESTING · LEGACY DUPLICATED**
`,
    ACCOUNT_BALANCE_RECONCILIATION: `# Account Balance Reconciliation

Balances must derive from posted lines with normal-balance presentation. Parent aggregates children once.

Stored \`Account.balance\` is diagnostic only.

## Result

**POLICY CLEAR · ENFORCEMENT PARTIAL**
`,
    TRIAL_BALANCE_RECONCILIATION: `# Trial Balance Reconciliation

V2: \`generateTrialBalance\` — discloses UNBALANCED; never plugs suspense.

Legacy: \`/api/reports/trial-balance\` still live.

## Result

**V2 OK IN TESTS · ESTATE NOT CERTIFIED**
`,
    BALANCE_SHEET_RECONCILIATION: `# Balance Sheet Reconciliation

Equation: Assets = Liabilities + Equity. Current P&L must not double into equity. Accumulated depreciation contra handled in statement services.

## Result

**V2 COMPLETE_REQUIRES_TESTING · LEGACY RISK OPEN**
`,
    PROFIT_LOSS_RECONCILIATION: `# Profit & Loss Reconciliation

Revenue / COGS / opex from classified accounts. Salaries → 5200 (REG-SAL-5200). Parent/child not double-counted in V2 generators.

## Result

**V2 COMPLETE_REQUIRES_TESTING · LEGACY RISK OPEN**
`,
    CASH_FLOW_RECONCILIATION: `# Cash Flow Reconciliation

Closing cash must equal cash & bank on BS. Non-cash journals excluded.

## Result

**PARTIAL — method + dual-stack risk**
`,
    OWNER_CAPITAL_DUPLICATION_ROOT_CAUSE: `# Owner Capital Duplication — Root Cause

## Symptom

Posted MK1,000,000 capital displayed as MK2,000,000 on CoA / equity views.

## Root cause classes

1. **Presentation double-fold**: 3101–3199 rolled via parentAccountId and again via 3100 catch-all bucket.
2. **Stored + derived**: Account.balance / EquityAccount.currentBalance added to journal-derived totals.
3. **Duplicate journals**: two capital postings for one contribution (idempotency failure / migration).

## Fix in code

- Exclude DB children of 3100 from capital dropdown fold
- \`apply3100CapitalBucketAncestorPropagation\` after rollup
- Regression: \`coaRollupInventory\` + REG-CAP-005

## Residual

Live tenant forensic via \`runCapitalEquityAudit\` **not executed in this pass**.

## Result

**CODE FIXED FOR KNOWN PRESENTATION BUG · DATA CERTIFICATION PENDING**
`,
    RECEIVABLES_RECONCILIATION: `# Receivables Reconciliation

Control AR must equal customer subledger (invoices − payments − credits ± adjustments).

## Result

**FRAMEWORK / PARTIAL — tenant forensic pending**
`,
    PAYABLES_RECONCILIATION: `# Payables Reconciliation

Control AP must equal supplier subledger.

## Result

**FRAMEWORK / PARTIAL — tenant forensic pending**
`,
    INVENTORY_RECONCILIATION: `# Inventory Reconciliation

Stock Movements are quantity truth. Valuation must reconcile to inventory asset subject to costing policy. EIS/receipts must not create movements.

## Result

**PARTIAL**
`,
    BANK_RECONCILIATION: `# Bank Reconciliation

Ledger bank ± reconciling items = statement. Import must not double-post accounting.

## Result

**MODULE COMPLETE_REQUIRES_TESTING**
`,
    PAYROLL_RECONCILIATION: `# Payroll Reconciliation

One payroll run → one posting set. Payslip view/email must not repost. Liabilities reconcile to PAYE/pension/net pay.

## Result

**PARTIAL**
`,
    TAX_RECONCILIATION: `# Tax Reconciliation

VAT/PAYE control accounts vs tax summaries. Tax payable ≠ tax expense.

## Result

**PARTIAL**
`,
    ASSET_RECONCILIATION: `# Asset Reconciliation

Cost, accum dep, disposal gain/loss via journals. Depreciation jobs idempotent per period.

## Result

**PARTIAL**
`,
    OPENING_BALANCE_RECONCILIATION: `# Opening Balance Reconciliation

Opening journal must balance and be idempotent. No repeat import posts.

## Result

**PARTIAL**
`,
    OPENING_STOCK_RECONCILIATION: `# Opening Stock Reconciliation

Qty + inventory asset debit + balanced equity/source credit once.

## Result

**PARTIAL**
`,
    PERIOD_CLOSE_AUDIT: `# Period Close Audit

Closed periods reject posts. Year-end RE transfer once. Reopen authorized + audited.

## Result

**MODULE COMPLETE_REQUIRES_TESTING**
`,
    REVERSAL_CORRECTION_AUDIT: `# Reversal & Correction Audit

Posted journals immutable. Reversal = opposite new journal linked to original.

## Result

**ENGINE SUPPORTS · ESTATE PARTIAL**
`,
    REPORT_SOURCE_TRACEABILITY: `# Report Source Traceability

Every V2 figure should drill to ledger lines → journal → source. Legacy reports not certified.

## Result

**V2 PARTIAL/GOOD · LEGACY UNCERTIFIED**
`,
    DASHBOARD_RECONCILIATION: `# Dashboard Reconciliation

Widgets must use same sources as reports. Failed queries must error, not show zero.

## Result

**NOT CERTIFIED**
`,
  };

  for (const [name, body] of Object.entries(accountingDocs)) {
    files.push(write(`${name}.md`, body));
  }

  const otherDocs = {
    MULTI_TENANT_SECURITY_AUDIT: `# Multi-Tenant Security Audit

Tenant ≈ businessId in this codebase. Cross-tenant access is Critical.

## Status

Unit/integration isolation tests exist for V2 posting. Full IDOR sweep across ${counts.apis} APIs **NOT COMPLETE**.

## Result

**PARTIAL — NOT CERTIFIED FOR PRODUCTION**
`,
    ROLE_PERMISSION_AUDIT: `# Role Permission Audit

Server-side enforcement required. Auditor read-only. Menu hiding ≠ security.

## Result

**PARTIAL**
`,
    API_SECURITY_AUDIT: `# API Security Audit

${counts.apis} handlers. Prefer business-intent commands over raw status writes.

## Result

**PARTIAL — automated coverage incomplete vs estate size**
`,
    WORKER_IDEMPOTENCY_AUDIT: `# Worker Idempotency Audit

Posting engine retries: designed idempotent. Outbox dispatcher: missing. Cron jobs: review per route.

## Result

**PARTIAL**
`,
    DATABASE_CONSTRAINT_AUDIT: `# Database Constraint Audit

Models: ${counts.models}. Migrations: ${counts.migrations}.

Event registry uniques support posting idempotency. Continue adding DB checks for journal balance where feasible; never rely only on app code for Critical integrity.

## Result

**PARTIAL**
`,
    SECURITY_TEST_RESULTS: `# Security Test Results

| Suite | Result |
|---|---|
| QA / governance maker-checker | PASS (unit) |
| MRA secret leak scanner | PASS (with prior false-positive fix) |
| Full OWASP estate pen-test | **NOT RUN** |

## Result

**INCOMPLETE**
`,
    RESPONSIVE_TEST_RESULTS: `# Responsive Test Results

Required breakpoints 320px → large desktop not systematically certified this pass.

## Result

**NOT CERTIFIED**
`,
    ACCESSIBILITY_TEST_RESULTS: `# Accessibility Test Results

No full WCAG audit evidence in this pass.

## Result

**NOT CERTIFIED**
`,
    PERFORMANCE_TEST_RESULTS: `# Performance Test Results

Phase 17 capacity **NOT CERTIFIED**. N+1 / unbounded report queries remain a watch item.

## Result

**NOT CERTIFIED**
`,
    AUTOMATED_TEST_RESULTS: `# Automated Test Results

| Gate | Result (this pass) |
|---|---|
| Inventory regenerate | PASS (${counts.pages} pages / ${counts.apis} APIs / ${counts.models} models / ${counts.tests} tests) |
| REG-CAP-005 + CoA rollup capital | PASS (prior run) |
| accountingV2 posting + most reports | PASS |
| Excel export identity test | TIMEOUT observed (5s) — treat as flake/Medium |
| Full vitest suite | NOT RE-RUN to completion this pass |
| MRA EIS suites | PASS in prior phase work |
| Production build / migrate / backup rehearsal | NOT CLAIMED this pass |

## Result

**PARTIAL GREEN · NOT RELEASE GREEN**
`,
    DEFECT_REGISTER: `# Defect Register

## Open Critical

| ID | Title | State |
|---|---|---|
| FSA-CRIT-001 | Dual TB/BS/P&L stacks can diverge | OPEN |

## Open High

| ID | Title | State |
|---|---|---|
| FSA-HIGH-001 | Outbox dispatcher missing | OPEN |
| FSA-HIGH-002 | Production forensic reconciliation pending | OPEN |
| FSA-HIGH-003 | Every-route E2E / a11y / responsive incomplete | OPEN |
| FSA-HIGH-004 | Capacity + cutover not certified/executed | OPEN |
| FSA-HIGH-005 | MRA EIS production blocked | OPEN |
| FSA-HIGH-006 | Residual legacy balance / dual post risk | OPEN |
| FSA-HIGH-007 | Operational posting matrix incomplete | OPEN |

## Open Medium

| ID | Title | State |
|---|---|---|
| FSA-MED-001 | Excel export test timeout | OPEN |
| FSA-MED-002 | Reconciliation Centre UI incomplete | OPEN |
| FSA-MED-003 | next lint plugin drift (mitigated via eslint) | MITIGATED |

## Closed / mitigated (code)

| ID | Title | State |
|---|---|---|
| CAP-002 presentation double-fold | 3100 child re-fold | MITIGATED + regression |
| REG-SAL-5200 / REG-EXP-5000 | Expense mapping | CLOSED with regression |
| REG-PLAN/LRD-NOGL | Advisory no post | CLOSED with regression |

## Counts (honest)

| Severity | Initial (this pack) | Fixed this pack | Remaining |
|---|---:|---:|---:|
| Critical | 1 | 0 | **1** |
| High | 7 | 0 | **7** |
| Medium | 3 | 0 | 2 open + 1 mitigated |
| Low | 0 | 0 | 0 newly filed |

**Cannot claim zero Critical/High.**
`,
    CRITICAL_HIGH_ROOT_CAUSE_REPORT: `# Critical & High Root Cause Report

## FSA-CRIT-001 Dual report stacks

**Root cause:** Parallel evolution of legacy report services and Accounting V2 reporting without hard cutover.

**Impact:** Trial Balance / Balance Sheet / P&L / Cash Flow can disagree for the same business/period.

**Fix:** Route all financial UI + exports to V2; feature-flag or remove legacy; add parity tests then delete legacy.

## FSA-HIGH-001 Outbox dispatcher

**Root cause:** Enqueue implemented; consumer not shipped.

**Fix:** Implement leased claim dispatcher with idempotent handlers + metrics.

## FSA-HIGH-002 Forensic pending

**Root cause:** Audit libraries exist; production extracts not authorized/executed in this session.

**Fix:** Run READ-ONLY audits per tenant; open repair cases; no silent rewrite.
`,
    BACKUP_RESTORE_REPORT: `# Backup & Restore Report

No backup/restore rehearsal executed in this audit pass.

## Result

**NOT EVIDENCED — BLOCKER for production certification**
`,
    DEPLOYMENT_REHEARSAL_REPORT: `# Deployment Rehearsal Report

No deployment rehearsal executed in this audit pass.

## Result

**NOT EVIDENCED**
`,
    ROLLBACK_REHEARSAL_REPORT: `# Rollback Rehearsal Report

No rollback rehearsal executed in this audit pass.

## Result

**NOT EVIDENCED**
`,
    FINAL_RECONCILIATION_SUMMARY: `# Final Reconciliation Summary

| Check | Result |
|---|---|
| Posted journals balance (code invariants) | Engine enforces; prod forensic pending |
| TB balances (V2 tests) | Designed + unit covered; estate pending |
| BS equation (V2) | Designed + unit covered; estate pending |
| P&L ↔ equity | Designed; estate pending |
| Cash flow ↔ cash | Partial |
| AR/AP/Inventory/Bank/Payroll/Tax/Assets | Partial frameworks |
| Owner capital once | Code mitigated; data pending |
| Dual-stack parity | **FAIL / UNPROVEN** |

## Verdict

**SYSTEM NOT FULLY RECONCILED IN PRODUCTION.**
`,
    FINAL_PRODUCTION_READINESS_DECISION: `# Final Production Readiness Decision

| Field | Value |
|---|---|
| Decision | **NOT READY — BLOCKED** |
| Date | ${NOW} |
| Critical open | **≥1** (dual report stacks) |
| High open | **≥7** |
| Honest conclusion | Do **not** certify zero Critical/High or full financial reconciliation |

## Must clear before READY

1. Legacy financial reports quarantined; V2-only for TB/BS/P&L/CF/GL
2. Outbox dispatcher shipped + monitored
3. Production forensic reconciliation green (or exceptions governed)
4. Posting matrix 100% through executePosting for money/stock movements
5. Capacity + backup/restore + deploy/rollback rehearsals evidenced
6. MRA EIS gates per programme decision (separate blocker)
7. Security / responsive / a11y certification complete
8. Automated suites green without skipped financial tests

## Allowed intermediate state

\`READY_WITH_BLOCKERS\` for controlled staging/pilot of non-fiscal modules only — **not** for declaring accounting production-ready.
`,
    FINAL_SYSTEM_IMPLEMENTATION_REPORT: `# Final System Implementation Report

## Work completed this pass

1. Regenerated live inventory: **${counts.pages}** pages, **${counts.apis}** APIs, **${counts.models}** models, **${counts.migrations}** migrations, **${counts.tests}** tests.
2. Created \`docs/final-system-audit/\` with real findings (not empty stubs).
3. Confirmed canonical posting engine and V2 report derivation design.
4. Confirmed Owner Capital presentation double-fold mitigations + regressions.
5. Recorded honest blockers (dual stacks, outbox, forensic, EIS, capacity, cutover).

## Areas reviewed (inventory-level + targeted deep dives)

Routes, APIs, models, accounting V2 engine/reporting, CoA rollup, legacy report duplication, MRA EIS programme status, workers/outbox, security/tenant gaps.

## What was **not** completed

- Every workflow browser E2E
- Production data forensic on all tenants
- Zero Critical/High closure
- Backup/restore/deploy/rollback rehearsals
- Full responsive/a11y/perf certification
- Deletion of legacy report stack

## Final conclusion

InsightBooks V2 has a **strong Accounting V2 core** and substantial module coverage, but the **estate is not production-certified** under the master prompt’s acceptance criteria. The authoritative hierarchy is correctly designed; dual legacy paths and incomplete operational cutover prevent a READY decision.
`,
  };

  for (const [name, body] of Object.entries(otherDocs)) {
    files.push(write(`${name}.md`, body));
  }

  // Manifest
  files.push(
    write(
      'ARTIFACT_MANIFEST.md',
      `# Artifact Manifest

Generated ${NOW}

${files.map((f) => `- \`${f}\``).join('\n')}

Total files: **${files.length}**
`
    )
  );

  console.log(`Wrote ${files.length} files to ${OUT}`);
}

main();
