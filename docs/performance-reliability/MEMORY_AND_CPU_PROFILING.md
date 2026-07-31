# Memory and CPU Profiling

**Purpose:** Diagnose leaks and hot CPU paths after soak tests.

**Tools:** Node `--inspect`, clinic.js, `process.memoryUsage()` metrics from [REQUIRED_METRICS.md](./REQUIRED_METRICS.md).

**Trigger:** [SOAK_TEST_PLAN.md](./SOAK_TEST_PLAN.md) memory growth alert.

**Focus areas:** Large report JSON buffers, Excel export, unbounded array loads.

**Status:** PENDING — run during first 24h soak.

**Links:** [PERFORMANCE_BOTTLENECK_REGISTER.md](./PERFORMANCE_BOTTLENECK_REGISTER.md) BN-13
