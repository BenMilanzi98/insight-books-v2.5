/**
 * Phase 1 pack — remaining research documents
 */
const fs = require('fs');
const path = require('path');
const { doc, written, conf, ACCESS, index, prodCount, sandOnly } = require('./_gen-phase1-pack.js');

doc('CURRENT_EIS_STATUS.md', 'Current EIS Operational Status', [
  '## Finding summary',
  '',
  '| Topic | Statement | Confidence | Source | Verified | Recheck |',
  '|---|---|---|---|---|---|',
  `| EIS operational | Production EIS API + Taxpayer Portal respond publicly (HTTP 200) | ${conf.VO} | SRC-API-*, SRC-PORTAL-* | ${ACCESS} | Before each phase |`,
  `| Legal transition deadline | MRA Public Notice: transition period ends **31 January 2026**; VAT (EIS) Regulations 2025 cited as published **9 January 2026** | ${conf.VO} (notice text) | SRC-NOTICE-TRANS | ${ACCESS} | After legal updates |`,
  `| EFD → EIS | Notice: use EIS in place of EFDs following VAT (Amendment) Act 2024 Part II | ${conf.VO} (as stated by MRA) | SRC-NOTICE-TRANS | ${ACCESS} | Counsel |`,
  `| Taxpayer duties (notice) | Register on EIS portal; upload stock; integrate systems; issue tax invoices & maintain stock via EIS | ${conf.VO} | SRC-NOTICE-TRANS | ${ACCESS} | — |`,
  `| Multi-currency | FAQ: current version does **not** support multi-currency; convert to MWK | ${conf.VO} | SRC-PORTAL-FAQ | ${ACCESS} | — |`,
  `| Vendor certification | FAQ + Guide: MRA certifies integrated POS vendors; productID/version | ${conf.VM} | FAQ + certification guide | ${ACCESS} | — |`,
  `| Sandbox | ` + '`https://dev-eis-api.mra.mw`' + ` + ` + '`https://dev-eis-portal.mra.mw`' + ` available | ${conf.VO} | Probes | ${ACCESS} | — |`,
  `| Production API | ` + '`https://eis-api.mra.mw`' + ` | ${conf.VO} | Probes | ${ACCESS} | — |`,
  `| Support | FAQ: call 672; email callcentre@mra.mw | ${conf.VO} | SRC-PORTAL-FAQ | ${ACCESS} | — |`,
  `| Certified vendor list | Not located as a public downloadable list in this research pass | ${conf.RC} | — | ${ACCESS} | MRA |`,
  '',
  '## Interpretation vs official fact',
  '',
  '- **Official fact (notice):** transition deadline and migration steps as published by MRA.',
  '- **Not legal advice:** whether a specific InsightBooks tenant is obligated — counsel/tax advisor.',
  '- **Sandbox results:** none executed with credentials in Phase 1.',
]);

doc('MRA_EIS_LEGAL_AND_REGULATORY_RESEARCH.md', 'Legal and Regulatory Research', [
  '## Disclaimer',
  '',
  'This document identifies sources and **does not constitute legal advice**. Classifications mark where counsel/tax professional review is required.',
  '',
  '## Instruments identified (via MRA Public Notice)',
  '',
  '| Instrument | How identified | Status in pack |',
  '|---|---|---|',
  '| Value Added Tax (Amendment) Act, 2024 — Part II establishing Electronic Tax Invoicing System | Cited in MRA Public Notice | REQUIRES_CONFIRMATION — obtain gazette |',
  '| Value Added Tax (Electronic Invoicing System) Regulations, 2025 — published 9 January 2026 (per notice) | Cited in MRA Public Notice | REQUIRES_CONFIRMATION — obtain gazette |',
  '| Prior Public Notice 31 July 2025 (migration from 2 August 2025) | Cited in transition notice | Locate archive |',
  '',
  '## Topics',
  '',
  '| Topic | What we can document | Class |',
  '|---|---|---|',
  '| Definition of EIS | FAQ: digital platform for tax invoices + stock records; Notice: software-based electronic tax invoicing & stock | Clear operational guidance from MRA publications |',
  '| Persons required | Notice addresses taxpayers generally for migration; exact legal scope needs Act/Regs | Requires legal counsel |',
  '| Effective / transition dates | Migration from 2 Aug 2025; transition ends 31 Jan 2026 (notice) | Clear in notice; counsel for binding effect |',
  '| Stock-record obligations | Notice + FAQ: maintain stock in EIS | Operational + legal review |',
  '| Tax invoice issuance | Notice: issue tax invoices through EIS | Operational + legal review |',
  '| Third-party software | Guide: non-MRA POS must be certified; productID/version | Technical + legal |',
  '| Penalties / fraud / tampering | Not extracted from primary Act text in this pass | Requires counsel + gazette |',
  '| Retention | Not fully specified in API docs | Requires counsel + regs |',
  '| Exemptions / appeals | Not located | Requires counsel |',
  '',
  '## Technical implementation implications (engineering conclusions)',
  '',
  '1. InsightBooks must support certified API integration path, not claim to replace legal EIS portal duties.',
  '2. Stock fiscalization and local inventory are related but legally distinct — do not conflate Opening Stock accounting with MRA Virtual Warehouse.',
  '3. Certification before production fiscalization is a vendor obligation per guide.',
]);

doc('LEGAL_QUESTIONS_FOR_COUNSEL.md', 'Legal Questions for Counsel', [
  '## Questions',
  '',
  '| QID | Question | Why | Class |',
  '|---|---|---|---|',
  '| LQ-001 | Which taxpayers are legally required to use EIS after 31 Jan 2026? | Scope of InsightBooks enablement | Legal counsel |',
  '| LQ-002 | Obtain certified copies of VAT (Amendment) Act 2024 Part II and VAT (EIS) Regulations 2025 | Primary law | Legal counsel |',
  '| LQ-003 | Do EFD receipts remain valid for any transition/grace cases after the deadline? | Support messaging | Legal + MRA |',
  '| LQ-004 | Retention periods for electronic tax invoices, QR validation data, and API logs | Data retention design | Legal + tax |',
  '| LQ-005 | Liability allocation: software vendor vs taxpayer for failed transmission / offline misuse | Contracts | Legal |',
  '| LQ-006 | Cross-border / export treatment under EIS | Sales flags isExport | Tax advisor |',
  '| LQ-007 | Personal data obligations for buyer TIN/name on receipts | Privacy | Legal |',
  '| LQ-008 | Whether SaaS multi-tenant hosting creates additional licensing obligations | Certification | Legal + MRA |',
]);

doc('MRA_EIS_ECOSYSTEM.md', 'EIS Ecosystem and Actors', [
  '| Actor | Responsibilities | Data owned | Approvals | Security boundary | Evidence |',
  '|---|---|---|---|---|---|',
  '| Malawi Revenue Authority | Operate EIS, certify vendors, enforce tax rules | Fiscal registry, configs | Certification, stock approvals | MRA systems | Notice, FAQ, Guide |',
  '| EIS Taxpayer Portal | Onboarding, inventory, services, reporting | Taxpayer master, stock | Portal workflows | Taxpayer auth | Portal FAQ |',
  '| EIS Back Office | Approvals, validation of receipts | Officer workflows | Informal purchase, mappings | MRA staff | FAQ |',
  '| Taxpayer / Business | Register, upload stock, issue invoices | Business ops data | Internal | Tenant boundary | Notice |',
  '| Branch / Site | Trading location | siteId, stock at site | — | Mapped to terminal site | Config / FAQ |',
  '| Virtual Warehouse | Central stock before site transfer | Warehouse inventory | Transfers | Portal/API | FAQ + stock API |',
  '| Product / Service | Sellable items | Codes, tax, qty | Mapping approval | MRA catalogue | Pre-integration guide |',
  '| Terminal | Fiscal device/software instance | terminalId, JWT, secretKey | Activation | Highest secret boundary | Activation API |',
  '| Third-party vendor | Certified POS/accounting software | productID/version | Certification | Vendor org | Certification guide |',
  '| Cashier / Admin | Operate POS | Operational | Role-based | Tenant RBAC | FAQ POS |',
  '| Buyer / TIN holder | Receive invoice; may need auth code | Buyer TIN | Auth codes | Sensitive | B2B guide/utilities |',
  '| Software certification team | Inspect & certify | Product registry | Issue productID | MRA | Certification process |',
  '| Support | 672 / callcentre@mra.mw | Tickets | — | — | FAQ |',
]);

doc('TAXPAYER_ONBOARDING_RESEARCH.md', 'Taxpayer Onboarding Research', [
  '## Sources',
  '',
  '- Developer Pre-Integration Guide (sandbox portal `dev-eis-portal.mra.mw`)',
  '- EIS Portal FAQ',
  '- MRA Transition Public Notice',
  '',
  '## Documented steps (sandbox / pre-integration)',
  '',
  '1. Register on Taxpayers Portal (sandbox for developers).',
  '2. Business registration & verification; TIN/phone/email match Msonkho Online.',
  '3. Select business type: **Product-based** or **Service-based**.',
  '4. Inventory: products (upload/approval) vs services (register under Inventory Management > Services).',
  '5. Branch/site setup; warehouse → branch transfers (FAQ).',
  '6. Terminal application → TAC issuance (portal process).',
  '7. Activate software with TAC via API; confirm activation.',
  '8. Sync approved products/services to POS.',
  '9. First test transactions in sandbox; later certification & production.',
  '',
  '## Differences',
  '',
  '| Dimension | Notes | Confidence |',
  '|---|---|---|',
  '| Product vs service | Services registered on portal; products via inventory upload/mapping; sync via get-terminal-site-products | Official guide |',
  '| Mixed businesses | Not fully specified — ${conf.RC} |',
  '| VAT vs non-VAT | taxpayerConfiguration.isVATRegistered in activation config | OpenAPI |',
  '| Single vs multi-site | terminalSite / siteId; FAQ branch transfers | Official |',
  '',
  'Do **not** assume identical workflows for all taxpayers.',
]);

doc('INVENTORY_AND_SERVICE_WORKFLOW_RESEARCH.md', 'Inventory and Service Workflow Research', [
  '## Channel classification',
  '',
  '| Operation | Portal | API | Back Office | InsightBooks role |',
  '|---|---|---|---|---|',
  '| Virtual Warehouse view | Yes (FAQ) | GET warehouse-inventory | — | Sync/reconcile display; not accounting authority |',
  '| Initial Inventory upload | Yes | POST taxpayer-initial-inventory-upload (≤50/batch) | Approval | Optional assist; separate from Opening Stock GL |',
  '| Product mapping / UNSPSC | — | product-status | Mapping | Pre-sale readiness |',
  '| Site products/services sync | — | get-terminal-site-products (**POST** in OpenAPI; guide sample GET) | — | Sync catalogue |',
  '| Informal purchases | Yes | submit-informal-purchase | Approval required | Integration later |',
  '| Transfers W→Site / Site→Site | Yes | transfer-inventory | — | Bridge optional |',
  '| Adjustments | — | submit-adjustment + reasons | — | Bridge optional |',
  '| Raw materials / conversion | — | raw-material APIs | — | Manufacturing taxpayers |',
  '| Services registration | Yes | via site products sync | Approval | Map local services |',
  '| Stock after sale | MRA central control (guide) | Sales side-effect | — | Local stock must reconcile carefully |',
  '| Void / credit impact on stock | Partially via cancel-receipt / credit-debit APIs | — | ${conf.RC} for full rules |',
  '',
  '**Engineering conclusion:** API is not sole inventory authority; portal + back office dominate many workflows.',
]);

doc('TERMINAL_CONCEPT_AND_LIFECYCLE.md', 'Terminal Concept and Lifecycle', [
  '## Official concepts (from API/guide)',
  '',
  '| Term | Meaning (documented) | Confidence |',
  '|---|---|---|',
  '| Terminal | Activated software/device instance with terminalId + credentials | VO |',
  '| terminalPosition | Integer used in fiscal numbering | VO (schema) |',
  '| terminalLabel | From terminalConfiguration | VO |',
  '| productID / productVersion | Certified software identity | VO |',
  '| MAC / platform | Activation environment fingerprint; MAC mandatory in guide prose, optional in OpenAPI | OI |',
  '| siteId | Trading site on invoices | VO |',
  '',
  '## SaaS / multi-tenant questions (BLOCKING clarifications)',
  '',
  'See MRA_CLARIFICATION_REGISTER Q-017…Q-020. InsightBooks must **not** invent MAC strategy or share terminal credentials across tenants.',
  '',
  '## Lifecycle (documented)',
  '',
  'Acquire terminal (portal) → TAC → activate-terminal → persist credentials/config → terminal-activated-confirmation (x-signature) → ACTIVE → operate → token renew → possible block/unblock → (reactivation unknown).',
]);

doc('SWAGGER_FORENSIC_REPORT.md', 'Swagger Forensic Report', [
  '## Inspection',
  '',
  `| Item | Result |`,
  `|---|---|`,
  `| Swagger UI | https://eis-api.mra.mw/swagger/index.html — HTTP 200 |`,
  `| OpenAPI JSON | /swagger/v1/swagger.json — HTTP 200, application/json |`,
  `| OpenAPI YAML | /swagger/v1/swagger.yaml — available (archived) |`,
  `| Title / version | EISAPI / 1.0 |`,
  `| openapi | 3.0.1 |`,
  `| servers | empty object/array in JSON |`,
  `| securitySchemes | **empty** |`,
  `| Paths (prod) | ${prodCount} |`,
  `| Paths (sandbox) | ${prodCount + sandOnly} (${sandOnly} sandbox-only) |`,
  `| Schemas (prod) | 94 |`,
  `| Custom header params | x-signature on confirmation only |`,
  '',
  '## Method',
  '',
  'Safe public GET of published OpenAPI. No auth bypass. Checksums in evidence/SOURCE_CHECKSUMS.md.',
  '',
  '## Conclusion',
  '',
  'OpenAPI document **is available** (contrary to failure case in prompt). Auth/hash rules incomplete in OpenAPI — guide required.',
]);

doc('OPENAPI_DISCOVERY_LOG.md', 'OpenAPI Discovery Log', [
  '| URL tested | Date/time | HTTP | Content-Type | Available | Auth required | Next |',
  '|---|---|---|---|---|---|---|',
  `| https://eis-api.mra.mw/swagger/v1/swagger.json | ${ACCESS} | 200 | application/json | Yes | No | Archived |`,
  `| https://eis-api.mra.mw/swagger/v1/swagger.yaml | ${ACCESS} | 200 | yaml | Yes | No | Archived |`,
  `| https://dev-eis-api.mra.mw/swagger/v1/swagger.json | ${ACCESS} | 200 | application/json | Yes | No | Archived |`,
  `| https://eis-api.mra.mw/swagger/index.html | ${ACCESS} | 200 | text/html | Yes | No | UI only |`,
  '',
  'Checksums: evidence/SOURCE_CHECKSUMS.md',
]);

// Endpoint matrix
const matrixRows = index.map((e) => {
  const auth =
    e.route.includes('activate-terminal') && !e.route.includes('confirmation')
      ? 'None'
      : 'JWT (guide)';
  const sig = e.route.includes('terminal-activated-confirmation') ? 'x-signature*' : 'No';
  return `| ${e.id} | ${e.summary || e.route} | ${e.tag} | 1.0 | ${e.env} | ${
    e.env === 'sandbox-only' ? 'https://dev-eis-api.mra.mw' : 'https://eis-api.mra.mw / dev twin'
  } | ${e.method} | ${e.route} | application/json | ${auth} | raw JWT samples / Bearer unclear | No (Unverified) | ${sig} | No OpenAPI msg-hash | See sheet | — | — | See schema | See sheet | Envelope | statusCode conflict | errors[] | UNKNOWN | UNKNOWN | — | — | Guide+OpenAPI | OpenAPI | NOT RUN | ${
    e.env === 'sandbox-only' ? conf.VO + ' (sandbox OAS)' : conf.VO
  } | See clarifications | Later |`;
});

doc('VERIFIED_ENDPOINT_MATRIX.md', 'Verified Endpoint Matrix', [
  `**Production endpoints:** ${prodCount} · **Sandbox-only:** ${sandOnly}`,
  '',
  'Legend: Message-hash = Unverified (not in OpenAPI). Sandbox result = NOT RUN in Phase 1.',
  '',
  '| Endpoint ID | Functional name | Category | API ver | Env | Base URL | Method | Route | Content-Type | Auth | Auth header format | Access-key | Signature | Message-hash | Request body | Query | Path | Required fields | Optional | Field limits | Formats | Response envelope | Success | Errors | Retry | Idempotency | Timeout recovery | Rate limit | Docs | Swagger | Sandbox | Confidence | Open Q | Impl phase |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...matrixRows,
  '',
  'Per-endpoint detail: [endpoints/](./endpoints/)',
]);

doc('endpoints/README.md', 'Endpoint Contract Sheets Index', [
  '| ID | Method | Route | File | Env |',
  '|---|---|---|---|---|',
  ...index.map((e) => `| ${e.id} | ${e.method} | ${e.route} | [${e.file}](./${e.file}) | ${e.env} |`),
]);

console.log('part2-docs', written.length);
fs.writeFileSync(path.join(__dirname, '_written.json'), JSON.stringify(written, null, 2));
module.exports = { doc, written, conf, ACCESS };
