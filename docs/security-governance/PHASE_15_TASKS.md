# Phase 15 Tasks

Workstreams **A–CG** for Security & Governance. Status reflects July 2026 foundation pass: **documentation workstreams largely DONE/IN_PROGRESS**; **code workstreams PENDING** until implementation sprints.

| ID | Workstream | Status | Depends | Deliverable / notes |
|---|---|---|---|---|
| A | Evidence review (Phases 1–14) | DONE | Phase 1–14 docs | `PHASE_1_TO_14_EVIDENCE_INDEX.md` |
| B | Current security architecture | DONE | A | `CURRENT_SECURITY_ARCHITECTURE.md` |
| C | Target security architecture | DONE | B | `TARGET_SECURITY_ARCHITECTURE.md` |
| D | Security data flow maps | DONE | B, C | `SECURITY_DATA_FLOW_MAP.md` |
| E | Control gap register | DONE | A, B | `SECURITY_CONTROL_GAP_REGISTER.md` |
| F | Threat model (20+ threats) | DONE | E | `THREAT_MODEL.md` |
| G | Phase 15 README / index | DONE | A–F | `README.md` |
| H | Session signing design | IN_PROGRESS | C | HMAC vs server store ADR in target doc |
| I | Session store schema | PENDING | H | Prisma `UserSession` or Redis |
| J | Session revocation API | PENDING | I | Replace mock admin sessions |
| K | Middleware prefix audit | IN_PROGRESS | B | Inventory all `/api/*` routes |
| L | `tenantApiAccess` catalogue update | PENDING | K | Add accounting-v2, coa-v2, equity, bank, close, planning, loan |
| M | Generated middleware coverage test | PENDING | L | Fail CI on unlisted prefix |
| N | Page-guard alignment | PENDING | L | New UI routes from Phases 10–14 |
| O | Unified approval engine — domain model | PENDING | C | `ApprovalRequest`, states |
| P | Unified approval engine — API | PENDING | O | `/api/security-governance/approvals` |
| Q | SEC-1 legacy GL hotfix | PENDING | A | Tenant filter in `postGlEntry` or block list |
| R | SEC-2/3/4 legacy route hotfix | PENDING | A | Supplier, reversal, capital permissions |
| S | Approval adapter — equity module | PENDING | O | Wrap `eqV2EquityApproval` |
| T | Approval adapter — repair batches | PENDING | O | Wrap repair approval flow |
| U | SoD registry — core rules | PENDING | C | creator/approver/executor matrix |
| V | SoD registry — legacy route hooks | PENDING | R, U | Reversal, capital, expenses |
| W | SoD registry — bank reconciliation | PENDING | U | Preparer ≠ approver (existing rules) |
| X | SoD registry — period close/reopen | PENDING | U | Hard deny vs soft warning |
| Y | SoD registry — loan readiness | PENDING | U | Preparer/reviewer/approver chain |
| Z | SoD registry — year-end close | PENDING | U | Close run initiator ≠ approver |
| AA | Immutable audit — write path | PENDING | C | Append-only writer service |
| AB | Immutable audit — schema migration | PENDING | AA | New table or triggers |
| AC | Audit tamper detection | PENDING | AB | Alert on UPDATE/DELETE |
| AD | Migrate existing AuditLog writers | PENDING | AA | Gradual cutover |
| AE | Upload gateway — auth wrapper | PENDING | C | Replace public `/uploads` skip |
| AF | Signed download URLs | PENDING | AE | Time-limited tokens |
| AG | Upload malware scan hook | PENDING | AE | Phase 16 may operationalize |
| AH | HR / loan document sensitivity classes | PENDING | AF | Retention metadata |
| AI | Service account model | PENDING | C | `ServiceAccount` + scopes |
| AJ | API key issuance / rotation | PENDING | AI | Admin UI + hash storage |
| AK | Service account audit | PENDING | AI, AA | All actions attributed |
| AL | Cron → service account migration | PENDING | AI | Reduce shared CRON_SECRET |
| AM | Integration docs for partners | PENDING | AJ | No first-party keys today |
| AN | AI governance policy module | PENDING | C | Flags, PII, logging |
| AO | ai-assistant hardening | PENDING | AN | Align with loan/planning gates |
| AP | Financial planning AI review path | IN_PROGRESS | AN | Existing review API — register in policy |
| AQ | Loan readiness AI review path | IN_PROGRESS | AN | Flag + review — register in policy |
| AR | AI prompt injection tests | PENDING | AN | Red-team fixtures |
| AS | AI audit events | PENDING | AN, AA | Prompt hash + outcome |
| AT | Login rate limiting | PENDING | C | `/api/auth/login` |
| AU | API rate limiting (tenant) | PENDING | C | Edge or middleware |
| AV | Rate limit observability | PENDING | AU | Metrics + 429 body |
| AW | AUTHZ_AUDIT_MODE prod guard | PENDING | B | Fail boot if true in production |
| AX | Webhook signature standard | PENDING | C | HMAC contract doc + lib |
| AY | Webhook idempotency enforcement | PENDING | AX | Mandatory `webhookEventId` |
| AZ | Payment webhook GL stub | PENDING | AY | No live webhook GL today (E25) |
| BA | Webhook replay tests | PENDING | AY | 409 on duplicate |
| BB | MFA — TOTP enrollment API | PENDING | C | Use `mfaEnabled` column |
| BC | MFA — login challenge | PENDING | BB | Step-up after password |
| BD | MFA — recovery codes | PENDING | BB | Secure storage |
| BE | Security event bus | PENDING | AA | deny, SoD violation, tamper |
| BF | Admin security dashboard — live data | PENDING | BE, J | Replace mocks |
| BG | SIEM export webhook | PENDING | BE | Optional Slack from admin settings |
| BH | Security KPI dashboard | PENDING | BF | Deny rate, cross-tenant attempts |
| BI | `lib/securityGovernance/domain` scaffold | PENDING | C | ActorContext, PolicyDecision |
| BJ | `lib/securityGovernance/application/policyEngine` | PENDING | BI | authorize() |
| BK | `lib/securityGovernance/application/approvalEngine` | PENDING | O, BI | State machine |
| BL | `lib/securityGovernance/infrastructure/sessionStore` | PENDING | I, BI | Pluggable backend |
| BM | `lib/securityGovernance/api/routeGuard` | PENDING | BJ | Facade for modules |
| BN | Module guard migration — accounting V2 | PENDING | BM | Delegate to policy engine |
| BO | Module guard migration — CoA V2 | PENDING | BM | Same |
| BP | Module guard migration — equity | PENDING | BM | Same |
| BQ | Module guard migration — bank recon | PENDING | BM | Same |
| BR | Module guard migration — accounting close | PENDING | BM | Same |
| BS | Module guard migration — financial planning | PENDING | BM | Same |
| BT | Module guard migration — loan readiness | PENDING | BM | Same |
| BU | Feature flag — security governance master | PENDING | BI | Gradual rollout |
| BV | Feature flag — per-capability | PENDING | BU | Session, SoD, audit, uploads |
| BW | Unit tests — policy engine | PENDING | BJ | `test/securityGovernance.policy.test.js` |
| BX | Unit tests — SoD registry | PENDING | U | Self-approval cases |
| BY | Integration tests — SEC-2 regression | PENDING | R | Supplier IDOR |
| BZ | Integration tests — middleware catalogue | PENDING | M | All prefixes listed |
| CA | Rollback strategy doc | DONE | BU | `ROLLBACK_STRATEGY.md` |
| CB | Phase 16 readiness draft | DONE | BW–BZ | `PHASE_16_READINESS.md` |
| CC | Operator runbook — session incident | PENDING | J | Force logout procedure |
| CD | Operator runbook — audit integrity | PENDING | AC | Tamper response |
| CE | Security training / admin checklist | PENDING | G | Password, MFA, AUTHZ_AUDIT_MODE |
| CF | Final Phase 15 report | PENDING | A–CE | `FINAL_PHASE_15_REPORT.md` |
| CG | Phase 16 handoff review | PENDING | CF, CB | Sign-off meeting |

---

## Critical path

```
A → B → C → BI → BJ → BM → (BN–BT module migrations)
         ↘ Q, R (legacy hotfixes) — can parallel Wave 1
         ↘ L (middleware) — can parallel Wave 1
```

## Documentation vs code status summary

| Category | DONE | IN_PROGRESS | PENDING |
|---|---|---|---|
| Foundation docs (A–G, CA–CB) | 9 | 0 | 0 |
| Design / ADR (H, K, AP–AQ) | 0 | 4 | 0 |
| Code implementation | 0 | 0 | 72 |

## Exit criteria (Phase 15 code complete)

1. GAP-SEC-001, 013, 014 closed with tests (BW–BY).  
2. Middleware lists all module API prefixes (L, M, BZ).  
3. Policy engine facade used by at least one module guard (BN).  
4. Immutable audit writer live for new events (AA, AD).  
5. Upload gateway enforced (AE).  
6. `FINAL_PHASE_15_REPORT.md` (CF) published.  

Until exit criteria met, Phase 16 compliance work remains **blocked** (see `PHASE_16_READINESS.md`).
