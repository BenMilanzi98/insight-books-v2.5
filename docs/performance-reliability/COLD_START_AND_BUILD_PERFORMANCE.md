# Cold Start and Build Performance

**Purpose:** Deploy and container startup latency.

**Current:** Multi-stage Dockerfile (`node:20-alpine`); `npm run build` includes `prisma generate`; standalone Next output.

**Observations:** First request after deploy compiles routes; Prisma connects on first query.

**Status:** PENDING measurement — not a user SLO unless serverless.

**Mitigation:** Warm `/ready` after deploy; PM2 wait_ready (future).

**Links:** [GRACEFUL_SHUTDOWN.md](./GRACEFUL_SHUTDOWN.md), [HEALTH_CHECKS.md](./HEALTH_CHECKS.md)
