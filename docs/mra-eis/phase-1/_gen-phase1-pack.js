/**
 * Phase 1 Research Pack generator — evidence-backed drafts from archived OpenAPI/guide
 * and public MRA sources. Does NOT call authenticated MRA APIs.
 * Access date: 2026-07-22
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'docs/mra-eis/phase-1';
const ACCESS = '2026-07-22';
const conf = {
  VO: 'VERIFIED_OFFICIAL',
  VM: 'VERIFIED_BY_MULTIPLE_OFFICIAL_SOURCES',
  VS: 'VERIFIED_BY_SANDBOX',
  OA: 'OFFICIAL_BUT_AMBIGUOUS',
  OI: 'OFFICIAL_BUT_INCONSISTENT',
  INF: 'INFERRED',
  RC: 'REQUIRES_MRA_CLARIFICATION',
  SUP: 'SUPERSEDED',
  NA: 'NOT_APPLICABLE',
};

function w(rel, body) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body.replace(/\n{3,}/g, '\n\n'));
  return rel;
}

const written = [];
function doc(rel, title, sections) {
  const body = [
    `# ${title}`,
    '',
    `**Phase:** 1 — Official Research & Contract Verification`,
    `**Access / research date:** ${ACCESS}`,
    `**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel`,
    '',
    ...sections.flatMap((s) => (Array.isArray(s) ? s : [s])),
    '',
    '---',
    `*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*`,
    '',
  ].join('\n');
  written.push(w(rel, body));
}

const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'endpoints/_index.json'), 'utf8'));
const prodCount = index.filter((e) => e.env === 'production').length;
const sandOnly = index.filter((e) => e.env === 'sandbox-only').length;

// ---------- README ----------
doc(
  'README.md',
  'Phase 1 — MRA EIS Research & Verified Contract Pack',
  [
    '## Status',
    '',
    '**Readiness decision:** see [PHASE_1_READINESS_DECISION.md](./PHASE_1_READINESS_DECISION.md) → **READY_WITH_OPEN_CLARIFICATIONS**',
    '',
    '## Purpose',
    '',
    'Authoritative external contract foundation for InsightBooks V2 MRA EIS integration. Research only — no activation, sales, fiscal numbering for use, or DB entities.',
    '',
    '## Parent pack (pre-Phase 1 snapshots)',
    '',
    'Also see `docs/mra-eis/` OpenAPI snapshots, guide crawl, and matrix docs `01`–`05`.',
    '',
    '## Document map',
    '',
    '| Area | Key files |',
    '|---|---|',
    '| Sources & status | OFFICIAL_SOURCE_INVENTORY, CURRENT_EIS_STATUS, OPENAPI_DISCOVERY_LOG, SWAGGER_FORENSIC_REPORT |',
    '| Legal | MRA_EIS_LEGAL_AND_REGULATORY_RESEARCH, LEGAL_QUESTIONS_FOR_COUNSEL |',
    '| Business process | TAXPAYER_ONBOARDING, INVENTORY_AND_SERVICE, TERMINAL_CONCEPT, ECOSYSTEM |',
    '| API contracts | VERIFIED_ENDPOINT_MATRIX, endpoints/*, GENERAL_* , CRYPTOGRAPHIC_*, *CONTRACT.md |',
    '| Registers | DOCUMENTATION_DISCREPANCY, MRA_CLARIFICATION, PHASE_1_RISK |',
    '| Handover | PHASE_2_HANDOVER, FINAL_PHASE_1_REPORT, PHASE_1_READINESS_DECISION |',
    '',
    '## Hard rules observed',
    '',
    '1. No production credentials used.',
    '2. No sales / activation API calls with TAC.',
    '3. No invented endpoints.',
    '4. Conflicts remain visible until MRA/sandbox resolution.',
  ]
);

// ---------- TASKS ----------
const workstreams = [
  ['A', 'Official source inventory', 'OFFICIAL_SOURCE_INVENTORY.md'],
  ['B', 'Source archival', 'evidence/'],
  ['C', 'Source freshness assessment', 'OFFICIAL_SOURCE_INVENTORY.md'],
  ['D', 'Legal-framework research', 'MRA_EIS_LEGAL_AND_REGULATORY_RESEARCH.md'],
  ['E', 'EIS purpose and scope', 'CURRENT_EIS_STATUS.md'],
  ['F', 'Taxpayer obligations', 'MRA_EIS_LEGAL_AND_REGULATORY_RESEARCH.md'],
  ['G', 'Third-party vendor obligations', 'API_COMPLIANCE_CERTIFICATION_RESEARCH.md'],
  ['H', 'Certification requirements', 'API_COMPLIANCE_CERTIFICATION_RESEARCH.md'],
  ['I', 'Taxpayer onboarding', 'TAXPAYER_ONBOARDING_RESEARCH.md'],
  ['J', 'Product-based onboarding', 'TAXPAYER_ONBOARDING_RESEARCH.md'],
  ['K', 'Service-based onboarding', 'TAXPAYER_ONBOARDING_RESEARCH.md'],
  ['L', 'Inventory onboarding', 'INVENTORY_AND_SERVICE_WORKFLOW_RESEARCH.md'],
  ['M', 'Branch and site setup', 'TAXPAYER_ONBOARDING_RESEARCH.md'],
  ['N', 'Terminal acquisition', 'TERMINAL_CONCEPT_AND_LIFECYCLE.md'],
  ['O', 'Terminal definition and lifecycle', 'TERMINAL_CONCEPT_AND_LIFECYCLE.md'],
  ['P', 'Terminal activation', 'TERMINAL_ACTIVATION_CONTRACT.md'],
  ['Q', 'Activation confirmation', 'TERMINAL_ACTIVATION_CONFIRMATION_CONTRACT.md'],
  ['R', 'Authentication', 'AUTHENTICATION_AND_CREDENTIAL_RESEARCH.md'],
  ['S', 'Request headers', 'GENERAL_REQUEST_CONTRACT.md'],
  ['T', 'Message hashing', 'CRYPTOGRAPHIC_REQUIREMENTS.md'],
  ['U', 'Digital signing', 'CRYPTOGRAPHIC_REQUIREMENTS.md'],
  ['V', 'Secret-key handling', 'AUTHENTICATION_AND_CREDENTIAL_RESEARCH.md'],
  ['W', 'JWT handling', 'AUTHENTICATION_AND_CREDENTIAL_RESEARCH.md'],
  ['X', 'General request envelope', 'GENERAL_REQUEST_CONTRACT.md'],
  ['Y', 'General response envelope', 'GENERAL_RESPONSE_CONTRACT.md'],
  ['Z', 'Error codes', 'ERROR_CODE_CATALOGUE.md'],
  ['AA', 'Configuration API', 'CONFIGURATION_CONTRACT.md'],
  ['AB', 'Global configuration', 'CONFIGURATION_CONTRACT.md'],
  ['AC', 'Terminal configuration', 'CONFIGURATION_CONTRACT.md'],
  ['AD', 'Taxpayer configuration', 'CONFIGURATION_CONTRACT.md'],
  ['AE', 'Tax rates', 'TAX_AND_LEVY_CONTRACT.md'],
  ['AF', 'Levies', 'TAX_AND_LEVY_CONTRACT.md'],
  ['AG', 'Product Status', 'PRODUCT_STATUS_CONTRACT.md'],
  ['AH', 'Initial Inventory upload', 'INITIAL_INVENTORY_UPLOAD_CONTRACT.md'],
  ['AI', 'Site products and services', 'SITE_PRODUCT_SERVICE_CONTRACT.md'],
  ['AJ', 'Sales submission', 'SALES_TRANSACTION_CONTRACT.md'],
  ['AK', 'Last online transaction', 'LAST_ONLINE_TRANSACTION_CONTRACT.md'],
  ['AL', 'Last offline transaction', 'LAST_OFFLINE_TRANSACTION_CONTRACT.md'],
  ['AM', 'Buyer TIN', 'B2B_TRANSACTION_CONTRACT.md'],
  ['AN', 'Buyer authorization', 'B2B_TRANSACTION_CONTRACT.md'],
  ['AO', 'VAT5', 'VAT5_RELIEF_CONTRACT.md'],
  ['AP', 'Payment methods', 'PAYMENT_METHOD_CONTRACT.md'],
  ['AQ', 'Fiscal numbering', 'FISCAL_NUMBERING_CONTRACT.md'],
  ['AR', 'QR receipts', 'RECEIPT_AND_QR_REQUIREMENTS.md'],
  ['AS', 'Offline mode', 'OFFLINE_MODE_REQUIREMENTS.md'],
  ['AT', 'Offline signature', 'OFFLINE_SIGNATURE_CONTRACT.md'],
  ['AU', 'Offline thresholds', 'OFFLINE_THRESHOLD_CONTRACT.md'],
  ['AV', 'Offline submission', 'OFFLINE_MODE_REQUIREMENTS.md'],
  ['AW', 'Terminal blocking', 'TERMINAL_BLOCKING_CONTRACT.md'],
  ['AX', 'Terminal unblocking', 'TERMINAL_BLOCKING_CONTRACT.md'],
  ['AY', 'Ping and health checks', 'PING_AND_HEALTH_CONTRACT.md'],
  ['AZ', 'API versioning', 'API_VERSIONING_RESEARCH.md'],
  ['BA', 'Rate limits', 'RATE_LIMIT_AND_SERVICE_RESEARCH.md'],
  ['BB', 'Idempotency', 'IDEMPOTENCY_AND_DUPLICATE_RESEARCH.md'],
  ['BC', 'Timeout behaviour', 'TIMEOUT_AND_UNKNOWN_OUTCOME_RESEARCH.md'],
  ['BD', 'Retry behaviour', 'TIMEOUT_AND_UNKNOWN_OUTCOME_RESEARCH.md'],
  ['BE', 'Data retention', 'DATA_RETENTION_AND_AUDIT_RESEARCH.md'],
  ['BF', 'Security', 'SECURITY_THREAT_MODEL.md'],
  ['BG', 'Privacy', 'PRIVACY_AND_DATA_CLASSIFICATION.md'],
  ['BH', 'Audit requirements', 'DATA_RETENTION_AND_AUDIT_RESEARCH.md'],
  ['BI', 'Reconciliation', 'TIMEOUT_AND_UNKNOWN_OUTCOME_RESEARCH.md'],
  ['BJ', 'Swagger inspection', 'SWAGGER_FORENSIC_REPORT.md'],
  ['BK', 'OpenAPI extraction', 'OPENAPI_DISCOVERY_LOG.md'],
  ['BL', 'Contract discrepancies', 'DOCUMENTATION_DISCREPANCY_REGISTER.md'],
  ['BM', 'Sandbox verification plan', 'SANDBOX_VERIFICATION_PLAN.md'],
  ['BN', 'Contract-test plan', 'CONTRACT_TEST_SPECIFICATION.md'],
  ['BO', 'MRA clarification register', 'MRA_CLARIFICATION_REGISTER.md'],
  ['BP', 'Phase 2 handover', 'PHASE_2_HANDOVER.md'],
  ['BQ', 'Risk register', 'PHASE_1_RISK_REGISTER.md'],
  ['BR', 'Final report', 'FINAL_PHASE_1_REPORT.md'],
];

doc('PHASE_1_TASKS.md', 'Phase 1 Task Tracker', [
  '## Workstreams',
  '',
  '| ID | Workstream | Status | Researcher | Reviewer | Output | Completion |',
  '|---|---|---|---|---|---|---|',
  ...workstreams.map(
    ([id, name, out]) =>
      `| ${id} | ${name} | COMPLETE (research draft) | Cursor AI | Pending human review | ${out} | ${ACCESS} |`
  ),
  '',
  '## Notes',
  '',
  '- Sandbox behavioural verification: **NOT RUN** (no authorized credentials / written approval).',
  '- Legal conclusions: require counsel review — see LEGAL_QUESTIONS_FOR_COUNSEL.md.',
  '- Every task lists Open Question / Risk in related registers.',
]);

// ---------- SOURCE INVENTORY ----------
doc('OFFICIAL_SOURCE_INVENTORY.md', 'Official Source Inventory', [
  '## Classification key',
  '',
  'CURRENT · POSSIBLY_CURRENT · SUPERSEDED · ARCHIVED · UNDATED · CONFLICTING · INACCESSIBLE · REQUIRES_CONFIRMATION',
  '',
  '## Sources',
  '',
  '| Source ID | Title | Publisher | URL | Type | Version | Pub date | Access | Class | Reliability | Local evidence |',
  '|---|---|---|---|---|---|---|---|---|---|---|',
  `| SRC-API-SWAGGER-UI | EISAPI Swagger UI | MRA | https://eis-api.mra.mw/swagger/index.html | API UI | EISAPI 1.0 | UNDATED | ${ACCESS} | CURRENT | High for discovery | probe 200 |`,
  `| SRC-API-OAS-JSON | OpenAPI JSON (prod) | MRA | https://eis-api.mra.mw/swagger/v1/swagger.json | OpenAPI 3.0.1 | 1.0 | UNDATED | ${ACCESS} | CURRENT | High for paths/schemas | docs/mra-eis/swagger-production.v1.json SHA256 0DFCC046… |`,
  `| SRC-API-OAS-YAML | OpenAPI YAML (prod) | MRA | https://eis-api.mra.mw/swagger/v1/swagger.yaml | OpenAPI | 1.0 | UNDATED | ${ACCESS} | CURRENT | High | swagger-production.v1.yaml |`,
  `| SRC-API-OAS-SBX | OpenAPI JSON (sandbox) | MRA | https://dev-eis-api.mra.mw/swagger/v1/swagger.json | OpenAPI | 1.0 | UNDATED | ${ACCESS} | CURRENT | High | swagger-sandbox.v1.json |`,
  `| SRC-API-DOCS | EIS API Developers Guide (HTML) | MRA ICT R&I | https://eis-api.mra.mw/docs/ | Guide | v1 (footer 2024) | 2024© | ${ACCESS} | POSSIBLY_CURRENT | High for crypto/process; samples conflict | docs/mra-eis/guide/ |`,
  `| SRC-PORTAL-DEV | Developer Resource Center | MRA | https://eis-portal.mra.mw/Home/DeveloperResources | Portal | n/a | UNDATED | ${ACCESS} | CURRENT | Medium (links to swagger/guide) | fetch log |`,
  `| SRC-PORTAL-PROD | EIS Taxpayer Portal | MRA | https://eis-portal.mra.mw/ | Portal | n/a | UNDATED | ${ACCESS} | CURRENT | High operational | — |`,
  `| SRC-PORTAL-SBX | EIS Sandbox Portal | MRA | https://dev-eis-portal.mra.mw/ | Portal | n/a | UNDATED | ${ACCESS} | CURRENT | High for pre-integration | — |`,
  `| SRC-PORTAL-FAQ | EIS Portal FAQ | MRA | https://eis-portal.mra.mw/Home/FAQ | FAQ | UNDATED | UNDATED | ${ACCESS} | CURRENT | Medium | WebFetch ${ACCESS} |`,
  `| SRC-NOTICE-TRANS | Public Notice — Transition EFD to EIS | MRA | https://www.mra.mw/admin/storage/download_files/1769007736_003%20TRANSITION%20FROM%20ELECTRONIC%20FISCAL%20DEVICES%20TO%20THE%20ELECTRONIC%20INVOICING%20SYSTEM.pdf | Public Notice | — | Refs Regs 2025 / deadline 31 Jan 2026 | ${ACCESS} | CURRENT | High for transition | evidence/MRA-PublicNotice-EFD-to-EIS-transition.pdf |`,
  `| SRC-MRA-HOME | MRA website | MRA | https://www.mra.mw/ | Site | — | — | ${ACCESS} | CURRENT | Lead source | — |`,
  `| SRC-MRA-PUB | Publications | MRA | https://www.mra.mw/publications | Index | — | — | ${ACCESS} | CURRENT | Lead | — |`,
  `| SRC-MRA-DL | Domestic downloads | MRA | https://www.mra.mw/domestic-downloads | Index | — | — | ${ACCESS} | CURRENT | Lead | — |`,
  `| SRC-LEG-VAT-AMEND-2024 | Value Added Tax (Amendment) Act, 2024 (Part II EIS) | Malawi Legislature / as cited by MRA | Locate official gazette text | Legislation | 2024 | 2024 | ${ACCESS} | REQUIRES_CONFIRMATION | Cite via notice; full Act text for counsel | LEGAL_* |`,
  `| SRC-LEG-VAT-EIS-REGS-2025 | Value Added Tax (Electronic Invoicing System) Regulations, 2025 | As cited in MRA notice (pub 9 Jan 2026) | Locate gazette | Regulations | 2025 | Cited 9 Jan 2026 | ${ACCESS} | REQUIRES_CONFIRMATION | High if gazette located | LEGAL_* |`,
  `| SRC-GUIDE-CERT | API Compliance Certification | MRA | https://eis-api.mra.mw/docs/api_compliance_certification.htm | Guide | v1 | 2024© | ${ACCESS} | POSSIBLY_CURRENT | High process | guide/ |`,
  `| SRC-GUIDE-PRE | Developer Pre-Integration Guide | MRA | https://eis-api.mra.mw/docs/developer_pre_integration_guide.htm | Guide | v1 | 2024© | ${ACCESS} | POSSIBLY_CURRENT | High onboarding | guide/ |`,
  '',
  '## Freshness assessment',
  '',
  '- Developer Guide pages carry © 2024; still served live — classed POSSIBLY_CURRENT.',
  '- Transition Public Notice references deadlines through **31 January 2026** and Regulations published **9 January 2026** — CURRENT operational context as of access date.',
  '- OpenAPI `info.version` = **1.0**; no servers array; no securitySchemes — CURRENT snapshot.',
  '- Full VAT Act / Regulations gazette PDFs: **not fully archived in-repo** — counsel must retrieve official instruments.',
  '',
  '## Conflicts',
  '',
  'See DOCUMENTATION_DISCREPANCY_REGISTER.md (Swagger vs Guide samples).',
]);

doc('evidence/README.md', 'Phase 1 Evidence Directory', [
  '## Policy',
  '',
  'Store only permitted public materials. **Forbidden:** real JWT, secretKey, TAC, buyer auth codes, production captures, PII.',
  '',
  '## Contents',
  '',
  '| File | Notes |',
  '|---|---|',
  '| SOURCE_CHECKSUMS.md | SHA-256 of archived artifacts |',
  '| openapi-probe-status.txt | Safe public GET statuses |',
  '| source-fetch-log.md | Fetch notes |',
  '| MRA-PublicNotice-EFD-to-EIS-transition.pdf | Public notice PDF |',
  '',
  'OpenAPI JSON lives in parent `docs/mra-eis/` (checksummed).',
]);

doc('evidence/SOURCE_CHECKSUMS.md', 'Source Checksums', [
  `**Computed:** ${ACCESS}`,
  '',
  '| Original URL | Local path | Size | SHA-256 | MIME |',
  '|---|---|---|---|---|',
  '| https://eis-api.mra.mw/swagger/v1/swagger.json | docs/mra-eis/swagger-production.v1.json | 139220 | 0DFCC0461487D137F4FFE838F58163FA5050D1A4E4D7FCFFB223D3AE29AC8814 | application/json |',
  '| https://eis-api.mra.mw/swagger/v1/swagger.yaml | docs/mra-eis/swagger-production.v1.yaml | 96983 | DFDFEC1AFF0439A13F04FCF9E8993F8520E0005AF453A61C854CDAA690EE97E3 | application/yaml |',
  '| https://dev-eis-api.mra.mw/swagger/v1/swagger.json | docs/mra-eis/swagger-sandbox.v1.json | 151047 | 2BA5C40045D2635C0F8DF10C6278FB0914D1DCCC30210D16B6BF5388C26D3D99 | application/json |',
  '| MRA public notice PDF | evidence/MRA-PublicNotice-EFD-to-EIS-transition.pdf | 164559 | 1527A4B7D407F39936C8614EF311AB841972049DC031A7A955B16D1664506ADD | application/pdf |',
]);

doc('evidence/source-fetch-log.md', 'Source Fetch Log', [
  `**Access date:** ${ACCESS}`,
  '',
  'All probes: unauthenticated GET. No TAC/JWT/sales.',
  '',
  '| URL | HTTP | Content-Type | Notes |',
  '|---|---|---|---|',
  '| https://eis-api.mra.mw/swagger/index.html | 200 | text/html | Swagger UI |',
  '| https://eis-api.mra.mw/swagger/v1/swagger.json | 200 | application/json | OpenAPI available |',
  '| https://eis-api.mra.mw/docs/ | 200 | text/html | Developers Guide |',
  '| https://eis-portal.mra.mw/Home/DeveloperResources | 200 | text/html | Links to API Docs / Swagger |',
  '| https://eis-portal.mra.mw/ | 200 | text/html | Taxpayer portal |',
  '| https://dev-eis-portal.mra.mw/ | 200 | text/html | Sandbox portal |',
  '| https://dev-eis-api.mra.mw/swagger/v1/swagger.json | 200 | application/json | +3 sandbox stock paths |',
  '| https://www.mra.mw/ | 200 | text/html | Corporate site |',
  '| https://www.mra.mw/publications | 200 | text/html | Publications index |',
  '| https://www.mra.mw/domestic-downloads | 200 | text/html | Downloads index |',
  '| Transition public notice PDF | 200 | application/pdf | Archived |',
]);

// Continue generating remaining docs in this same file - it's long but necessary
console.log('partial-start', written.length);
fs.writeFileSync(path.join(ROOT, '_written-partial.json'), JSON.stringify(written, null, 2));
module.exports = { doc, written, conf, ACCESS, index, prodCount, sandOnly, w };
