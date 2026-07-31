# EIS Database Constraints

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Unique: entitlement(tenant,version); active setting(business); terminal(mraTerminalId); sequence(terminalId,businessDate); fiscalNumber; snapshot(sourceType,sourceId,sourceVersion); active transmission(snapshotId); accepted(snapshotId); attempt(transmissionId,n); offline(snapshotId).

FKs enforce same tenantId on related rows. No cross-tenant credential links. Accepted/queued snapshots immutable (app + optional DB triggers).

**Constraint count (core unique/FK rules):** ≥20 documented.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
