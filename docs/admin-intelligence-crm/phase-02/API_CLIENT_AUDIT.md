# API Client Audit

## Current

Widespread `fetch('/api/admin/...', { credentials: 'include' })` with no shared timeout, correlation header, or typed errors.

## Target: `lib/admin/adminApi.js`

| Concern | Behaviour |
|---------|-----------|
| Credentials | `include` |
| Correlation | Send `x-correlation-id` (generate UUID if absent) |
| JSON | Parse; support envelope + legacy |
| Errors | Throw `AdminApiError` with code, status, correlationId, messageKey |
| Mutations | Optional Idempotency-Key header helper |
| Scope | Caller passes/expects `meta.scope` — client does not invent unscoped fallbacks |

## Non-goals

No React Query mandate unless already in repo; keep lightweight hook `useAdminQuery` optional.
