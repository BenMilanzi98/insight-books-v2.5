# i18n Architecture

- Catalogues: `locales/{en,ny}/*.json`
- Server: `resolveRequestLocale`, `loadMessages`, `t`
- Client: `I18nProvider`, `useI18n()`
- Cookie: `ib_locale`
- User.preferredLanguage / TenantSettings.defaultLanguage
- Formatters: presentation only; currency from business
