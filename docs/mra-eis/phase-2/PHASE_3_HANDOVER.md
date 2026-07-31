# Phase 3 Handover

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

## Summary

InsightBooks can integrate EIS as a **post-accounting compliance bridge** if: (a) finalize becomes atomic with snapshot+outbox, (b) credentials/terminals are redesigned, (c) Phase 1 crypto/numbering clarifications land, (d) durable worker exists.

## Reuse

Accounting V2 posting/idempotency · Tenant=Business model · Branch · encrypt() · subscription plans · receipt/QR libs · SecV2 audit · cron auth pattern

## Extend

Outbox+dispatcher · entitlement evaluation · PrintableReceipt states · EISSubmissionLog redaction · RBAC

## Reimplement / replace

eisService fiscal path · invoice number generator · credential model · product/tax maps · transmission worker

## Recommended boundaries

| Boundary | Recommendation |
|---|---|
| Event | SALE_FISCALIZATION_ELIGIBLE after posting in finalize tx |
| Snapshot | Immutable row keyed by source+version |
| Outbox | Same tx as snapshot |
| Worker | Durable poller/claimer; reconcile-before-retry |
| Credentials | Server-only encrypted; never browser |
| Receipt | Show pending until ACCEPTED / certified offline |

## External blockers (Phase 1)

Message-hash · fiscal Base64 examples · SaaS terminal identity · offline KAT · refund/return matrix · auth header format

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
