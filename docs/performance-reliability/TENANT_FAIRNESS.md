# Tenant Fairness

Preventing noisy-neighbor effects in multi-tenant InsightBooks V2 on shared PostgreSQL.

---

## Problem

All tenants share:

- One PostgreSQL instance (typical)
- One Node process pool
- Prisma connection pool

A large tenant running month-end reports can starve others (BN-14).

---

## Current mitigations

| Mechanism | Scope | Limitation |
|---|---|---|
| Tenant scoping in queries | All accounting services | Correctness, not fairness |
| Report cache | Per tenant/business | Helps repeat reads only |
| Rate limit (login) | Per IP/key | In-memory, not tenant-weighted |

---

## Target mitigations (`lib/performanceReliability/`)

| Guard | Behavior (DRAFT) |
|---|---|
| Per-tenant concurrent report cap | Queue or 429 when > N simultaneous heavy reports |
| Per-tenant posting throttle | Soft limit under extreme load |
| Fair queue ordering | FIFO across tenants for background jobs |

**Status:** IN PROGRESS — see [PHASE_17_TASKS.md](./PHASE_17_TASKS.md) P17-PR-E.

---

## SLI

| Metric | Use |
|---|---|
| `tenant_request_duration_p95` | Compare top decile vs median tenant |
| `tenant_throttled_total` | Fairness guard activations |

---

## Load test

[LOAD_TEST_PLAN.md](./LOAD_TEST_PLAN.md) multi-tenant scenario:

- Tenant A: 5× report load
- Tenant B: steady posting
- **Pass:** Tenant B p95 degradation < 2× baseline (DRAFT threshold)

---

## Policy

Fairness optimizations **must not** skip tenant filters or share cache keys across tenants.

---

## Cross-links

- [BACKPRESSURE.md](./BACKPRESSURE.md)
- [quality-assurance/MULTI_TENANT_ISOLATION_MATRIX.md](../quality-assurance/MULTI_TENANT_ISOLATION_MATRIX.md)
