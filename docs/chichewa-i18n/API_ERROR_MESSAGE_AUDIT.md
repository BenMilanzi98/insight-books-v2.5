# API Error Message Audit

**Date:** 2026-07-26

Many routes return `{ error: "..." }` English only. Middleware returns "Permission denied".

**Action:** Prefer `{ code, messageKey, details }` while keeping `error` English fallback for clients (Wave 1 errors namespace; expand per module).
