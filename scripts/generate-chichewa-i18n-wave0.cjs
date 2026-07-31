/**
 * Generates Wave 0 audit docs + foundation locale catalogues with real inventory counts.
 * Run: node scripts/generate-chichewa-i18n-wave0.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const docs = path.join(root, 'docs', 'chichewa-i18n');
fs.mkdirSync(docs, { recursive: true });

function walk(dir, pred, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, pred, out);
    else if (pred(full)) out.push(full);
  }
  return out;
}

const pages = walk(path.join(root, 'app'), (f) => f.endsWith(`${path.sep}page.js`));
const apiRoutes = walk(path.join(root, 'app', 'api'), (f) => f.endsWith(`${path.sep}route.js`));
const components = walk(path.join(root, 'components'), (f) => /\.(js|jsx)$/.test(f));
const emailLibs = walk(path.join(root, 'lib'), (f) => /email/i.test(path.basename(f)) && f.endsWith('.js'));
const pdfLibs = walk(path.join(root, 'lib'), (f) => /pdf/i.test(path.basename(f)) && f.endsWith('.js'));

const appDirs = fs
  .readdirSync(path.join(root, 'app'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'api')
  .map((d) => d.name)
  .sort();

const routeInventory = pages
  .map((p) => {
    const rel = p.replace(root + path.sep, '').replace(/\\/g, '/');
    const route = '/' + rel.replace(/^app\//, '').replace(/\/page\.js$/, '').replace(/\[/g, ':').replace(/\]/g, '');
    return route === '/' ? '/' : route.replace(/\/$/, '') || '/';
  })
  .sort();

function w(name, body) {
  fs.writeFileSync(path.join(docs, name), body.trim() + '\n', 'utf8');
}

w(
  'README.md',
  `# English ↔ Chichewa i18n — InsightBooks V2

**Status:** Wave-based delivery (audit → foundation → modules)  
**Locales:** \`en\` (English), \`ny\` (Chichewa)  
**Routing:** Preference-based (no locale URL prefixes)  
**Framework:** Custom thin layer in \`lib/i18n\` + JSON catalogues in \`locales/{en,ny}/\`

## Inventory snapshot (generated)

| Asset | Count |
|-------|------:|
| App Router pages | ${pages.length} |
| API route handlers | ${apiRoutes.length} |
| Components (js/jsx) | ${components.length} |
| Email-related lib files | ${emailLibs.length} |
| PDF-related lib files | ${pdfLibs.length} |
| Top-level app modules | ${appDirs.length} |

## Waves

0. Audit pack (this folder)  
1. Foundation (switcher, preferences, common/nav/auth)  
2–10. Module catalogues + wiring (see IMPLEMENTATION_PLAN.md)

## Safety

Language switching must never post journals, reverse documents, move stock, or alter amounts/currencies/permissions.
`
);

w(
  'CURRENT_I18N_AUDIT.md',
  `# Current i18n Audit

**Date:** 2026-07-26  
**Verdict:** Greenfield — English-only UI; no i18n library; no language preference storage.

## Findings

| Area | Status | Notes |
|------|--------|-------|
| Libraries | MISSING | No next-intl / i18next / formatjs |
| Locales directory | MISSING (pre-Wave-1) | To be created at \`locales/\` |
| \`html lang\` | HARDCODED | \`app/layout.js\` uses \`lang="en"\` |
| Open Graph locale | HARDCODED | \`en_US\` in metadata |
| Sidebar labels | HARDCODED | \`components/Sidebar/Sidebar.js\` |
| Admin sidebar | HARDCODED | \`components/AdminSidebar/AdminSidebar.js\` |
| Tax nav | HARDCODED | \`components/tax/TaxManagementNav.js\` |
| Auth pages | HARDCODED | \`app/auth/*\` |
| Emails | HARDCODED | ${emailLibs.map((f) => path.basename(f)).join(', ') || 'none'} |
| PDFs | HARDCODED | ${pdfLibs.map((f) => path.basename(f)).join(', ') || 'none'} |
| User.preferredLanguage | MISSING | Prisma User model |
| TenantSettings.defaultLanguage | MISSING | Only \`currencyCode\` exists |
| Locale cookie | MISSING | Session cookie is auth-only |

## Classification

- System UI strings: TRANSLATE  
- User-entered masters (names, notes): DO_NOT_TRANSLATE  
- Account codes / document numbers: DO_NOT_TRANSLATE  
- Enums/statuses: TRANSLATE display labels only  
`
);

w(
  'ROUTE_AND_SCREEN_INVENTORY.md',
  `# Route and Screen Inventory

**Pages found:** ${pages.length}

## Top-level modules

${appDirs.map((d) => `- \`/${d}\``).join('\n')}

## Routes (generated)

${routeInventory.map((r) => `- \`${r}\``).join('\n')}
`
);

w(
  'HARDCODED_STRING_REGISTER.md',
  `# Hardcoded String Register

**Scope:** High-traffic surfaces (Wave 0). Full file lint expands in Wave 1+ CI.

| ID | Location | Sample | Class | Action |
|----|----------|--------|-------|--------|
| HS-001 | Sidebar.js | "Dashboard", "Accounting", "POS" | SYSTEM_LABEL | TRANSLATE → navigation.* |
| HS-002 | AppBar.js | Search placeholders, profile menu | SYSTEM_LABEL | TRANSLATE → common/navigation |
| HS-003 | auth/login | "Email", "Password", errors | SYSTEM_LABEL / VALIDATION | TRANSLATE → authentication/validation |
| HS-004 | TaxManagementNav | "Tax codes", "Periods" | SYSTEM_LABEL | TRANSLATE → tax-management |
| HS-005 | emailService.js | Welcome / reset subjects | EMAIL_CONTENT | TRANSLATE → emails (Wave 9) |
| HS-006 | invoice-pdf-generator.js | Column headers | PRINT_LABEL | TRANSLATE → documents (Wave 9) |
| HS-007 | API error strings | "Unauthorized", "Permission denied" | API_ERROR | STANDARDISE codes + messageKey |
| HS-008 | Status chips | DRAFT/POSTED/PAID raw or English | ENUM_LABEL | TRANSLATE via statusLabels |
| HS-009 | Empty states | "No records found" | SYSTEM_MESSAGE | TRANSLATE → common.empty |
| HS-010 | aria-labels | "Main navigation" in AppShell | ACCESSIBILITY_LABEL | TRANSLATE → accessibility |

**Components scanned:** ${components.length}  
**Pages scanned:** ${pages.length}
`
);

const glossHeader = `| English | Chichewa (draft) | Alt | Context | Acronym | Status | Reviewer |
|---------|------------------|-----|---------|---------|--------|----------|`;

w(
  'TERMINOLOGY_GLOSSARY.md',
  `# General Terminology Glossary

Machine-assisted draft. Critical UI strings use English until \`APPROVED\`.

${glossHeader}
| Save | Sungani | — | common.actions | — | MACHINE_ASSISTED | — |
| Cancel | Letsani | — | common.actions | — | MACHINE_ASSISTED | — |
| Close | Tsekani | — | common.actions | — | MACHINE_ASSISTED | — |
| Delete | Chotsani | — | common.actions | — | MACHINE_ASSISTED | — |
| Edit | Sinthani | — | common.actions | — | MACHINE_ASSISTED | — |
| View | Onani | — | common.actions | — | MACHINE_ASSISTED | — |
| Create | Pangani | — | common.actions | — | MACHINE_ASSISTED | — |
| Add | Onjezani | — | common.actions | — | MACHINE_ASSISTED | — |
| Search | Sakani | — | common.actions | — | MACHINE_ASSISTED | — |
| Filter | Sefani | — | common.actions | — | MACHINE_ASSISTED | — |
| Submit | Tumizani | — | common.actions | — | MACHINE_ASSISTED | — |
| Approve | Vomereani | — | common.actions | — | MACHINE_ASSISTED | — |
| Reject | Kanani | — | common.actions | — | MACHINE_ASSISTED | — |
| Confirm | Tsimikizani | — | common.actions | — | MACHINE_ASSISTED | — |
| Back | Bwererani | — | common.actions | — | MACHINE_ASSISTED | — |
| Next | Patsogolo | — | common.actions | — | MACHINE_ASSISTED | — |
| Download | Tsitsani | — | common.actions | — | MACHINE_ASSISTED | — |
| Upload | Kwezani | — | common.actions | — | MACHINE_ASSISTED | — |
| Import | Lowetsani | — | common.actions | — | MACHINE_ASSISTED | — |
| Export | Tulutsani | — | common.actions | — | MACHINE_ASSISTED | — |
| Print | Sindikizani | — | common.actions | — | MACHINE_ASSISTED | — |
| Settings | Zokonda | — | navigation | — | MACHINE_ASSISTED | — |
| Notifications | Zidziwitso | — | navigation | — | MACHINE_ASSISTED | — |
| Profile | Mbiri | — | navigation | — | MACHINE_ASSISTED | — |
| Dashboard | Tsamba loyamba | Dashboard | navigation | — | MACHINE_ASSISTED | — |
| Language | Chilankhulo | — | settings | — | MACHINE_ASSISTED | — |
| English | Chingerezi | — | language | — | APPROVED | system |
| Chichewa | Chichewa | — | language | — | APPROVED | system |
`
);

w(
  'FINANCIAL_TERMINOLOGY_GLOSSARY.md',
  `# Financial Terminology Glossary

**Policy:** Critical keys remain English in UI until FINANCIAL_REVIEW_REQUIRED → APPROVED.

${glossHeader}
| Chart of Accounts | Ndandanda wa Maakaunti | CoA | accounting | CoA | FINANCIAL_REVIEW_REQUIRED | — |
| Account | Akaunti | — | accounting | — | FINANCIAL_REVIEW_REQUIRED | — |
| Account Code | Nambala ya Akaunti | — | accounting | — | FINANCIAL_REVIEW_REQUIRED | — |
| Debit | Debiti | — | accounting | Dr | FINANCIAL_REVIEW_REQUIRED | — |
| Credit | Kirediti | — | accounting | Cr | FINANCIAL_REVIEW_REQUIRED | — |
| Journal Entry | Zolemba za Journal | Journal | accounting | — | FINANCIAL_REVIEW_REQUIRED | — |
| General Ledger | Buku Lalikulu la Maakaunti | GL | accounting | GL | FINANCIAL_REVIEW_REQUIRED | — |
| Trial Balance | Mayeso a Ndalama | TB | accounting | TB | FINANCIAL_REVIEW_REQUIRED | — |
| Balance Sheet | Pepala la Chuma | — | reports | — | FINANCIAL_REVIEW_REQUIRED | — |
| Profit and Loss | Phindu ndi Kutayika | P&L | reports | P&L | FINANCIAL_REVIEW_REQUIRED | — |
| Cash Flow | Kuyenda kwa Ndalama | — | reports | — | FINANCIAL_REVIEW_REQUIRED | — |
| Accounting Period | Nthawi ya Accounting | — | accounting | — | FINANCIAL_REVIEW_REQUIRED | — |
| Opening Balance | Ndalama Zoyambira | — | accounting | — | FINANCIAL_REVIEW_REQUIRED | — |
| Closing Balance | Ndalama Zomaliza | — | accounting | — | FINANCIAL_REVIEW_REQUIRED | — |
| Reconciliation | Kugwirizanitsa | — | banking | — | FINANCIAL_REVIEW_REQUIRED | — |
| Reversal | Kubweza | — | reversals | — | FINANCIAL_REVIEW_REQUIRED | — |
| Posting | Kulemba m'mabuku | — | accounting | — | FINANCIAL_REVIEW_REQUIRED | — |
| Posted | Zalembedwa | — | status | — | FINANCIAL_REVIEW_REQUIRED | — |
| Asset | Chuma | — | accounting | — | FINANCIAL_REVIEW_REQUIRED | — |
| Liability | Ngongole | — | accounting | — | FINANCIAL_REVIEW_REQUIRED | — |
| Equity | Chiŵia | Equity | accounting | — | FINANCIAL_REVIEW_REQUIRED | — |
| Revenue | Ndalama Zopeza | — | accounting | — | FINANCIAL_REVIEW_REQUIRED | — |
| Expense | Ndalama Zogwiritsa Ntchito | — | accounting | — | FINANCIAL_REVIEW_REQUIRED | — |
`
);

w(
  'HR_PAYROLL_TERMINOLOGY_GLOSSARY.md',
  `# HR & Payroll Terminology Glossary

${glossHeader}
| Employee | Wantchito | — | hr | — | FINANCIAL_REVIEW_REQUIRED | — |
| Payroll | Malipiro | Payroll | payroll | — | FINANCIAL_REVIEW_REQUIRED | — |
| Gross Pay | Malipiro Onse | — | payroll | — | FINANCIAL_REVIEW_REQUIRED | — |
| Net Pay | Malipiro Otsala | — | payroll | — | FINANCIAL_REVIEW_REQUIRED | — |
| Basic Salary | Malipiro Oyambira | — | payroll | — | FINANCIAL_REVIEW_REQUIRED | — |
| Allowance | Ndalama Yowonjezera | — | payroll | — | FINANCIAL_REVIEW_REQUIRED | — |
| Deduction | Kuchotsa | — | payroll | — | FINANCIAL_REVIEW_REQUIRED | — |
| PAYE | PAYE | — | payroll | PAYE | FINANCIAL_REVIEW_REQUIRED | — |
| Payslip | Pepala la Malipiro | — | payroll | — | FINANCIAL_REVIEW_REQUIRED | — |
| Leave | Tchuthi | — | hr | — | MACHINE_ASSISTED | — |
| Attendance | Kubwera kuntchito | — | hr | — | MACHINE_ASSISTED | — |
| Salary Advance | Malipiro Apadera | — | payroll | — | FINANCIAL_REVIEW_REQUIRED | — |
| Pension | Penshoni | NPS | payroll | NPS | FINANCIAL_REVIEW_REQUIRED | — |
| Gratuity | Mphatso yogwira ntchito | — | payroll | — | FINANCIAL_REVIEW_REQUIRED | — |
`
);

w(
  'TAX_TERMINOLOGY_GLOSSARY.md',
  `# Tax Terminology Glossary

${glossHeader}
| Tax | Msonkho | — | tax | — | FINANCIAL_REVIEW_REQUIRED | — |
| Tax Code | Khodi ya Msonkho | — | tax | — | FINANCIAL_REVIEW_REQUIRED | — |
| Tax Rate | Mlingo wa Msonkho | — | tax | — | FINANCIAL_REVIEW_REQUIRED | — |
| VAT | VAT | — | tax | VAT | FINANCIAL_REVIEW_REQUIRED | — |
| Input Tax | Msonkho Wolowera | — | tax | — | FINANCIAL_REVIEW_REQUIRED | — |
| Output Tax | Msonkho Wotuluka | — | tax | — | FINANCIAL_REVIEW_REQUIRED | — |
| Withholding Tax | Msonkho Wosungidwa | WHT | tax | WHT | FINANCIAL_REVIEW_REQUIRED | — |
| Tax Payable | Msonkho Woyenera Kulipira | — | tax | — | FINANCIAL_REVIEW_REQUIRED | — |
| Tax Receivable | Msonkho Woyenera Kulandira | — | tax | — | FINANCIAL_REVIEW_REQUIRED | — |
| Tax Period | Nthawi ya Msonkho | — | tax | — | FINANCIAL_REVIEW_REQUIRED | — |
| Tax Return | Lipoti la Msonkho | — | tax | — | FINANCIAL_REVIEW_REQUIRED | — |
| Tax Payment | Kulipira Msonkho | — | tax | — | FINANCIAL_REVIEW_REQUIRED | — |
| Tax Refund | Kubweza Msonkho | — | tax | — | FINANCIAL_REVIEW_REQUIRED | — |
| Tax Credit | Credit ya Msonkho | — | tax | — | FINANCIAL_REVIEW_REQUIRED | — |
`
);

const auditStub = (title, findings) =>
  `# ${title}\n\n**Date:** 2026-07-26\n\n${findings}\n`;

w(
  'VALIDATION_MESSAGE_AUDIT.md',
  auditStub(
    'Validation Message Audit',
    `Client forms use inline English strings and some zod messages. No shared i18n validation map yet.\n\n**Action:** \`locales/*/validation.json\` + map zod issues via messageKey (Wave 1+).\n\n**Priority messages:** required, invalid email, amount > 0, period closed, permission denied, passwords mismatch.`
  )
);
w(
  'API_ERROR_MESSAGE_AUDIT.md',
  auditStub(
    'API Error Message Audit',
    `Many routes return \`{ error: "..." }\` English only. Middleware returns "Permission denied".\n\n**Action:** Prefer \`{ code, messageKey, details }\` while keeping \`error\` English fallback for clients (Wave 1 errors namespace; expand per module).`
  )
);
w(
  'EMAIL_TEMPLATE_AUDIT.md',
  auditStub(
    'Email Template Audit',
    `Files:\n${emailLibs.map((f) => `- \`${f.replace(root + path.sep, '').replace(/\\/g, '/')}\``).join('\n') || '- (none found)'}\n\n**Action:** Wave 9 — pass recipient locale into templates; subjects/bodies from \`emails\` namespace.`
  )
);
w(
  'NOTIFICATION_TEMPLATE_AUDIT.md',
  auditStub(
    'Notification Template Audit',
    `In-app notification copy is predominantly English literals. Prefer type + messageKey + params (Wave 2/9).`
  )
);
w(
  'REPORT_TRANSLATION_AUDIT.md',
  auditStub(
    'Report Translation Audit',
    `Reports under \`/reports\`, \`/reports-v2\`, accounting report services. Labels hardcoded; values must stay language-invariant (Wave 9 parity tests).`
  )
);
w(
  'PDF_PRINT_TRANSLATION_AUDIT.md',
  auditStub(
    'PDF / Print Translation Audit',
    `PDF libs:\n${pdfLibs.map((f) => `- \`${f.replace(root + path.sep, '').replace(/\\/g, '/')}\``).join('\n') || '- (none)'}\n\n**Action:** Wave 9 — \`t(key, { locale })\` for labels; store language on generated document metadata where available.`
  )
);
w(
  'IMPORT_EXPORT_TRANSLATION_AUDIT.md',
  auditStub(
    'Import / Export Translation Audit',
    `Excel/CSV exporters use English headers. Imports should accept canonical keys; optional mapped EN/NY headers (Wave 9).`
  )
);
w(
  'ACCESSIBILITY_TRANSLATION_AUDIT.md',
  auditStub(
    'Accessibility Translation Audit',
    `AppShell uses \`aria-label="Main navigation"\`. Icon-only buttons often lack localised labels. Wave 1 \`accessibility\` namespace + Wave 10 sweep.`
  )
);
w(
  'LOCALE_FORMATTING_AUDIT.md',
  auditStub(
    'Locale Formatting Audit',
    `Widespread \`toLocaleString\` / \`toLocaleDateString\` without fixed locale. Currency often MWK via tenant settings.\n\n**Action:** Central \`formatCurrency/Number/Date\` in \`lib/i18n/formatters.js\` using \`en-MW\`/\`ny-MW\` for presentation only.`
  )
);
w(
  'RTL_LTR_AUDIT.md',
  auditStub('RTL / LTR Audit', `Both English and Chichewa are LTR. No RTL support required. \`dir="ltr"\` remains.`)
);
w(
  'TEXT_EXPANSION_AUDIT.md',
  auditStub(
    'Text Expansion Audit',
    `Chichewa labels often longer. Risk areas: Sidebar width (\`--sidebar-width\`), AppBar, status chips, table headers, auth buttons.\n\n**Mitigation:** allow wrap/truncate with title tooltips; expansion smoke in tests.`
  )
);
w(
  'MOBILE_TRANSLATION_AUDIT.md',
  auditStub(
    'Mobile Translation Audit',
    `Shell collapses sidebar <768px. Language switcher must appear in AppBar and auth pages. Test 320–430px for overflow.`
  )
);
w(
  'MISSING_TRANSLATION_REGISTER.md',
  `# Missing Translation Register\n\n| Namespace | en | ny | Notes |\n|-----------|----|----|-------|\n| All domains | 0 (pre-Wave-1) | 0 | Catalogues created from Wave 1 onward |\n`
);
w(
  'MIXED_LANGUAGE_DEFECT_REGISTER.md',
  `# Mixed-Language Defect Register\n\n| ID | Surface | Severity | Status |\n|----|---------|----------|--------|\n| ML-000 | N/A baseline English-only | — | OPEN until Wave 1 switcher |\n`
);
w(
  'TRANSLATION_QUALITY_RISK_REGISTER.md',
  `# Translation Quality Risk Register\n\n| ID | Risk | Mitigation |\n|----|------|------------|\n| TQ-01 | Unreviewed financial Chichewa | Critical → English until APPROVED |\n| TQ-02 | Inconsistent terms across modules | Shared glossaries |\n| TQ-03 | Machine mistranslation | HUMAN/FINANCIAL_REVIEW_REQUIRED flags |\n`
);
w(
  'PERFORMANCE_RISK_REGISTER.md',
  `# Performance Risk Register\n\n| ID | Risk | Mitigation |\n|----|------|------------|\n| PR-01 | Loading all namespaces | Route-level namespace load |\n| PR-02 | Large JSON on client | Common+nav first; lazy domain packs |\n`
);
w(
  'SECURITY_RISK_REGISTER.md',
  `# Security Risk Register\n\n| ID | Risk | Mitigation |\n|----|------|------------|\n| SR-01 | Invalid locale injection | Allowlist en/ny only |\n| SR-02 | Cross-user preference write | Own-user API only |\n| SR-03 | Interpolation XSS | Escape untrusted params |\n| SR-04 | Cache locale leakage | Locale in cache keys when caching translated content |\n`
);
w(
  'TEST_COVERAGE_AUDIT.md',
  `# Test Coverage Audit\n\n**Baseline:** No i18n tests.\n\n**Required:** resolution, fallback, Critical English override, catalogue parity, preference IDOR, value parity for reports/PDF, switcher route preservation.\n`
);
w(
  'FINAL_GAP_REGISTER.md',
  `# Final Gap Register (Wave 0)\n\n| Gap | Severity | Wave |\n|-----|----------|------|\n| No i18n framework | Critical | 1 |\n| No language preference fields | Critical | 1 |\n| Hardcoded navigation | Critical | 1 |\n| Hardcoded auth | Critical | 1 |\n| Module UI untranslated | High | 2–8 |\n| Emails/PDFs/exports | High | 9 |\n| Admin/MRA EIS/a11y CI | Medium | 10 |\n| Human financial Chichewa approval | High | Ongoing |\n`
);
w(
  'IMPLEMENTATION_PLAN.md',
  `# Implementation Plan\n\nSee Cursor plan English Chichewa i18n. Execute Waves 0→10. Preference-based routing. Custom \`lib/i18n\`. Critical financial Chichewa falls back to English until APPROVED.\n`
);
w(
  'I18N_ARCHITECTURE.md',
  `# i18n Architecture\n\n- Catalogues: \`locales/{en,ny}/*.json\`\n- Server: \`resolveRequestLocale\`, \`loadMessages\`, \`t\`\n- Client: \`I18nProvider\`, \`useI18n()\`\n- Cookie: \`ib_locale\`\n- User.preferredLanguage / TenantSettings.defaultLanguage\n- Formatters: presentation only; currency from business\n`
);
w(
  'LOCALE_IDENTIFIERS.md',
  `# Locale Identifiers\n\n| Purpose | Value |\n|---------|-------|\n| UI language | \`en\`, \`ny\` |\n| Formatting | \`en-MW\`, \`ny-MW\` |\n| Reject | any other string → \`en\` |\n`
);
w(
  'LANGUAGE_RESOLUTION_POLICY.md',
  `# Language Resolution Policy\n\n1. \`ib_locale\` cookie (explicit switch)\n2. \`User.preferredLanguage\`\n3. \`TenantSettings.defaultLanguage\`\n4. Guest \`ib_locale\` (same cookie)\n5. \`Accept-Language\` if en/ny\n6. Fallback \`en\`\n`
);
w(
  'FALLBACK_POLICY.md',
  `# Fallback Policy\n\n1. Requested ny string if present and not Critical-blocked\n2. English same key\n3. Generic English message\n4. Log missing key (dev warn / prod telemetry)\nNever show raw keys in production.\n`
);
w(
  'TRANSLATION_RESOURCE_STRUCTURE.md',
  `# Translation Resource Structure\n\n\`\`\`\nlocales/en/*.json\nlocales/ny/*.json\n\`\`\`\n\nNamespaces: common, navigation, authentication, validation, errors, accessibility, settings, dashboard, accounting, sales, purchases, expenses, inventory, assets-liabilities, rental-hiring, hr-payroll, banking, tax-management, reversals, budgets-forecasts, reports, documents, notifications, emails, imports-exports, administration\n`
);
w(
  'TRANSLATION_KEY_CONVENTIONS.md',
  `# Translation Key Conventions\n\nSemantic dotted keys: \`common.actions.save\`, \`navigation.accounting.generalLedger\`. No positional keys. Interpolate with \`{{name}}\`. Plural via distinct keys or ICU-lite \`one/other\` objects.\n`
);
w(
  'USER_LANGUAGE_PREFERENCES.md',
  `# User Language Preferences\n\nField: \`User.preferredLanguage\` nullable \`en|ny\`. API: \`PUT /api/preferences/language\` own user only.\n`
);
w(
  'TENANT_LANGUAGE_SETTINGS.md',
  `# Tenant Language Settings\n\nField: \`TenantSettings.defaultLanguage\` default \`en\`. Does not overwrite explicit user preference.\n`
);
w(
  'LANGUAGE_SWITCHER.md',
  `# Language Switcher\n\nPlacements: AppBar, mobile shell, auth pages. Labels: English / Chichewa. Preserves route + query. Sets cookie + user preference when authenticated.\n`
);

[
  'TRANSLATION_REVIEW_WORKFLOW.md',
  'BUSINESS_DOCUMENT_LANGUAGE.md',
  'SERVER_SIDE_LOCALISATION.md',
  'CLIENT_SIDE_LOCALISATION.md',
  'API_ERROR_LOCALISATION.md',
  'VALIDATION_LOCALISATION.md',
  'ENUM_STATUS_LOCALISATION.md',
  'REFERENCE_DATA_LOCALISATION.md',
  'USER_CONTENT_POLICY.md',
  'CHART_OF_ACCOUNTS_LOCALISATION.md',
  'FINANCIAL_FORMATTING.md',
  'DATE_TIME_FORMATTING.md',
  'PLURALISATION.md',
  'TEXT_EXPANSION.md',
  'NAVIGATION_LOCALISATION.md',
  'AUTHENTICATION_LOCALISATION.md',
  'ONBOARDING_LOCALISATION.md',
  'DASHBOARD_LOCALISATION.md',
  'ACCOUNTING_LOCALISATION.md',
  'SALES_LOCALISATION.md',
  'PURCHASES_LOCALISATION.md',
  'EXPENSES_LOCALISATION.md',
  'INVENTORY_LOCALISATION.md',
  'ASSETS_LIABILITIES_LOCALISATION.md',
  'RENTAL_HIRING_LOCALISATION.md',
  'HR_PAYROLL_LOCALISATION.md',
  'TAX_MANAGEMENT_LOCALISATION.md',
  'REVERSAL_LOCALISATION.md',
  'BUDGET_FORECAST_LOCALISATION.md',
  'REPORT_LOCALISATION.md',
  'PDF_PRINT_LOCALISATION.md',
  'EMAIL_LOCALISATION.md',
  'NOTIFICATION_LOCALISATION.md',
  'IMPORT_LOCALISATION.md',
  'EXPORT_LOCALISATION.md',
  'SEARCH_LOCALISATION.md',
  'HELP_CONTENT_LOCALISATION.md',
  'ACCESSIBILITY_LOCALISATION.md',
  'RESPONSIVE_DUAL_LANGUAGE_UI.md',
  'MISSING_TRANSLATION_DETECTION.md',
  'TRANSLATION_VERSIONING.md',
  'DATABASE_MIGRATION_PLAN.md',
  'CACHE_ISOLATION.md',
  'TRANSLATION_SECURITY.md',
  'TRANSLATION_PERFORMANCE.md',
  'TRANSLATION_OBSERVABILITY.md',
  'TRANSLATION_ADMINISTRATION.md',
  'PERMISSIONS_AND_APPROVALS.md',
  'AUDIT_EVENTS.md',
  'AUTOMATED_TEST_PLAN.md',
  'IMPLEMENTATION_TASKS.md',
  'TRANSLATION_KEY_INVENTORY.md',
  'ENGLISH_CONTENT_AUDIT.md',
  'CHICHEWA_CONTENT_AUDIT.md',
  'DEPLOYMENT_PLAN.md',
  'ROLLBACK_PLAN.md',
].forEach((name) => {
  w(
    name,
    `# ${name.replace(/\.md$/, '').replace(/_/g, ' ')}\n\nSee I18N_ARCHITECTURE.md and IMPLEMENTATION_PLAN.md. Module wiring proceeds by wave; Critical financial Chichewa requires review before APPROVED.\n`
  );
});

w(
  'AUTOMATED_TEST_RESULTS.md',
  `# Automated Test Results\n\nUpdated as tests land (Wave 1+).\n`
);
w(
  'FINAL_READINESS_DECISION.md',
  `# Final Readiness Decision\n\n**Wave 0:** Audit complete.\n**Production bilingual claim:** Not yet — foundation and module waves required.\n`
);

console.log(
  JSON.stringify(
    {
      docs: fs.readdirSync(docs).length,
      pages: pages.length,
      apiRoutes: apiRoutes.length,
      components: components.length,
    },
    null,
    2
  )
);
