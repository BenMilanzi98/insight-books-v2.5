# Current i18n Audit

**Date:** 2026-07-26  
**Verdict:** Greenfield — English-only UI; no i18n library; no language preference storage.

## Findings

| Area | Status | Notes |
|------|--------|-------|
| Libraries | MISSING | No next-intl / i18next / formatjs |
| Locales directory | MISSING (pre-Wave-1) | To be created at `locales/` |
| `html lang` | HARDCODED | `app/layout.js` uses `lang="en"` |
| Open Graph locale | HARDCODED | `en_US` in metadata |
| Sidebar labels | HARDCODED | `components/Sidebar/Sidebar.js` |
| Admin sidebar | HARDCODED | `components/AdminSidebar/AdminSidebar.js` |
| Tax nav | HARDCODED | `components/tax/TaxManagementNav.js` |
| Auth pages | HARDCODED | `app/auth/*` |
| Emails | HARDCODED | email.js, emailService.js, subscriptionExpiryEmailService.js, userEmailResolve.js |
| PDFs | HARDCODED | fallback-text-pdf.js, invoice-pdf-generator.js, invoicePdfStorage.js, jspdfUtils.js, openingBalancePdf.js, payeSummaryPdf.js, posDailySalesPdf.js, receiptPdf.js, server-pdf-html.js, server-pdf-jspdf.js, server-pdf.js, simple-pdf-generator.js |
| User.preferredLanguage | MISSING | Prisma User model |
| TenantSettings.defaultLanguage | MISSING | Only `currencyCode` exists |
| Locale cookie | MISSING | Session cookie is auth-only |

## Classification

- System UI strings: TRANSLATE  
- User-entered masters (names, notes): DO_NOT_TRANSLATE  
- Account codes / document numbers: DO_NOT_TRANSLATE  
- Enums/statuses: TRANSLATE display labels only
