# Phase 3 Architecture Decision Inputs

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

Decisions required (with Phase 2 evidence):

1. EIS bounded context separate from accountingV2 but sharing finalize tx.
2. DB ownership: new Eis* tables vs extend EISConfiguration.
3–4. Entitlement = subscription fix + eisEnabled + completeness gates.
5–6. Terminal scope per tenant/branch/till — **MRA dependent**.
7–8. Mapping scope per tenant (+ site).
9. Canonical event SALE_FISCALIZATION_ELIGIBLE.
10. Local accounting independent of MRA acceptance.
11–12. Snapshot + outbox inside finalize tx.
13. Fiscal number server-side per terminal sequence.
14. Per-terminal ordering in worker.
15. MraEisClient server-only.
16. Encrypt all terminal credentials.
17. Versioned configuration snapshots.
18–20. Transmission + retry + unknown-outcome state machines.
21–22. Receipt pending then QR; persist validationURL.
23–24. Online first; offline only after cert.
25. Honour shouldBlockTerminal.
26–28. Flags, audit, reports.
29–30. Migration/rollout — no historical submit without approval.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
