# Final Phase 2 Report

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

## 1. Executive summary

Phase 2 forensically mapped InsightBooks for MRA EIS. Tenant equals Business. POS and Invoice finalize inventory and accounting inside a Prisma transaction, then call legacy `eisService.submitInvoice` after commit (best-effort). Accounting V2 provides strong posting idempotency and an outbox write path without a dispatcher. QR codes verify locally, not via MRA. Multiple blockers prevent safe production fiscalization. Decision: **READY_FOR_PHASE_3_WITH_BLOCKERS**.

## 2. Phase boundary

Audit/documentation only. No MRA calls, credentials, fiscal submits, validated receipts, or accounting rewrites.

## 3–6. Runtime

Next.js 16 + React 19 + Prisma 6 + PostgreSQL + Vitest. Docker/Vercel/PM2. Single app.

## 7–14. Tenancy & entitlement

Tenant=Business; Branches; InventoryLocation; multi-tenant users. Entitlement via EIS plans + eisEnabled with **hasEISAccess defect**.

## 15–35. POS / Invoice / corrections

Documented in POS_*/SALES_INVOICE_* / comparison. Recommended event SALE_FISCALIZATION_ELIGIBLE. Payments must not re-fiscalize. Corrections exist locally without MRA linkage.

## 36–50. Customer / product / tax / payment / inventory / journals

Mapping gaps; Float tax risk; free-string payments; local stock authority; V2 journals with source links; periods exist.

## 51–58. Outbox / queue / idempotency / concurrency / retry

Outbox undrained; no durable EIS queue; POS idempotency weak; multi-replica sequencing risk; EIS retries not reconcile-first.

## 59–73. Receipt / QR / auth / secrets / observability

qrcode.react ready for URL swap; secrets gaps; RBAC incomplete; SecV2 unused for EIS; observability thin.

## 74–84. Existing EIS / data / integrity / offline / deploy

Legacy EIS present (UNSAFE/REPLACE for fiscal path). No EFD module. Offline PARTIALLY_READY only. Terminal identity unresolved for SaaS.

## 85–91. Tests / reusability / events / snapshot / states / retention

See dedicated docs. Baseline commands executed in Phase 2 completion pass.

## 92–97. Gaps / risks / Phase 3

See PHASE_2_GAP_REGISTER, PHASE_2_RISK_REGISTER, PHASE_3_*.

## 98–101. Confirmations

- No MRA API call
- No real credential added
- No posted Journal modified
- No historical Sale submitted

## 102–103. Decision & conclusion

**READY_FOR_PHASE_3_WITH_BLOCKERS.** Design may proceed; production fiscalization must wait for internal remediations and Phase 1 clarifications.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
