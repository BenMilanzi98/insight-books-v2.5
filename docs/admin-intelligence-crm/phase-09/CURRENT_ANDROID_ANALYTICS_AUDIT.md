# Current Android Analytics Audit

| Item | Class | Evidence |
|------|-------|----------|
| Product meaningful-action SDK | NOT_INSTRUMENTED | No Firebase/Amplitude-style feature events |
| Update/APK telemetry | READY (ops) | `insight_books_android/.../mobile_app_telemetry.dart` → `/api/mobile-app/telemetry` → `MobileAppClientEvent` |
| Allowed events | READY | version_check, download_*, install_* only |
| Bridge to AnalyticsEvent | NOT_INSTRUMENTED | — |
| Device fingerprinting | NOT_FOUND (must remain absent) | — |

**Disposition:** Android product DAU/first-value = NOT_INSTRUMENTED. Version distribution may use update telemetry with privacy limits. No invasive fingerprints.
