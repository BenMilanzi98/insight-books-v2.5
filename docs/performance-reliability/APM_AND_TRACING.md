# APM and Tracing

**Purpose:** Distributed traces for request → Prisma → PostgreSQL path.

**Current:** Console logging; accounting logger in `lib/accountingV2/observability/accountingLogger.js`.

**Target:** OpenTelemetry SDK; W3C `traceparent` on API routes; sample rate 10% in prod (DRAFT).

**Status:** NOT STARTED.

**Links:** [PRODUCTION_OBSERVABILITY.md](./PRODUCTION_OBSERVABILITY.md), [REQUIRED_METRICS.md](./REQUIRED_METRICS.md)
