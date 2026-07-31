# Phase 16 Readiness — Initial Draft

Compliance, operational security, and infrastructure hardening phase. **This document is a draft** — Phase 16 cannot start until Phase 15 code exit criteria are met and tests land.

---

## Purpose of Phase 16 (anticipated)

| Theme | Examples |
|---|---|
| Database hardening | PostgreSQL RLS (GAP-SEC-025), NOT NULL tenant migrations (GAP-SEC-026) |
| Compliance evidence | Control matrix, access review exports, retention policies |
| Operational security | SIEM integration, incident runbooks, penetration test remediation |
| Data lifecycle | PII retention, loan document purge, backup encryption verification |
| Advanced auth | SSO/OAuth tenant login, hardware key MFA |

Exact scope will be defined in `docs/compliance-operations/` (not created yet).

---

## Phase 15 → Phase 16 dependency gate

Phase 16 is **BLOCKED** until:

| # | Gate | Evidence required | Current status |
|---|---|---|---|
| 1 | Phase 15 foundation docs complete | This folder A–G, CA–CB | **MET** (July 2026) |
| 2 | Critical gaps closed in code | GAP-SEC-001, 013, 014, 026, 030 | **NOT MET** — PENDING |
| 3 | Middleware catalogue complete | GAP-SEC-011 + test BZ | **NOT MET** |
| 4 | Policy engine facade in production (flagged) | BN–BT at least one module | **NOT MET** |
| 5 | Immutable audit writer live | AA, AD | **NOT MET** |
| 6 | Upload gateway enforced | AE | **NOT MET** |
| 7 | Automated test suite green | BW–BY, BZ | **NOT MET** — tests do not exist yet |
| 8 | `FINAL_PHASE_15_REPORT.md` | CF | **NOT MET** |
| 9 | Rollback drill executed | Tier 2–3 in staging | **NOT MET** |

---

## Known blockers (from Phase 14 handoff)

From `docs/loan-readiness/PHASE_15_READINESS.md`:

- Platform-wide malware scanning / signed download links for sensitive uploads  
- Full SoD enforcement (preparer ≠ sole approver) as **hard policy**  
- Data-retention automation for ownership / ID documents  
- Background covenant monitoring jobs with alert permissions  

These remain Phase 15/16 boundary items — upload signing starts Phase 15 (AE–AF); retention automation likely Phase 16.

---

## Risks if Phase 16 starts early

| Risk | Impact |
|---|---|
| RLS policies on incomplete tenancy | False negatives lock out legitimate users |
| Compliance audit on mutable AuditLog | Findings against repudiation controls |
| SOC scope without session revocation | Cannot demonstrate session management |
| Pen test on SEC-2 unfixed routes | Critical findings guaranteed |

---

## Preliminary Phase 16 workstreams (placeholder)

Not scheduled — for planning only:

1. **RLS pilot** — `JournalEntry`, `Account`, `Transaction` tables.  
2. **Retention engine** — tenant-configurable document TTL.  
3. **Access certification** — quarterly role review export.  
4. **Backup & DR security** — encrypted backups, restore drill.  
5. **External pen test** — after Phase 15 Wave 1 hotfixes.  
6. **SSO** — enterprise tenant requirement gathering.

---

## Test inventory required before Phase 16 kickoff

| Test file | Covers | Status |
|---|---|---|
| `test/securityGovernance.policy.test.js` | Policy engine, SEC-2 class | Not created |
| `test/securityGovernance.sod.test.js` | Self-approval deny | Not created |
| `test/securityGovernance.session.test.js` | Sign, revoke, expiry | Not created |
| `test/authz.test.js` (extended) | Middleware catalogue | Exists — needs extension |
| `test/accountingV2.*.test.js` | Regression for guard delegation | Exists |

**Minimum bar:** 90% of THR-007–THR-016 scenarios have automated coverage.

---

## Metrics to collect during Phase 15 code rollout

Baseline before Phase 16:

- 403 rate by route prefix  
- Cross-tenant deny count (new metric)  
- Session duration distribution  
- Audit events per business per day  
- Upload download volume via public vs signed URLs  

---

## Sign-off checklist (draft)

- [ ] Engineering lead — Phase 15 exit criteria (PHASE_15_TASKS.md)  
- [ ] Security reviewer — THREAT_MODEL residual risks acceptable  
- [ ] Operations — ROLLBACK_STRATEGY drill completed  
- [ ] Product — no user-facing regression on login/upload flows  

---

## Document status

| Field | Value |
|---|---|
| Version | 0.1 (initial draft) |
| Last updated | Phase 15 foundation pass |
| Next review | After first `test/securityGovernance.*` lands |
| Owner workstream | CB, CG in PHASE_15_TASKS.md |

When gate #2–#7 are met, replace this draft with `PHASE_16_KICKOFF.md` and expand scope in a dedicated folder.
