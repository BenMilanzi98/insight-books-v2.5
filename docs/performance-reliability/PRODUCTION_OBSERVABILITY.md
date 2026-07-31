# Production Observability

Observability stack for InsightBooks V2 in production.

---

## Pillars

| Pillar | Implementation | Status |
|---|---|---|
| **Metrics** | `lib/performanceReliability/` + [REQUIRED_METRICS.md](./REQUIRED_METRICS.md) | IN PROGRESS |
| **Logs** | Structured JSON (route, tenantId, durationMs, requestId) | Partial — console today |
| **Traces** | W3C trace context | NOT STARTED — [APM_AND_TRACING.md](./APM_AND_TRACING.md) |
| **Synthetic** | Periodic `/api/system/ready` | NOT STARTED — [SYNTHETIC_MONITORING.md](./SYNTHETIC_MONITORING.md) |

---

## Collection architecture (target)

```
Next.js app → metrics middleware → Prometheus scrape / OTLP
              ↓
         structured logs → log aggregator
              ↓
         PostgreSQL → pg_stat_statements, exporter
```

No vendor locked in — document chosen stack in ops runbook when deployed.

---

## Environment variables (DRAFT)

| Var | Purpose |
|---|---|
| `METRICS_ENABLED` | Toggle instrumentation |
| `LOG_LEVEL` | info / warn / error |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Optional traces |

---

## Security

- Never log passwords, tokens, full payment payloads
- Redact `DATABASE_URL` in diagnostics
- Tenant IDs acceptable in logs for support (policy-dependent)

---

## Cross-links

- [OBSERVABILITY_DASHBOARDS.md](./OBSERVABILITY_DASHBOARDS.md)
- [ALERTING.md](./ALERTING.md)
- [accounting-posting-engine/OBSERVABILITY_GUIDE.md](../accounting-posting-engine/OBSERVABILITY_GUIDE.md)
