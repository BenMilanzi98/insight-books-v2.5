# Scaling Strategy

Vertical and horizontal scaling path for InsightBooks V2.

---

## Phase 1 — Vertical (current)

| Action | When |
|---|---|
| Increase VPS CPU/RAM | CPU > 70% sustained |
| Raise PG `shared_buffers`, `work_mem` | Buffer hit ratio low |
| Tune `connection_limit` | Pool waits |

**Limit:** Single host ceiling.

---

## Phase 2 — Horizontal app

| Action | Requirement |
|---|---|
| PM2 cluster or multiple containers | Stateless app |
| Sticky sessions **or** shared session store | Auth |
| Shared rate limit (Redis) | Fair 429 across instances |
| Load balancer health on `/ready` | Drain |

---

## Phase 3 — Database read scale

| Action | Notes |
|---|---|
| Read replica | Route CP-10..14 reads only |
| PgBouncer | Transaction pooling for many app instances |
| Keep writes on primary | Posting always primary |

See [READ_REPLICA_STRATEGY.md](./READ_REPLICA_STRATEGY.md).

---

## Phase 4 — Platform scale

- Partition largest tenants (future)
- Async report generation queue
- CDN for static assets — [CDN_AND_STATIC_DELIVERY.md](./CDN_AND_STATIC_DELIVERY.md)

---

## What not to scale away

- Idempotency checks
- Transaction boundaries
- Tenant scoping

---

## Cross-links

- [COST_AND_CAPACITY_ANALYSIS.md](./COST_AND_CAPACITY_ANALYSIS.md)
- [HIGH_AVAILABILITY_ARCHITECTURE.md](./HIGH_AVAILABILITY_ARCHITECTURE.md)
