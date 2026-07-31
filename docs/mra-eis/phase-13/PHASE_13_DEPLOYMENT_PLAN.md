# PHASE 13 DEPLOYMENT PLAN

Deploy app; ensure MRA_EIS_USE_MOCK=1 for non-prod; do not set ALLOW_LEGACY_DIRECT_SALES; do not enable live Sales.

---
*Phase 13 implementation. Online Sales transmission over immutable fiscal snapshots. HTTP 200 alone is not acceptance. Production/live sandbox blocked until x-eis-message-hash and success codes verified. No QR image or final fiscal receipt. No Journal/Stock Movement. Legacy eisService.submitInvoice disabled (410) unless MRA_EIS_ALLOW_LEGACY_DIRECT_SALES=1.*
