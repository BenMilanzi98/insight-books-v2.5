# Existing Business CoA Readiness Assessment (Phase 3 §16)

Assessor: `lib/coaV2/application/businessReadiness.js` · CLI: `npm run coa:readiness`
· Artifact: `artifacts/accounting-coa/business-coa-readiness.csv`

## 1. What is checked per business

Hierarchy cycles · duplicate codes · duplicate name candidates · parents with direct
postings · posting accounts with children · missing V2 classification · missing core
purposes (salary canonical, AR/AP controls, equity core) · conflicting system-purpose
assignments · salary conflicts · inactive accounts still referenced by recent activity.

Statuses: `READY` → `READY_WITH_WARNINGS` → `REQUIRES_MAPPING` → `REQUIRES_CLEANUP` →
`BLOCKED` / `MANUAL_REVIEW_REQUIRED`.

## 2. Assessment (2026-07-20 — 5 businesses, 540 accounts, all classified by the Stage-2 backfill)

| Business | Accounts | Status | Notes |
|---|---|---|---|
| QA-Accounting | 111 | READY | No blockers or warnings |
| Tech Transformation | 107 | READY | No blockers or warnings |
| Test Biz | 107 | READY | No blockers or warnings |
| Debug Signup Co | 107 | READY | No blockers or warnings |
| Insight Books | 108 | REQUIRES_CLEANUP | 1 salary conflict + 1 conflicting system purpose — the archived 5301 duplicate (zero activity). Cleared by executing the pending consolidation plan |

All five businesses have the canonical salary account, AR/AP controls, and the equity core.
Zero hierarchy cycles, zero duplicate codes, zero unclassified accounts, zero
inactive-but-referenced accounts.

## 3. Migration disposition

- 4 businesses can enable `coaV2CanonicalMappings` as soon as their purpose mappings are
  seeded into the registry (until then the legacy blueprint fallback keeps resolution
  working unchanged).
- Insight Books requires one consolidation-plan execution (5301 → 5200) first; no
  historical repair is involved.
- No business is BLOCKED; no manual classification queue was produced (the backfill
  classified 540/540 rows without manual-review rows).

Re-run the assessment at any time with `npm run coa:readiness`; it is read-only.
