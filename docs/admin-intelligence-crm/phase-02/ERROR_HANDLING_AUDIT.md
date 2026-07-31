# Error Handling Audit

## Current

Admin pages use mixed patterns: raw `fetch`, local try/catch, `AdminErrorState` with ad-hoc messages.

## Target envelope (foundation)

```json
{
  "ok": false,
  "error": {
    "code": "ADMIN_FORBIDDEN",
    "messageKey": "admin-foundation.errors.forbidden",
    "message": "…",
    "details": {},
    "correlationId": "…"
  }
}
```

Success:

```json
{
  "ok": true,
  "data": {},
  "meta": { "correlationId": "…", "scope": "PLATFORM_GLOBAL" }
}
```

## Phase 2

- `lib/admin/apiEnvelope.js` helpers for routes that opt in
- Client `adminApi` parses envelope; falls back for legacy JSON
- Map HTTP 401/403/500 to foundation error states via `messageKey`
- Do not rewrite all existing admin APIs in this phase — **new helpers + migrate shell-critical calls**
