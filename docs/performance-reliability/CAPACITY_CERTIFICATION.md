# Capacity Certification

**Status: NOT CERTIFIED**

Template for signing platform capacity after [CAPACITY_TEST_PLAN.md](./CAPACITY_TEST_PLAN.md) execution.

---

## Certification record

| Field | Value |
|---|---|
| Certification date | _PENDING_ |
| Environment | _e.g. staging replica of prod topology_ |
| Signed by | _Name / role_ |
| Valid until | _Re-certify on topology or major release change_ |

---

## Topology certified

| Parameter | Value |
|---|---|
| App processes | _PENDING_ |
| Node version | 20 |
| PostgreSQL version | 15 |
| `max_connections` | _PENDING_ |
| `connection_limit` per process | _PENDING_ |
| Workload profile | [WORKLOAD_MODEL.md](./WORKLOAD_MODEL.md) SME |

---

## Measured results (fill at test time only)

| Metric | MEASURED value |
|---|---|
| Max sustainable RPS | _PENDING_ |
| Posting p95 | _PENDING_ |
| TB p95 (warm cache) | _PENDING_ |
| Peak DB connections | _PENDING_ |
| Peak CPU % | _PENDING_ |

**Do not pre-fill numbers.**

---

## Correctness attestation

| Check | Result |
|---|---|
| duplicate_posting_count during test | Must be **0** |
| Post-soak TB balanced | _PENDING_ |

---

## Headroom

```
operating_rps = certified_max_rps × 0.70   (DRAFT policy)
```

---

## Sign-off

- [ ] Engineering lead
- [ ] Operations
- [ ] Accounting domain owner (correctness)

**Until signed: treat platform capacity as UNKNOWN.**

---

## Cross-links

- [BASELINE_PERFORMANCE_REPORT.md](./BASELINE_PERFORMANCE_REPORT.md)
- [PLATFORM_PERFORMANCE_READINESS.md](./PLATFORM_PERFORMANCE_READINESS.md)
