/**
 * Phase 2 audit pack generator — evidence from repository inspection 2026-07-22.
 * No MRA API calls. No credentials. No financial mutations.
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'docs/mra-eis/phase-2';
const D = '2026-07-22';
const written = [];

function w(rel, body) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(
    p,
    body.replace(/\n{3,}/g, '\n\n').trim() +
      '\n\n---\n*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*\n'
  );
  written.push(rel);
}

function doc(rel, title, lines) {
  w(
    rel,
    [`# ${title}`, '', `**Phase:** 2 — Internal Architecture Audit`, `**Audit date:** ${D}`, '', ...lines].join(
      '\n'
    )
  );
}

const tasks = [
  'A Repository inventory',
  'B Runtime and framework discovery',
  'C Package and dependency analysis',
  'D Environment-variable analysis',
  'E Deployment architecture',
  'F Multi-tenant hierarchy',
  'G Tenant entitlement capability',
  'H Business Context',
  'I Branch architecture',
  'J Warehouse architecture',
  'K POS architecture',
  'L Sales Invoice architecture',
  'M Customer architecture',
  'N Product and service architecture',
  'O Tax architecture',
  'P Payment-method architecture',
  'Q Inventory architecture',
  'R Sales accounting',
  'S Invoice accounting',
  'T POS accounting',
  'U Inventory accounting',
  'V Journal architecture',
  'W Posting Engine',
  'X General Ledger',
  'Y Accounting Periods',
  'Z Transactional Outbox',
  'AA Queue system',
  'AB Background workers',
  'AC Scheduled Jobs',
  'AD Retry infrastructure',
  'AE Idempotency infrastructure',
  'AF Concurrency controls',
  'AG Receipt generation',
  'AH PDF generation',
  'AI Email Invoice generation',
  'AJ QR-code capability',
  'AK Authentication',
  'AL Authorization',
  'AM Roles and Permissions',
  'AN Approval workflows',
  'AO Audit Trail',
  'AP Secret storage',
  'AQ Encryption',
  'AR Logging',
  'AS Metrics',
  'AT Alerting',
  'AU Health checks',
  'AV API architecture',
  'AW Webhooks',
  'AX Caching',
  'AY File storage',
  'AZ Existing integrations',
  'BA Existing EFD or EIS implementation',
  'BB Existing MRA fields',
  'BC Multi-currency',
  'BD Timezone and dates',
  'BE Data retention',
  'BF Error handling',
  'BG Testing architecture',
  'BH Existing data integrity',
  'BI Existing transaction classification',
  'BJ Phase 3 target-architecture requirements',
  'BK Gap register',
  'BL Risk register',
  'BM Final readiness report',
];

doc('README.md', 'Phase 2 — InsightBooks Architecture Audit for MRA EIS', [
  '## Decision',
  '',
  '**READY_FOR_PHASE_3_WITH_BLOCKERS** — see [PHASE_2_READINESS_DECISION.md](./PHASE_2_READINESS_DECISION.md)',
  '',
  '## Inputs',
  '',
  'Phase 1 pack: `docs/mra-eis/phase-1/`',
  '',
  '## Key architectural facts',
  '',
  '1. **Tenant = Business** (no separate Business model); `businessId` aliases `tenantId` in Accounting V2.',
  '2. POS and Invoice finalize accounting **inside** local `$transaction`; legacy EIS submit is **post-commit best-effort**.',
  '3. Accounting V2 Outbox **writes** but has **no production dispatcher**.',
  '4. QR today points to InsightBooks `/verify/{id}`, not MRA validation URL.',
  '5. Existing EIS client is **REUSABLE_WITH_CHANGES / UNSAFE** for production fiscalization (credential model, invoice numbering, post-commit submit).',
  '',
  '## Document index',
  '',
  'See filenames in this directory. Start with FINAL_PHASE_2_REPORT.md and PHASE_3_HANDOVER.md.',
]);

doc(
  'PHASE_2_TASKS.md',
  'Phase 2 Task Tracker',
  [
    '| Task ID | Workstream | Status | Output | Completion |',
    '|---|---|---|---|---|',
    ...tasks.map((t, i) => {
      const id = `P2-${String(i + 1).padStart(3, '0')}`;
      const name = t.replace(/^[A-Z]+\s/, '');
      return `| ${id} | ${t} | COMPLETE (audit draft) | See matching *.md | ${D} |`;
    }),
    '',
    'Evidence quality: code + schema inspection. Production DB sampling for counts: **not run** (no live production query in this phase).',
  ]
);

doc('REPOSITORY_AND_RUNTIME_INVENTORY.md', 'Repository and Runtime Inventory', [
  '## Structure',
  '',
  '- Single Next.js application (not a monorepo of multiple deployables).',
  '- `app/` App Router pages + API routes; `lib/` domain services; `prisma/` schema/migrations; `components/`; `test/` vitest.',
  '',
  '## Versions (from package.json)',
  '',
  '| Component | Version |',
  '|---|---|',
  '| next | ^16.2.9 |',
  '| react / react-dom | ^19.0.0 |',
  '| @prisma/client | ^6.5.0 |',
  '| next-auth | ^4.24.14 |',
  '| pg | ^8.14.1 |',
  '| vitest | (dev) |',
  '| typescript | (dev) |',
  '| zod | present |',
  '| qrcode.react | ^4.2.0 |',
  '| jspdf / puppeteer / nodemailer | present |',
  '| decimal library | **not present** (money often Float/number) |',
  '',
  '## Runtime constraints for EIS',
  '',
  '| Constraint | Evidence | EIS consequence |',
  '|---|---|---|',
  '| Next.js API routes + Vercel cron | vercel.json | Long-running workers not native; need durable job runner |',
  '| Docker/PM2 also documented | Dockerfile, docs | Multi-replica fiscal sequencing risk |',
  '| Browser offline queue | lib/offlineSalesQueue.js | Cannot hold MRA secretKey |',
  '| No Bull/Redis product queue | inventory | Need durable EIS worker |',
  '| Drizzle also in deps | package.json | Prisma is primary ORM |',
]);

doc('EIS_RELEVANT_ROUTE_INVENTORY.md', 'EIS-Relevant Route Inventory', [
  '| Route | Module | Auth | EIS relevance | Risk |',
  '|---|---|---|---|---|',
  '| POST /api/sales | POS finalize | session + perms | **Primary POS fiscal candidate**; post-commit eisService | Duplicate sales; best-effort EIS |',
  '| POST /api/invoices | Invoice issue | session | Non-Draft posts + EIS submit | Draft vs issued; payment ≠ new EIS |',
  '| POST /api/sales/[id]/void|refund | Corrections | sales.void/refund | Must map to MRA void/credit later | No EIS call today |',
  '| POST /api/invoices/void|refund | Corrections | | Same | No EIS call |',
  '| POST /api/credit-notes | Credit notes | | Future credit/debit note | Partial GL |',
  '| /api/eis/* | Legacy EIS | session + hasEISAccess | Replace/rewrite | Unsafe secrets/settings |',
  '| /api/cron/eis-sync | Cron | CRON_SECRET | Status sync | Not outbox |',
  '| /api/admin/eis-subscriptions* | Entitlement | admin | Keep with fixes | hasEISAccess bug |',
  '| GET /api/sales/[id]/receipt | Receipt PDF | | Receipt boundary | |',
  '| /api/invoices/[id]/download/pdf|send | PDF/email | | After fiscal QR | Historical PDF immutability |',
  '| /verify/[id] | Public verify | none | **Not MRA QR** | Mislabel risk |',
  '| /pos, /eis/* | UI | page access | Operator surfaces | |',
  '| Accounting V2 APIs | Journals/posting | session + businessId guard | Snapshot after posting | |',
]);

doc('EIS_RELEVANT_DATABASE_MODEL_INVENTORY.md', 'EIS-Relevant Database Model Inventory', [
  '## Tenancy',
  '',
  '| Model | Tenant key | Notes | EIS suitability |',
  '|---|---|---|---|',
  '| Tenant | id | = Business; tpin, eisEnabled | Config root |',
  '| Branch | tenantId | Multi-branch | Map to siteId |',
  '| TenantMembership | tenantId | Multi-business users | |',
  '| InventoryLocation | tenantId | Local warehouse analog | Not MRA VW |',
  '',
  '## Sales',
  '',
  '| Model | Notes | Phase 3 |',
  '|---|---|---|',
  '| Sale / SaleItem / SaleItemTax | POS; paymentMethod string; Float money | Snapshot source |',
  '| Invoice / lines | status Draft vs issued | Snapshot source |',
  '| Payment / PaymentAllocation | Split pay | Map paymentMethod |',
  '| CreditNote / InvoiceRefund | Corrections | MRA credit/void |',
  '',
  '## Accounting V2',
  '',
  '| Model | Notes |',
  '|---|---|',
  '| AcctV2EventRegistry | Unique idempotencyKey |',
  '| AcctV2Journal / lines | Source links |',
  '| AcctV2Outbox | Written; **not drained** |',
  '| AcctV2FeatureFlag | Not used for EIS |',
  '',
  '## Existing EIS',
  '',
  '| Model | Suitability |',
  '|---|---|',
  '| EISInvoice | REUSABLE_WITH_CHANGES — status model incomplete vs Phase 1 |',
  '| EISConfiguration | UNSAFE — OAuth-era fields; settings JSON may hold plaintext token |',
  '| EISSubmissionLog | REUSE — redact secrets |',
  '| EISUsage | REUSE for quota telemetry |',
  '',
  'Money fields often `Float` — Phase 3 should prefer decimal types for fiscal snapshots.',
]);

doc('MULTI_TENANT_AND_BUSINESS_HIERARCHY.md', 'Multi-Tenant and Business Hierarchy', [
  '## Answers',
  '',
  '| # | Question | Answer | Evidence |',
  '|---|---|---|---|',
  '| 1 | Tenant = Business? | **Yes** | No Business model; accountingContext aliases |',
  '| 2 | Multiple Businesses per tenant? | **No** | One Tenant row |',
  '| 3 | Multiple branches? | **Yes** | Branch.tenantId |',
  '| 4 | Shared warehouses? | Local InventoryLocation tenant-scoped; no Warehouse model |',
  '| 5–6 | Multi-business users / switch? | **Yes** via TenantMembership + /api/tenant/switch |',
  '| 7–8 | Context storage / server verify? | Session cookie tenantId; APIs filter by user.tenantId; V2 blocks foreign businessId |',
  '| 9–11 | Jobs/exports/cache? | Crons use CRON_SECRET; Business Context in workers uneven — GAP |',
  '| 12–13 | System admin / impersonation? | Admin panel separate; SecV2 may have impersonation fields — review |',
  '| 14 | TIN location? | Tenant.tpin |',
  '| 15–17 | Entitlement / ops / credentials? | Subscription + eisEnabled; EISConfiguration per tenant |',
  '| 18 | Multiple TINs per tenant? | Not modeled |',
  '| 19–20 | Multiple sites / tills? | Branches exist; terminal model incomplete |',
  '',
  '## Cross-tenant risks',
  '',
  '- Tenant switch unsigned session downgrade (**BLOCKER**).',
  '- EIS settings JSON secrets.',
  '- Cache keys must always include tenantId.',
]);

doc('EIS_ENTITLEMENT_READINESS.md', 'EIS Entitlement Readiness', [
  '## Existing',
  '',
  '- Plans: `eis-monthly`, `eis-yearly` (`lib/subscriptionConfig.js`)',
  '- `hasEISAccess`, `canSubmitEISInvoice`, `Tenant.eisEnabled`',
  '- Admin `/api/admin/eis-subscriptions`',
  '',
  '## Target formula (Phase 1/3)',
  '',
  '`Platform AND Admin entitlement AND Tenant ops AND Config complete AND Active terminal AND Config fresh AND Not blocked`',
  '',
  '## Gaps',
  '',
  '| Gap | Severity |',
  '|---|---|',
  '| hasEISAccess may pick non-EIS plan first | BLOCKER |',
  '| No platform kill-switch distinct from subscription | HIGH |',
  '| No dedicated eis.* permissions | HIGH |',
  '| SHOW_EIS_SUBSCRIPTION_UI = false | LOW |',
  '| Terminal/block/config completeness not in entitlement | HIGH |',
]);

doc('BUSINESS_CONTEXT_ENFORCEMENT_AUDIT.md', 'Business Context Enforcement Audit', [
  '- Accounting V2: `assertSameBusiness` / session tenant hard-block — **strong**.',
  '- EIS APIs: filter by `user.tenantId` — **adequate if session trusted**.',
  '- Sales/Invoices: tenant-scoped creates — **standard**.',
  '- Weakness: unsigned session after tenant switch; AUTHZ_AUDIT_MODE bypass for requirePermission (EIS routes often skip requirePermission).',
  '- Jobs: cron eis-sync iterates tenants — must keep tenant isolation in each iteration.',
  '',
  'Cross-Business IDOR: treat any missing tenantId where as CRITICAL if found in Phase 3 security tests.',
]);

// POS / Invoice core
doc('POS_ARCHITECTURE_AUDIT.md', 'POS Architecture Audit', [
  '## Flow (evidence)',
  '',
  '`app/pos/page.js` → `createSale` → `POST /api/sales` → `$transaction`: Sale+items → inventory → payments → FIFO COGS → journals/tax → audit → **commit** → `eisService.submitInvoice` fire-and-forget → receipt modal.',
  '',
  '## Insertion points (recommendation)',
  '',
  '| Concern | Safe point |',
  '|---|---|',
  '| EIS eligibility | End of tx before commit, after totals finalized |',
  '| Immutable snapshot + Outbox | **Same DB transaction** as sale finalize |',
  '| MRA transmission | **After** commit, durable worker |',
  '| Receipt QR | After ACCEPTED (or certified offline) — pending state until then |',
  '',
  '## Controls',
  '',
  '| Control | Current |',
  '|---|---|',
  '| Double-click | UI inFlight only |',
  '| Server idempotency | **Missing** |',
  '| Offline | IndexedDB queue; local signature ≠ MRA |',
  '| Browser secrets | Must never hold secretKey |',
]);

doc('SALES_INVOICE_ARCHITECTURE_AUDIT.md', 'Sales Invoice Architecture Audit', [
  '- Draft: no inventory/GL/EIS.',
  '- Non-Draft create: inventory + journals + tax in tx; EIS after commit.',
  '- PDF/email: separate routes after issue.',
  '- Payment after issue must **not** create new EIS sale.',
  '- Safe fiscalization event: **Invoice issued/posted (non-Draft) after accounting success**, not Draft, not payment.',
  '- Status casing inconsistency (Draft vs draft) — integrity risk.',
]);

doc('POS_AND_INVOICE_EVENT_COMPARISON.md', 'POS and Invoice Event Comparison', [
  '| Dimension | POS | Invoice |',
  '|---|---|---|',
  '| Finalization | completed sale | non-Draft issue |',
  '| Accounting | INVENTORY_SOLD / Sale | INVOICE_POSTED / Invoice |',
  '| Inventory | type sale | type invoice |',
  '| Payment | Usually at sale | Often later |',
  '| Offline | Browser queue | Typically online |',
  '| Current EIS hook | post-commit | post-commit |',
  '',
  '## Recommendation',
  '',
  'Canonical internal event: **`SALE_FISCALIZATION_ELIGIBLE`** emitted by adapters from:',
  '- `POS_SALE_FINALIZED` (status completed)',
  '- `SALES_INVOICE_ISSUED` (non-Draft after posting)',
  '',
  'Exclude: drafts, payments, pure reprints.',
]);

doc('CUSTOMER_AND_B2B_READINESS.md', 'Customer and B2B Readiness', [
  'Customer model holds name/contacts; TIN fields vary — Tenant.tpin for seller. Buyer TIN on invoice/sale not fully standardized for MRA B2B.',
  '',
  '| Need | Status |',
  '|---|---|',
  '| Buyer TIN field | Partial / GAP |',
  '| Protected TIN / auth code transient handling | NOT_AVAILABLE |',
  '| Snapshot isolation from later customer edits | Required in Phase 3 |',
]);

doc('PRODUCT_AND_SERVICE_MODEL_AUDIT.md', 'Product and Service Model Audit', [
  '- Primary stock entity: `Product` with stockLevel; services often products with flags or separate handling.',
  '- Units: flexible unit conversion on sales.',
  '- Tax assignment: item tax types / SaleItemTax.',
  '- MRA mapping: productCode / UNSPSC via EIS utilities — **not versioned local mapping table**.',
  '- Bundles/composites: risk if opaque lines — GAP for MRA line expansion.',
]);

doc('TAX_ENGINE_AUDIT.md', 'Tax Engine Audit', [
  '- Catalog: `lib/malawiTaxCatalog.js` (standard VAT 17.5 example; `mraStandardVatTaxRateId` → `A`).',
  '- Sale/invoice compute tax then `autoPostTaxEntry`.',
  '- Relief supply can zero VAT on sales path.',
  '- EIS payload taxRateId heuristic A/B/E in eisService — **not config-versioned MRA rates**.',
  '- Rounding: Float-based — **BLOCKER risk** vs Phase 1 decimal contract.',
  '- Levy support: incomplete vs MRA levyBreakDown.',
  '- VAT5: API route exists; not full POS integration.',
]);

doc('PAYMENT_METHOD_AUDIT.md', 'Payment Method Audit', [
  'Local keys (`lib/paymentMethods.js`): bank_transfer, airtel_money, mpamba, cash, paychangu (+ credit aliases in GL map).',
  '',
  'Free-string `Sale.paymentMethod`. Split via PaymentAllocation.',
  '',
  'MRA enum unknown (Phase 1) — mapping table required; invoice EIS path hardcodes Bank Transfer (**defect**).',
]);

doc('INVENTORY_ARCHITECTURE_AUDIT.md', 'Inventory Architecture Audit', [
  '- Local stock authoritative via Product.stockLevel + InventoryTransaction.',
  '- FIFO COGS on sale (`consumeFifoForSale`).',
  '- MRA Virtual Warehouse is **separate compliance view** — must not mutate local stock from MRA sync without approved Stock Movement.',
  '- Initial Inventory upload ≠ Opening Stock GL.',
]);

doc('SALES_ACCOUNTING_TRACEABILITY.md', 'Sales Accounting Traceability', [
  'POS completed → createSaleJournalEntries → posSaleAdapter → cutover posting → Journal with source Sale/`${id}-revenue`.',
  '',
  'Invoice non-Draft → invoiceAdapter → Invoice/id/INVOICE_POSTED.',
  '',
  'Risk: dual paths (cutover vs legacy postGlEntry fallback) — verify one authoritative journal per sale.',
]);

doc('ACCOUNTING_POSTING_ENGINE_AUDIT.md', 'Accounting Posting Engine Audit', [
  '`lib/accountingV2/engine/postingEngine.js`: registry claim → journal → outbox enqueue; idempotency key `ACCOUNTING:{businessId}:{module}:{type}:{id}:{event}:{version}`.',
  '',
  '**Preferred EIS boundary:** extend finalize tx to also write EIS snapshot + EIS outbox **after** posting success, still before commit; transmit async.',
  '',
  'Current EIS submit is outside this engine — **must change**.',
]);

doc('JOURNAL_AND_SOURCE_LINK_AUDIT.md', 'Journal and Source Link Audit', [
  'V2 journals link sourceType/sourceId/event. Trace Sale→Journal exists for cutover path.',
  '',
  'Future: Sale → Journal → EisSnapshot → Transmission → Response → QR.',
]);

doc('ACCOUNTING_PERIOD_AND_DATE_AUDIT.md', 'Accounting Period and Date Audit', [
  'Period resolution via accounting period services; closed-period checks on voids/refunds.',
  '',
  'Dates: sale/invoice date vs server now vs fiscal Julian — **must not assume identical**. Timezone CAT engineering default; Phase 1 RC.',
]);

doc('TRANSACTIONAL_OUTBOX_AUDIT.md', 'Transactional Outbox Audit', [
  '| Aspect | Finding |',
  '|---|---|',
  '| Entity | AcctV2Outbox |',
  '| Atomic with posting | Yes (enqueue in posting tx) |',
  '| Dispatcher | **NOT_AVAILABLE in production** |',
  '| EIS outbox | **NOT_AVAILABLE** (fire-and-forget) |',
  '',
  'Phase 3: either extend AcctV2Outbox with EIS event types + dispatcher, or dedicated EisOutbox with same atomic pattern.',
]);

doc('QUEUE_AND_WORKER_AUDIT.md', 'Queue and Worker Audit', [
  '- No Bull/Redis job queue as product infrastructure.',
  '- Vercel crons: eis-sync every 30m, others.',
  '- Offline sales queue is browser IndexedDB.',
  '',
  'Classification: **CLOUD_PARTIAL / REQUIRES durable worker** for EIS transmission, per-terminal ordering, backpressure.',
]);

doc('IDEMPOTENCY_AUDIT.md', 'Idempotency Audit', [
  '| Path | Protection |',
  '|---|---|',
  '| Accounting V2 | DB unique idempotencyKey |',
  '| POS sale create | UI only |',
  '| Invoice create | Numbering uniqueness, not request id |',
  '| EIS submit | Weak / retries may duplicate |',
  '| Offline sync | Can double-post |',
  '',
  'Phase 3 needs unique (tenantId, fiscalNumber), (tenantId, sourceType, sourceId, version), transmission attempt keys.',
]);

doc('CONCURRENCY_AUDIT.md', 'Concurrency Audit', [
  'Risks: double POS submit; multi-replica fiscal sequence; config change mid-submit; mapping change mid-submit; period close race.',
  '',
  'Need: per-terminal sequence locks (advisory/row), unique constraints, optimistic version on snapshot — **not** global lock.',
]);

doc('RETRY_AND_FAILURE_MODE_AUDIT.md', 'Retry and Failure Mode Audit', [
  'EIS today: log failure, keep sale — good for accounting independence; bad for durable retry (no outbox).',
  '',
  'MRA writes need reconcile-before-retry (Phase 1). Reuse Accounting V2 registry pattern; do not blind-retry submit.',
]);

doc('RECEIPT_GENERATION_AUDIT.md', 'Receipt Generation Audit', [
  '- POS modal + PrintableReceipt + PDF route.',
  '- Optional eisInvoiceNumber display.',
  '- Must support PENDING_EIS → VALIDATED without claiming validation early.',
]);

doc('QR_CODE_READINESS_AUDIT.md', 'QR Code Readiness Audit', [
  '- Library: qrcode.react (client SVG).',
  '- Content today: `/verify/{localId}` — **not MRA**.',
  '- Persist vs regenerate: mostly regenerate.',
  '- Phase 3: encode MRA validationURL; checksum; reprint immutability.',
]);

doc('PDF_AND_EMAIL_INVOICE_AUDIT.md', 'PDF and Email Invoice Audit', [
  'jspdf/puppeteer PDF; nodemailer send. Separate from issue tx. Historical PDFs must not silently rewrite fiscal fields after acceptance — versioned attachments.',
]);

doc('AUTHENTICATION_AUDIT.md', 'Authentication Audit', [
  'Login + HMAC session v2; legacy unsigned possible. Tenant switch drops signature (**BLOCKER**).',
  '',
  'Step-up needed for: entitlement, TAC entry, activation, prod mode, offline enable, mapping changes, credential rotate.',
]);

doc('AUTHORIZATION_AND_PERMISSION_AUDIT.md', 'Authorization and Permission Audit', [
  'RBAC via hasPermission; EIS pages use reports/invoices/inventory views — **no eis.* permissions**.',
  '',
  'Server enforcement incomplete for EIS-specific actions. Hidden UI ≠ authz.',
]);

doc('APPROVAL_WORKFLOW_AUDIT.md', 'Approval Workflow Audit', [
  'SecV2 approval engine exists but **not wired to EIS**.',
  '',
  'Recommend Phase 3 approvals for production activation, mapping changes, manual overrides.',
]);

doc('SECRET_MANAGEMENT_AUDIT.md', 'Secret Management Audit', [
  '| Item | Status |',
  '|---|---|',
  '| encrypt() AES-256-CBC | REUSE with GCM upgrade later |',
  '| EISConfiguration secrets | Encrypted fields |',
  '| settings.token/JWT | **Plaintext BLOCKER** |',
  '| TenantSettings.eisApi* | Orphan unused |',
  '| docker-compose committed secrets | **BLOCKER** ops |',
  '| Frontend exposure | Must remain never |',
]);

doc('ENCRYPTION_READINESS_AUDIT.md', 'Encryption Readiness Audit', [
  'AES-256-CBC + ENCRYPTION_KEY. No auth tag. Multi-terminal key versioning incomplete. Sandbox/prod separation via EIS_ENVIRONMENT + separate configs required.',
]);

doc('AUDIT_TRAIL_READINESS.md', 'Audit Trail Readiness', [
  'AuditLog + SecV2AuditEvent + EISSubmissionLog. Can support EIS actions if secrets redacted and correlation IDs added.',
]);

doc('LOGGING_AND_REDACTION_AUDIT.md', 'Logging and Redaction Audit', [
  'redactForAudit exists. Must apply to EIS logs/payloads. Never log JWT, secretKey, TAC, buyer auth codes.',
]);

doc('OBSERVABILITY_AND_ALERTING_AUDIT.md', 'Observability and Alerting Audit', [
  'Limited product metrics for EIS. Need: pending depth, oldest age, reject rate, unknown outcomes, block flags, token expiry.',
]);

doc('API_CLIENT_AND_INTEGRATION_ARCHITECTURE_AUDIT.md', 'API Client Architecture Audit', [
  'eisService uses fetch with timeout; Bearer always. Must become dedicated MraEisClient (server-only) with verified Phase 1 contract — not browser.',
]);

doc('WEBHOOK_AUDIT.md', 'Webhook Audit', [
  'No MRA webhook in Phase 1. Do not invent. Existing webhook patterns (if any) reusable for other integrations only.',
]);

doc('CACHE_AUDIT.md', 'Cache Audit', [
  'No shared Redis product cache required for EIS secrets. Any future enablement cache must be tenant-keyed; never cache decrypted secrets.',
]);

doc('FILE_AND_DOCUMENT_STORAGE_AUDIT.md', 'File Storage Audit', [
  'PDF/tmp patterns for invoices. EIS evidence files must be tenant-scoped, non-public, authorized access.',
]);

doc('MULTI_CURRENCY_AUDIT.md', 'Multi Currency Audit', [
  'Phase 1 FAQ: EIS current version **no multi-currency** — convert to MWK. Local multi-currency if present must not invent MRA FX rules.',
]);

doc('EXISTING_EFD_AND_MRA_IMPLEMENTATION_AUDIT.md', 'Existing EFD and MRA Implementation Audit', [
  '| Component | Classification |',
  '|---|---|',
  '| lib/eisConfig.js | REUSABLE_WITH_CHANGES |',
  '| lib/eisService.js | UNSAFE for prod fiscal (rewrite) |',
  '| app/api/eis/* | REUSABLE_WITH_CHANGES / UI bridge |',
  '| Prisma EIS* | REUSABLE_WITH_CHANGES |',
  '| Post-commit submit in sales/invoices | DEPRECATED pattern |',
  '| offlineSalesQueue MRA thresholds | LEGACY / do not equate to MRA offline |',
  '| EFD runtime | NOT_AVAILABLE |',
  '| docs/MRA_EIS_Documentation.md | SUPERSEDED |',
]);

doc('EXISTING_EIS_RELEVANT_DATA_ASSESSMENT.md', 'Existing EIS Relevant Data Assessment', [
  'Production counts **not queried** in Phase 2 (no live prod sampling).',
  '',
  'Classification framework for historical sales:',
  'DRAFT · FINALIZED · POSTED · CANCELLED · PRE_EIS · POSSIBLY_ALREADY_FISCALIZED · REQUIRES_MRA_GUIDANCE · MISSING_ACCOUNTING · DUPLICATE_RISK',
  '',
  'Do not submit historical sales. Phase 3 migration plan required after sampling with approved access.',
]);

doc('EIS_DATA_INTEGRITY_BASELINE.md', 'EIS Data Integrity Baseline', [
  'Scripts available: `validate:data-integrity`, forensic accounting audits — **not executed against production in this phase**.',
  '',
  'Known code-level defects to register: sale idempotency gap; invoice status casing; EIS entitlement plan selection; Float money; EIS hardcoded payment on invoice submit.',
]);

doc('SALES_TOTAL_AND_TAX_CONSISTENCY_AUDIT.md', 'Sales Total and Tax Consistency Audit', [
  'Multiple calculation sites: POS client, sales API, invoice calculations, journals, EIS payload builder, reports.',
  '',
  'Phase 3 rule: **one fiscal snapshot from server-finalized totals** — no sixth independent calc in client for MRA.',
]);

doc('LOCAL_TRANSACTION_IMMUTABILITY_AUDIT.md', 'Local Transaction Immutability Audit', [
  'Completed sales / issued invoices should not silently edit fiscal fields; voids/refunds/credit notes are correction paths.',
  '',
  'EIS snapshot must freeze buyer/tax/lines at transmit time.',
]);

doc('ERROR_HANDLING_AUDIT.md', 'Error Handling Audit', [
  'Today: EIS failure does not roll back sale — correct separation.',
  '',
  'UI must show Accounting POSTED vs EIS REJECTED distinctly.',
]);

doc('DEPLOYMENT_ARCHITECTURE_AUDIT.md', 'Deployment Architecture Audit', [
  'Next standalone Docker; compose; Vercel crons; PM2 docs. Multi-replica ⇒ fiscal sequencing must be DB-authoritative.',
  '',
  'Do not bind terminal identity to container hostname.',
]);

doc('STABLE_TERMINAL_ENVIRONMENT_IDENTITY_AUDIT.md', 'Stable Terminal Environment Identity Audit', [
  'Cloud SaaS cannot use ephemeral MAC. Phase 1 Q-017–019 blocking.',
  '',
  'Candidates for MRA discussion: per-tenant terminal record with stable UUID; branch till identity; desktop agent — **do not fake MAC**.',
]);

doc('OFFLINE_READINESS_AUDIT.md', 'Offline Readiness Audit', [
  'Classification: **PARTIALLY_READY / CLOUD_ONLY_NOT_OFFLINE_READY** for certified MRA offline.',
  '',
  'Browser IndexedDB ≠ certified offline (no secure secret store, no MRA offlineSignature). Desktop/electron printer lib present but not full offline fiscal agent.',
]);

doc('TESTING_ARCHITECTURE_AUDIT.md', 'Testing Architecture Audit', [
  'Vitest unit/integration; qa invariants; accountingV2 tests. Can add OFFLINE_FIXTURE crypto KATs. Need mock MRA server for Phase 3 sandbox tests.',
]);

console.log('phase2-part1', written.length);
fs.writeFileSync(path.join(ROOT, '_written.json'), JSON.stringify(written, null, 2));
module.exports = { doc, written, D };
