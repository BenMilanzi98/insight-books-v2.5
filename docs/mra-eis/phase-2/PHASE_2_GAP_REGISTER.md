# Phase 2 Gap Register

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

| Gap ID | Area | Deficiency | Severity | Blocking? | Phase |
|---|---|---|---|---|---|
| G2-001 | Idempotency | POS/Invoice lack server request idempotency | BLOCKER | Y | 3 |
| G2-002 | Outbox | AcctV2Outbox not drained; EIS not outbox-backed | BLOCKER | Y | 3 |
| G2-003 | Secrets | Terminal token in settings JSON plaintext | BLOCKER | Y | 3 |
| G2-004 | Entitlement | hasEISAccess wrong plan selection | BLOCKER | Y | 3 |
| G2-005 | Session | Tenant switch unsigned downgrade | BLOCKER | Y | 3 |
| G2-006 | Money | Float / no decimal lib for fiscal | CRITICAL | Y | 3 |
| G2-007 | Fiscal number | Legacy generator incompatible with MRA | BLOCKER | Y | 3+MRA |
| G2-008 | Message-hash | Unverified external | BLOCKER | Y | MRA |
| G2-009 | QR | Local verify URL ≠ MRA | HIGH | N for Phase 3 design | 3 |
| G2-010 | Mapping | No versioned product/tax maps | CRITICAL | Y | 3 |
| G2-011 | Terminal | No first-class terminal/site model | CRITICAL | Y | 3+MRA |
| G2-012 | Offline | Not certification-ready | CRITICAL | Y for offline | Cert |
| G2-013 | Permissions | No eis.* RBAC | HIGH | N | 3 |
| G2-014 | Approvals | Not wired | HIGH | N | 3 |
| G2-015 | Corrections | Void/refund not linked to MRA APIs | CRITICAL | Y for corrections | 3+MRA |
| G2-016 | Invoice EIS pay method | Hardcoded Bank Transfer | HIGH | Y | 3 |
| G2-017 | Ops secrets | docker-compose committed secrets | BLOCKER | Ops | Now |
| G2-018 | Dispatcher | No durable EIS worker | BLOCKER | Y | 3 |
| G2-019 | Snapshot | No immutable fiscal snapshot | BLOCKER | Y | 3 |
| G2-020 | Status model | EIS status overloaded vs accounting | HIGH | N | 3 |

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
