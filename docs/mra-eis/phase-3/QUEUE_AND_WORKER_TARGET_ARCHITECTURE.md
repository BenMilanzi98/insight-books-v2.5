# Queue and Worker Target Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Workers: snapshot finalize (if needed), online transmit, reconcile, config sync, product sync, offline upload, receipt update, daily recon, token expiry, unblock poll, alerts, reports.

Assume at-least-once; idempotent handlers; restore tenant+terminal context; bounded concurrency; tenant fairness; dead-letter; graceful shutdown.

Deployment: durable DB-backed queue (not browser IndexedDB; not only Vercel cron). Cron may wake poller.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
