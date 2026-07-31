# Task P9-2 Review — Wave 2 First-value / activation / adoption (re-review)

**Verdict: Spec Compliance Approved | Task quality Approved**

Read-only re-review after Critical/Important remediation (2026-07-29). Checked brief, remediation report, `facts` / `firstValue` / adoption route / consumer wiring / adoption tests. Vitest re-run: **12 passed (12)**.

**Reviewer:** defect-first Spec Compliance vs Phase 9 hard rules (prior Critical/Important only + residual defects).

---

## Spec Compliance

| Area | Status | Notes |
|------|--------|-------|
| Interfaces (`recordOrLoadFirstValue`, `evaluateRepeatValue`, `evaluateActivation`, `evaluateAdoptionState`) | **Met** | Exported; rule/definition versions present |
| Unique first value per tenant+feature+ruleVersion | **Met** | `@@unique` + idempotencyKey; P2002 reload; uniqueness test seeds usage-fact evidence |
| Uninstrumented → `NOT_INSTRUMENTED` (never fake `CONSISTENTLY_ACTIVE`) | **Met** | firstValue / activation / adoption |
| Entitlement ≠ value / activation / adoption advance | **Met** | |
| Login / page-view ≠ value | **Met** | Consumer skip + firstValue reject |
| Retries/reprints excluded at producer | **Assumed Met** | Deferred to Wave 1 (brief) |
| History append-only; rule versions required | **Met** | |
| Fact consumer for commerce event codes | **Met** | Wired in `runFactConsumers` |
| First value from AnalyticsEvent/facts only (strict events) | **Met** | `verifySourceEvidence` requires persisted event and/or usage fact |
| Live instrumented path advances first-value / adoption | **Met** | Consumer → `recordOrLoadFirstValue`; E2E to `FIRST_VALUE_ACHIEVED` |
| APIs evaluate / first-value / adoption | **Met** | Adoption GET read-only by default; POST persist opt-in |
| Tests + Vitest PASS | **Met** | 12/12 (includes E2E + synthetic rejection) |
| No git commit | **Met** | Report |

**Overall:** Prior Critical (live pipeline) and Important (source verification, mutating GET, missing E2E) are addressed. Spec Compliance **Approved**.

---

## Prior findings — verification

### Critical #1 — Live commerce path never records first value — **Fixed**

`consumeProductUsageFacts` creates/loads the usage fact, then calls `advanceFirstValueFromEvent` → `recordOrLoadFirstValue`. Re-consume still advances first value (heal if row missing). Wired via `runFactConsumers`.

### Important #1 — No source verification — **Fixed**

`verifySourceEvidence` accepts only a matching `AnalyticsEvent` (id or idempotencyKey + tenant/type/sourceId) or `AnalyticsFactProductUsage` (tenant/feature/type/sourceId or `fact-prod:` idempotency). Synthetic POST payloads return `unverified_source`. Covered by test.

### Important #2 — Adoption GET mutates by default — **Fixed**

`GET .../adoption` persists only when `?persist=1|true`. `POST` persists only when `body.persist` is explicitly `true` / `1` / `'1'`.

### Important #3 — No event/fact → first-value → adoption E2E — **Fixed**

Test `E2E: consume commerce event → first value created → adoption advances (no pre-seeded firstValues)` asserts fact + first-value uniqueness path and `FIRST_VALUE_ACHIEVED` without seeding `firstValues`. Consumer suite also asserts first-value creation on first consume.

---

## Findings

**No Critical or Important findings.**

### Minor / follow-up (non-blocking)

1. **`evaluate` POST still defaults `persist !== false` for adoption** — `app/api/admin/intelligence/product-analytics/evaluate/route.js`. Dedicated adoption route is fixed; evaluate remains mutate-by-default for adoption action. Align to explicit opt-in if desired.
2. **Discovery/config matrix states collapsed** — Entitled + no first value → `AVAILABLE_NOT_DISCOVERED`. Documented; Wave 2 OK.
3. **`INACTIVE` / `ENTITLED_NOT_AVAILABLE` largely unused** — Conservative; fine as follow-up.
4. **Write APIs use `canView` only** — Align when manage permissions mature.
5. **SQL apply still required** before live DB APIs.

---

## What looks solid

- Live AnalyticsEvent → usage fact → first-value pipeline with heal-on-reconsume.
- Strict source evidence; forged admin payloads rejected.
- Adoption GET/POST no longer append history by default.
- Uninstrumented / entitlement / login honesty gates intact.
- Repeat value still requires ≥2 distinct sources.
- E2E + synthetic-rejection tests close the prior coverage hole.
- Vitest: **12 passed (12)** (re-run this review).

---

## Task quality

**Approved**

Remediation matches the prior review’s fix directions; brief interfaces and hard rules hold; tests now exercise the live consumer path. Residual items are Minor only.

**Vitest (this review):** `npx vitest run test/systemAdmin.productAnalytics.adoption.test.js` → **12 passed (12)**.
