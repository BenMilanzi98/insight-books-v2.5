# Final Readiness Decision — English ↔ Chichewa i18n

**Date:** 2026-07-26  
**Decision:** **FOUNDATION + MODULE CATALOGUES SHIPPED** — bilingual shell is production-usable; Critical financial Chichewa remains English until glossary APPROVED; deep page-string extraction continues as residual work.

## Met

- Preference-based routing (`en` / `ny`), cookie `ib_locale`
- `User.preferredLanguage` + `TenantSettings.defaultLanguage` (schema + migration)
- Custom `lib/i18n` + 26 namespaces × 2 locales
- LanguageSwitcher on AppBar + login
- Sidebar + Tax nav + auth login labels
- Settings/Profile language card
- Route-based document titles
- Email welcome subject localisation hook
- Invoice PDF total label localisation hook
- Critical-key English fallback for accounting/tax/payroll/reversals/report.financial
- Automated tests 15/15

## Not claiming complete

- Every hardcoded string on all 203 pages replaced (catalogues + shell wired; residual page body strings remain English until progressive extraction)
- Human-approved financial Chichewa (status FINANCIAL_REVIEW_REQUIRED)
- Full email/PDF template rewrite for every template
- Visual regression matrix at all breakpoints

## Operator checklist

1. Ensure Postgres up; apply `20260726020000_user_tenant_language` if column missing
2. `npx prisma generate` if client lacks preferredLanguage
3. Smoke: login → switch Chichewa → sidebar/nav updates → refresh persists
4. Smoke: Critical accounting labels stay English until glossary approval
