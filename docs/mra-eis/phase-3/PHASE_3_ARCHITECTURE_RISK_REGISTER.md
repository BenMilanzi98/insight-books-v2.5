# Phase 3 Architecture Risk Register

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

| ID | Risk | Sev | Blocking phase |
|---|---|---|---|
| AR-001 | Message-hash unknown | CRITICAL | 13 |
| AR-002 | Fiscal number algorithm unreproduced | CRITICAL | 12 |
| AR-003 | SaaS terminal identity | CRITICAL | 7 |
| AR-004 | Activation timeout recovery | HIGH | 7 |
| AR-005 | Offline infeasible in browser | HIGH | 16 |
| AR-006 | Outbox dispatcher missing today | CRITICAL | 13 |
| AR-007 | POS idempotency gap | CRITICAL | 11 |
| AR-008 | Secret plaintext in settings | CRITICAL | 6 |
| AR-009 | Payment enum unknown | HIGH | 9/13 |
| AR-010 | Correction workflow gaps | HIGH | 15+ |
| AR-011 | Float money drift | HIGH | 12 |
| AR-012 | Multi-replica sequence race if misimplemented | CRITICAL | 12 |
| AR-013 | Certification delay | MED | 21 |
| AR-014 | hasEISAccess bug | HIGH | 4 |
| AR-015 | Tenant switch session downgrade | CRITICAL | 4 |

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
