# Product Analytics Phase 9 — Design

**Status:** Approved (conversation 2026-07-29); Wave 0 first  
**Date:** 2026-07-29  
**Surface:** `/insightbooks/intelligence/product-analytics`  
**Architecture:** Approach B — dual Product Catalogue + Product Analytics; events via Phase 4 plane

---

## 1. Purpose

Deliver a **versioned, privacy-preserving Product Analytics workbench** that answers activation, first value, adoption, engagement, funnels, cohorts, entitlement utilisation, MRA EIS product stages, and Android analytics — using **server-verified meaningful actions only**, never vanity page views or login-as-activation.

---

## 2. Locked decisions

| Topic | Decision |
|-------|----------|
| Sequencing | Wave 0 forensic audits + matrices before code |
| Uninstrumented sources | **Strict events only** — domain tables are *candidate* evidence in matrices; live metrics stay `NOT_INSTRUMENTED` until idempotent producers exist |
| Taxonomy | **Repo-backed** — only modules/features evidenced by routes/permissions/domain services; PRD extras `NOT_APPLICABLE` / future |
| First producers (post–Wave 0) | Commerce core: Sales Invoice posted → POS completed → MRA EIS accepted |
| Architecture | Dual: `lib/admin/productCatalogue/*` + `lib/admin/productAnalytics/*` |
| Event store | Reuse Phase 4 `AnalyticsEvent` / outbox / facts — no parallel event store |
| Exit expectation | `READY_FOR_PHASE_10_WITH_BLOCKERS` until broad instrumentation exists |

---

## 3. Hard rules

- Page views / route loads / login alone ≠ value / activation / adoption.
- Retries, reprints, background jobs, monitoring ≠ new usage.
- Entitlement ≠ adoption; configuration ≠ value.
- Association ≠ causation.
- No false zeroes; failed gates → UNAVAILABLE / NOT_INSTRUMENTED with reason.
- No session replay, keylogging, Tenant GL content, MRA credentials, invasive device fingerprints.
- No auto plan upgrades / entitlement grant-revoke / CRM opportunities / customer outreach.
- `/insightbooks/chart-of-accounts` stays removed; Tenant CoA unchanged.
- Never Tenant Sale as SaaS revenue.
- Commits only when user asks.

---

## 4. Wave 0 — Forensic pack (docs only)

Create `docs/admin-intelligence-crm/phase-09/` with CURRENT_* audits, quality/recon/privacy/security/performance audits, matrices (source, module/feature, entitlement, meaningful action, first-value, activation, adoption, retention, funnel, reliability, security), gap register, IMPLEMENTATION_PLAN, and CONDITIONAL GO for Wave 1.

---

## 5. Domain architecture (post–Wave 0)

```text
Repo-backed Product Catalogue (areas → modules → features → cadence/lifecycle)
        → Plan/add-on entitlement resolution (historical plan versions)
        → Phase 4 AnalyticsEvent (server producers, idempotent)
        → Product / Feature usage facts
        → First-value / Repeat-value / Activation / Adoption engines
        → Snapshots + reliability gate
        → Funnels / cohorts / retention / signals
        → Workbench UI + exports + CS/Health/360 integrations
```

### Distinctions (never conflate)

ENTITLEMENT · AVAILABILITY · CONFIGURATION · DISCOVERY · FIRST VALUE · REPEAT VALUE · ACTIVATION · ADOPTION · ENGAGEMENT · DEPTH · BREADTH · STICKINESS · RETENTION

---

## 6. Waves after Wave 0

| Wave | Focus |
|------|--------|
| 0 | Audits + matrices + readiness |
| 1 | Catalogue + definition versions + reliability gate + commerce producers |
| 2 | First-value / activation / adoption engines for instrumented features |
| 3 | Workbench shell/nav/i18n + overview/modules/features (honest UNAVAILABLE) |
| 4 | Funnels/cohorts/retention/signals/recon/export + integrations + Phase 10 pack |

---

## 7. Approval

Conversational design **approved** 2026-07-29.
