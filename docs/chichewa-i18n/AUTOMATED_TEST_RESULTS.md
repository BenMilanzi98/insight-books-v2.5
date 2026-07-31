# Automated Test Results — English ↔ Chichewa i18n

**Date:** 2026-07-26

| Suite | Result |
|-------|--------|
| `test/i18n.foundation.test.js` | PASS |
| `test/i18n.catalogueParity.test.js` | PASS |
| `test/i18n.valueParity.test.js` | PASS |
| Combined | **15/15 PASS** |

## Command

```bash
npx vitest run test/i18n.foundation.test.js test/i18n.catalogueParity.test.js test/i18n.valueParity.test.js
```

## Covered

- Locale resolution (cookie → user → tenant → Accept-Language → en)
- Unsupported locale coercion
- en/ny catalogue key parity (all namespaces)
- Critical financial keys force English until APPROVED
- Currency formatting parity (no conversion)
- LanguageSwitcher does not import posting engine
