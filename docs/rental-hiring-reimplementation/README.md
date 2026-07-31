# Rental & Hiring — Forensic Audit & Reimplementation

**Date:** 2026-07-25  
**Status:** V2 programme **engineering complete** — see [FINAL_READINESS_DECISION.md](./FINAL_READINESS_DECISION.md). Ready for next workstream; ops may disable legacy booking after pilot.

## Critical terminology finding (read first)

| Nav label | Current code meaning | Master-prompt target |
|-----------|----------------------|----------------------|
| **Rentals** (`kind=rental`) | Outbound single-unit booking (rooms/spaces/equipment) → **Customer Invoice + Revenue** | Outbound Customer rentals (provider/lessor) |
| **Hiring** (`kind=hiring`) | Outbound **quantity-pool** booking to a **Client** → same Invoice/Revenue path | **Inbound** Supplier hire → Expense / AP |

Current “Hiring” is **not** supplier hiring. It is a second outbound rental mode. Inbound Hire Requests, Hire Orders, Supplier Bills, and Hire Expense accounting **do not exist**.

See [RENTAL_DOMAIN_DEFINITION.md](./RENTAL_DOMAIN_DEFINITION.md) and [HIRING_DOMAIN_DEFINITION.md](./HIRING_DOMAIN_DEFINITION.md).

## Audit pack (section 3)

| Document | Purpose |
|----------|---------|
| [CURRENT_IMPLEMENTATION_AUDIT.md](./CURRENT_IMPLEMENTATION_AUDIT.md) | Executive summary |
| [ROUTE_AND_COMPONENT_INVENTORY.md](./ROUTE_AND_COMPONENT_INVENTORY.md) | Routes / UI |
| [DATABASE_MODEL_AUDIT.md](./DATABASE_MODEL_AUDIT.md) | Prisma models |
| [RENTAL_WORKFLOW_AUDIT.md](./RENTAL_WORKFLOW_AUDIT.md) | Outbound lifecycle |
| [HIRING_WORKFLOW_AUDIT.md](./HIRING_WORKFLOW_AUDIT.md) | Current vs target hiring |
| [RENTAL_AVAILABILITY_AUDIT.md](./RENTAL_AVAILABILITY_AUDIT.md) | Availability engine |
| [RENTAL_PRICING_AUDIT.md](./RENTAL_PRICING_AUDIT.md) | Pricing |
| [RENTAL_BILLING_AUDIT.md](./RENTAL_BILLING_AUDIT.md) | Billing |
| [DEPOSIT_ACCOUNTING_AUDIT.md](./DEPOSIT_ACCOUNTING_AUDIT.md) | Deposits |
| [HIRE_ACCOUNTING_AUDIT.md](./HIRE_ACCOUNTING_AUDIT.md) | Inbound hire GL |
| [ASSET_INTEGRATION_AUDIT.md](./ASSET_INTEGRATION_AUDIT.md) | Asset Register |
| [INVENTORY_INTEGRATION_AUDIT.md](./INVENTORY_INTEGRATION_AUDIT.md) | Inventory |
| Risk registers | Booking / billing / posting / integrity / tenant / security |
| [PERMISSION_AUDIT.md](./PERMISSION_AUDIT.md) | Permissions |
| [REPORT_AUDIT.md](./REPORT_AUDIT.md) | Reports |
| [TEST_COVERAGE_AUDIT.md](./TEST_COVERAGE_AUDIT.md) | Tests |
| [FINAL_GAP_REGISTER.md](./FINAL_GAP_REGISTER.md) | Prioritised gaps |
| [REIMPLEMENTATION_PLAN.md](./REIMPLEMENTATION_PLAN.md) | Phased plan |
| [RENTAL_HIRING_ACCOUNTING_POSTING_MATRIX.md](./RENTAL_HIRING_ACCOUNTING_POSTING_MATRIX.md) | Target journals |
| [IMPLEMENTATION_TASKS.md](./IMPLEMENTATION_TASKS.md) | Checklist |

## Go / No-go

| Question | Answer |
|----------|--------|
| Audit complete? | **Yes** |
| Safe to claim production rental/hire acceptance? | **No** |
| Safe to start Foundation code? | **Yes, after stakeholder approval** of gap register + plan (especially terminology rename for inbound Hiring) |
