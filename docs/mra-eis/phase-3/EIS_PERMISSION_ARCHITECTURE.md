# EIS Permission Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

System: `system.eis.*` (view, entitlement grant/suspend/revoke, certification, production.enable, emergency.pause, support).

Tenant: `eis.view|setup|enable|pause|terminal.*|configuration.*|site.map|product.*|tax.*|paymentMethod.map|transactions.*|offline.view|reports.*|audit.view|manualReview.resolve`

Enforce server-side on API/services/workers/exports. Replace coarse `reports.view` gate for /eis.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
