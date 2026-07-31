# Unknown Outcome Recovery Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

On timeout/reset/crash after dispatch: mark UNKNOWN_OUTCOME → reconcile via last-online (and get-invoice-by-number) → match fiscal# + terminal + TIN + site + date + totals + config versions (+ checksum) → ACCEPTED or safe retry same snapshot/number → else MANUAL_REVIEW.

Never allocate new fiscal number solely because response lost.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
