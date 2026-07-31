# Phase 2 Risk Register

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

| Risk ID | Description | P | I | Sev | Blocking |
|---|---|---|---|---|---|
| R2-001 | Duplicate POS sales → duplicate fiscal attempts | H | H | CRITICAL | Y |
| R2-002 | Post-commit EIS loss on crash | H | H | CRITICAL | Y |
| R2-003 | Secret leakage via settings/logs/backups | M | H | CRITICAL | Y |
| R2-004 | Multi-replica fiscal number race | H | H | CRITICAL | Y |
| R2-005 | Tax/total mismatch MRA reject | H | H | HIGH | Y |
| R2-006 | SaaS MAC/terminal rejection | H | H | CRITICAL | Y |
| R2-007 | Offline misuse of browser queue | M | H | HIGH | Y |
| R2-008 | Historical backfill without MRA approval | M | H | HIGH | Y |
| R2-009 | Entitlement false negative/positive | H | M | HIGH | Y |
| R2-010 | Session confusion across tenants | M | H | CRITICAL | Y |

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
