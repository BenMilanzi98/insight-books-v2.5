# Entitlement and Operational State Machines

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

## Tenant entitlement

`NOT_ENTITLED → ENTITLEMENT_PENDING → ENTITLED_SANDBOX_ONLY → ENTITLED_PRODUCTION` · `SUSPENDED` · `REVOKED` · `EXPIRED`

Actors: System Admin for grant/suspend/revoke/prod; audit + reason required.

## Business operational (tenant=business)

`UNAVAILABLE → AVAILABLE → SETUP_* → READY_FOR_ACTIVATION → ACTIVE → PAUSED → DISABLING_AFTER_QUEUE → DISABLED` · `DEGRADED` · `BLOCKED_BY_MRA` · `SUSPENDED_BY_SYSTEM` · `ERROR`

Precedence: Platform kill > System suspension > Entitlement > Environment > Operational setting > Terminal/block/config/mappings.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
