# Timeout Policy

Timeout boundaries for InsightBooks V2 API and infrastructure.

---

## HTTP server (Next.js)

| Route class | Suggested timeout (DRAFT) | Rationale |
|---|---|---|
| Posting (CP-01) | 30 s | Full DB transaction |
| Reports (CP-12/13) | 60 s | Large aggregation; future async export |
| Ledger list | 15 s | Paginated |
| Health `/live` | 1 s | Process only |
| Health `/ready` | 5 s | Includes DB ping |
| Cron routes | 300 s | Batch jobs |

Platform default (Vercel/serverless) may differ — document per host.

---

## Database (Prisma)

| Setting | Guidance |
|---|---|
| `pool_timeout` | 10 s in `DATABASE_URL` when explicitly configured |
| Statement timeout | Set per-session for report queries (DRAFT 45s) via `SET statement_timeout` |
| Transaction timeout | Align with posting route timeout |

---

## External integrations

| Integration | Timeout (DRAFT) |
|---|---|
| Email SMTP | 30 s |
| Payment gateway | 15 s |
| Google OAuth | 10 s |

---

## Client (browser / mobile)

- UI should show progress for reports > 3 s
- Cancel in-flight fetch on navigation (AbortController)

---

## Interaction with retries

Total user-visible wait ≤ `(timeout × attempts)` — cap retries per [RETRY_POLICY.md](./RETRY_POLICY.md).

---

## Cross-links

- [BACKPRESSURE.md](./BACKPRESSURE.md)
- [GRACEFUL_SHUTDOWN.md](./GRACEFUL_SHUTDOWN.md)
