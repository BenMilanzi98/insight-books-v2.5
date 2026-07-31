# Phase 15 — Security & Governance

Phase 15 establishes a platform-wide security and governance layer for InsightBooks: authenticated actor context, authorization policy, separation of duties, approvals, immutable audit, and monitoring — without replacing module-specific business logic in Phases 1–14.

**Status:** Foundation documentation (this folder) — **IN_PROGRESS**. Implementation code lives under `lib/securityGovernance/` (scaffold pending).

## Scope

| In scope | Out of scope (prior phases) |
|---|---|
| Session integrity, revocation, MFA enforcement | Accounting posting rules (Phases 2–4) |
| Unified middleware RBAC catalogue incl. module API prefixes | Module domain validation (per-module services) |
| Cross-module SoD and approval orchestration | Chart of accounts structure (Phase 3) |
| Append-only audit and security event stream | Report generation logic (Phase 7) |
| Upload access control and signed URLs | Bank recon matching algorithms (Phase 10) |
| AI governance gates platform-wide | Loan readiness scoring model (Phase 14) |
| Service-account / integration identity model | |

## Evidence basis

All findings reference verified repo paths and IDs from Phases 1–14 audits. Primary sources:

- `docs/accounting-audit/MULTI_TENANT_AND_SECURITY_AUDIT.md` — SEC-1..4, TEN-001..003
- `docs/accounting-audit/RISK_REGISTER.md` — R-19..21
- `docs/accounting-architecture/ARCHITECTURE_DECISIONS.md` — ADR-005
- `docs/accounting-posting-engine/PHASE_1_TO_3_EVIDENCE_INDEX.md` — P2-02
- Module readiness notes (e.g. `docs/loan-readiness/PHASE_15_READINESS.md`)

## Document index

| Document | Purpose |
|---|---|
| [PHASE_1_TO_14_EVIDENCE_INDEX.md](./PHASE_1_TO_14_EVIDENCE_INDEX.md) | Cross-phase security evidence table |
| [CURRENT_SECURITY_ARCHITECTURE.md](./CURRENT_SECURITY_ARCHITECTURE.md) | As-built auth, authz, audit, gaps |
| [SECURITY_DATA_FLOW_MAP.md](./SECURITY_DATA_FLOW_MAP.md) | Current vs target control flow (mermaid) |
| [SECURITY_CONTROL_GAP_REGISTER.md](./SECURITY_CONTROL_GAP_REGISTER.md) | GAP-SEC-001+ with remediation owners |
| [THREAT_MODEL.md](./THREAT_MODEL.md) | STRIDE-style threat catalogue (20+) |
| [PHASE_15_TASKS.md](./PHASE_15_TASKS.md) | Workstreams A–CG with status |
| [TARGET_SECURITY_ARCHITECTURE.md](./TARGET_SECURITY_ARCHITECTURE.md) | Target `lib/securityGovernance/` design |
| [ROLLBACK_STRATEGY.md](./ROLLBACK_STRATEGY.md) | Feature flags, rollout, revert paths |
| [PHASE_16_READINESS.md](./PHASE_16_READINESS.md) | Blockers before compliance / ops hardening phase |

## Implementation module path

```
lib/securityGovernance/
├── domain/           # ActorContext, PolicyDecision, ApprovalRequest
├── application/      # Policy engines, approval orchestrator, audit writer
├── infrastructure/   # Session store, signed tokens, rate-limit adapters
└── api/              # Shared guards consumed by route handlers
```

Module route guards added in Phases 2–14 (`lib/accountingV2/api/routeGuard.js`, `lib/coaV2/api/routeGuard.js`, `lib/equityManagement/api/routeGuard.js`, etc.) remain in place during transition. Phase 15 introduces a **facade** that centralizes policy evaluation; modules delegate to it rather than duplicating SoD and approval rules.

## Related code (current)

| Area | Path |
|---|---|
| Tenant session (base64 JSON cookie) | `lib/sessionCookie.js`, `app/api/auth/login/route.js` |
| Session resolution + RBAC | `lib/auth.js` |
| Middleware + API/page guards | `middleware.js`, `lib/tenantApiAccess.js`, `app/api/auth/api-guard/route.js` |
| Multi-business role override | `prisma/schema.prisma` → `TenantMembership`, `lib/auth.js` → `applyTenantMembershipRole` |
| Admin panel auth (signed JWT) | `app/api/admin/auth/login/route.js`, cookie `admin_token` |
| V2 accounting guard | `lib/accountingV2/api/routeGuard.js` |
| CoA V2 guard | `lib/coaV2/api/routeGuard.js` |
| Module-specific guards | `lib/accountingClose/api/routeGuard.js`, `lib/bankReconciliation/api/routeGuard.js`, `lib/equityManagement/api/routeGuard.js`, `lib/financialPlanning/api/routeGuard.js`, `lib/loanReadiness/api/routeGuard.js` |
| Soft authz audit mode | `lib/auth.js` → `AUTHZ_AUDIT_MODE` |
| Tenant audit log (mutable) | `prisma/schema.prisma` → `AuditLog` |
| Public upload serving | `middleware.js` (skip), `next.config.mjs`, `app/api/uploads/[...path]/route.js` |

## Conventions

- Finding IDs **SEC-1..4**, **R-19..21**, **TEN-001..003**, **ADR-005**, **P2-02** are reused from prior phases — no new aliases.
- Gap IDs use prefix **GAP-SEC-** (Phase 15 register).
- Threat IDs use prefix **THR-** (Phase 15 threat model).
- Internal docs may reference V2 module paths; user-facing product names omit version suffixes.
