# Current Release Analytics Audit

| Item | Class | Evidence |
|------|-------|----------|
| Release / app version catalogue for product analytics | NOT_FOUND | — |
| Android update version telemetry | READY (narrow) | `MobileAppClientEvent` version_check/download/install |
| Feature flag rollout visibility | INCOMPLETE | Admin flags ≠ staged product rollout analytics |
| Web app version on AnalyticsEvent | NOT_INSTRUMENTED | — |

**Disposition:** Release adoption UNAVAILABLE until version fields exist on meaningful events; Android update telemetry may feed version distribution only (not feature value).
