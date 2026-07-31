# Language Resolution Policy

1. `ib_locale` cookie (explicit switch)
2. `User.preferredLanguage`
3. `TenantSettings.defaultLanguage`
4. Guest `ib_locale` (same cookie)
5. `Accept-Language` if en/ny
6. Fallback `en`
