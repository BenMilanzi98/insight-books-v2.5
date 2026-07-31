# Event Tracking Audit

**Audited:** 2026-07-28

## Findings

| Question | Answer | Evidence |
|----------|--------|----------|
| Dedicated AnalyticsEvent / product BI event store? | **No** | Schema search |
| Mobile client telemetry? | **Partial** | `MobileAppClientEvent` — Android OTA/client only, not CRM/product adoption |
| AdminActivityLog model? | **Schema only / unused** | Zero JS writers found |
| Product feature usage events? | **Not first-class** | No event catalogue service for admin BI |
| Login / audit style events? | **Partial** | `auditLog` used in dashboard stats for `USER_LOGIN`; `AdminAuditLog` for admin actions |
| PayChangu / billing events? | **Operational writes** | Callbacks mutate subscriptions/payments — not an append-only analytics stream |
| MRA EIS domain events? | **Partial** | EIS control audit / outbox patterns inside `lib/mraEis` — compliance-scoped |
| Marketing pixel / attribution events? | **None found** | Landing WhatsApp CTA only |

## Classification

| Item | Class |
|------|-------|
| AdminAuditLog | `REUSE` for security/compliance intelligence |
| Tenant auditLog login counts | `REUSE` carefully (definition of DAU) |
| Future AnalyticsEvent | `INSTRUMENTATION_REQUIRED` |
| Using Sale rows as “engagement” | `UNSAFE` for product analytics |

## Event catalogue (proposed — future)

Idempotent events with `eventId`, `tenantId`, `actorType`, `name`, `occurredAt`, `payload`, `ingestHash`:

- `tenant.created` · `subscription.activated` · `subscription.expired`  
- `payment.succeeded` · `invoice.issued`  
- `user.login` · `feature.used`  
- `lead.created` · `lead.stage_changed` · `lead.converted` (CRM phases)

Do not implement in Phase 1.
