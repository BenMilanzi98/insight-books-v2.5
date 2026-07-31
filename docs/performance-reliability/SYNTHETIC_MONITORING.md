# Synthetic Monitoring

**Purpose:** External probes for availability independent of app self-metrics.

**Target probes:**
- `/api/system/live` every 60s
- `/api/system/ready` every 60s
- Optional: login + TB smoke script hourly

**Status:** NOT STARTED — depends on [HEALTH_CHECKS.md](./HEALTH_CHECKS.md) rollout.

**Links:** [ALERTING.md](./ALERTING.md), [SERVICE_LEVEL_INDICATORS.md](./SERVICE_LEVEL_INDICATORS.md)
