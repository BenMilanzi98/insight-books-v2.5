# Target Event Catalogue

**Catalogue version:** `analytics-events-2026-07-28`  
**Schema version default:** `1`

## Verified emitters (Phase 4)

| Event type | Source | Scope | Privacy |
|------------|--------|-------|---------|
| `TENANT_CREATED` | Tenant create | TENANT | INTERNAL |
| `TENANT_STATUS_CHANGED` | Tenant lifecycle | TENANT | INTERNAL |
| `SUBSCRIPTION_STARTED` | AccountSubscription activation | TENANT | FINANCE |
| `SUBSCRIPTION_RENEWED` | Renewal activation | TENANT | FINANCE |
| `SUBSCRIPTION_CANCELLED` | Cancel/expire paths when present | TENANT | FINANCE |
| `PLATFORM_INVOICE_ISSUED` | PlatformInvoice create | TENANT | FINANCE |
| `PLATFORM_PAYMENT_SUCCEEDED` | PlatformPayment COMPLETED | TENANT | FINANCE |
| `USER_LOGIN` | Tenant/admin login audit | TENANT or PLATFORM | PII |
| `ADMIN_LOGIN` | Admin auth login | PLATFORM | PII |

## Scaffold only (no production emit)

`LEAD_CREATED`, `LEAD_STAGE_CHANGED`, `LEAD_WON`, `DEMO_COMPLETED`, `PROPOSAL_SENT`, `SUPPORT_TICKET_CREATED`, `FEATURE_USED`, `POS_TRANSACTION_CREATED`, `SALES_INVOICE_CREATED`, `ONBOARDING_COMPLETED`

## Envelope

```text
eventType, schemaVersion, occurredAt, tenantId?,
sourceType, sourceId, idempotencyKey,
actorType, actorId, correlationId, requestId?,
privacyClass, payload (redacted)
```
