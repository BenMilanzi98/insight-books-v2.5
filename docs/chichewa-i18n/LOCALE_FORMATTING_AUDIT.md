# Locale Formatting Audit

**Date:** 2026-07-26

Widespread `toLocaleString` / `toLocaleDateString` without fixed locale. Currency often MWK via tenant settings.

**Action:** Central `formatCurrency/Number/Date` in `lib/i18n/formatters.js` using `en-MW`/`ny-MW` for presentation only.
