# Phase 13 Risk Register

| Risk | Mitigation |
|---|---|
| Legacy BF float forecasts diverge from V2 | Keep legacy read-only; recalculate via V2 for new cycles |
| Missing closed-period snapshots | Quality status LIMITED/UNSUITABLE; disclose gaps |
| localhost IPv6 Prisma P1001 | Use `127.0.0.1` in DATABASE_URL |
| AI auto-apply | Flag off by default; suggestion table only |
| Unbalanced projection approved | Integrity INVALID blocks approval |
| Demo opening BS used in UI pilot | Replace with snapshot opening in production pilots |
