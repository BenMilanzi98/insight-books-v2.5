# Cost and Capacity Analysis

Relating infrastructure cost to certified capacity. **No dollar figures until deployment choices are fixed.**

---

## Variables

| Input | Source |
|---|---|
| Certified max RPS | [CAPACITY_CERTIFICATION.md](./CAPACITY_CERTIFICATION.md) |
| Target utilization | 70% of certified max (DRAFT) |
| vCPU / RAM / disk | Hosting bill |
| Backup storage | RPO policy |

---

## Analysis template

```
monthly_cost = compute + db + storage + backup + egress
cost_per_1k_requests = monthly_cost / (avg_rps × 2592000 / 1000)
headroom_rps = certified_max × 0.3
```

Fill with **MEASURED** RPS after capacity test — do not invent.

---

## Trade-offs

| Choice | Cost ↓ | Risk ↑ |
|---|---|---|
| Single node | Yes | HA, noisy neighbor |
| Larger PG vs read replica | Replica adds cost | Read latency on primary |
| Report cache vs bigger CPU | Cache cheaper at repeat reads | Stale logic complexity |

---

## Review

Quarterly with [WORKLOAD_MODEL.md](./WORKLOAD_MODEL.md) updates.

---

## Cross-links

- [CAPACITY_MODEL.md](./CAPACITY_MODEL.md)
- [SCALING_STRATEGY.md](./SCALING_STRATEGY.md)
