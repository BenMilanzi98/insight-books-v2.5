# EIS Idempotency Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Unique keys: entitlement version · activation attempt · config(type,version) · sync cursor · snapshot(sourceType,sourceId,sourceVersion,policyVersion) · fiscalNumber · transmission(snapshotId,mode) · attempt(transmissionId,n) · offline(snapshotId,sigVersion) · recon(run)

SAME KEY + SAME PAYLOAD → return existing; SAME KEY + DIFFERENT PAYLOAD → conflict error.

DB constraints mandatory; app checks insufficient.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
