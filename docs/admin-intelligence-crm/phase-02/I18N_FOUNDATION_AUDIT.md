# i18n Foundation Audit

## Runtime

- Locales: `en`, `ny` (`lib/i18n/locales.js`)
- Provider: `I18nProvider` in `RootLayoutClient` (covers `/insightbooks`)
- Admin usage under `app/insightbooks`: **NONE FOUND** (hardcoded English)

## Locale files

`locales/en/administration.json` / `ny` — minimal keys only.

## Phase 2 action

1. Add namespaces: `admin-shell.json`, `admin-foundation.json` (en + ny)  
2. Extend `administration.json` for nav labels  
3. Wire AdminShell/Header/Sidebar/states to `useI18n` / `t()`  
4. Catalogue parity tests for new keys  
5. No hardcoded user-visible English in new foundation code  

## Non-goal

Do not translate every existing billing/MRA page string in Phase 2 — **foundation components + shell/nav** first; page migration can proceed incrementally with the same namespaces.
