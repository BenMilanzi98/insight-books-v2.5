# English ↔ Chichewa i18n — InsightBooks V2

**Status:** Wave-based delivery (audit → foundation → modules)  
**Locales:** `en` (English), `ny` (Chichewa)  
**Routing:** Preference-based (no locale URL prefixes)  
**Framework:** Custom thin layer in `lib/i18n` + JSON catalogues in `locales/{en,ny}/`

## Inventory snapshot (generated)

| Asset | Count |
|-------|------:|
| App Router pages | 203 |
| API route handlers | 799 |
| Components (js/jsx) | 165 |
| Email-related lib files | 4 |
| PDF-related lib files | 12 |
| Top-level app modules | 67 |

## Waves

0. Audit pack (this folder)  
1. Foundation (switcher, preferences, common/nav/auth)  
2–10. Module catalogues + wiring (see IMPLEMENTATION_PLAN.md)

## Safety

Language switching must never post journals, reverse documents, move stock, or alter amounts/currencies/permissions.
