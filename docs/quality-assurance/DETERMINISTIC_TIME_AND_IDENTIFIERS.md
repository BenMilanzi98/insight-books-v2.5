# Deterministic Time & Identifiers

Avoid wall-clock flakiness and non-reproducible IDs in Phase 16 QA tests.

---

## Time — `test/qa/helpers/clock.js`

| API | Purpose |
|---|---|
| `freezeTime(isoOrMs)` | Pin "now" for period boundary tests |
| `unfreezeTime()` | Restore wall clock |
| `nowMs()` / `nowDate()` | Read frozen or real time |
| `advanceMs(delta)` | Step time forward deterministically |
| `utcYmd(date)` | UTC date string for assertions |

**Usage:** Import in period/expiry tests when added under `test/qa/`. Not yet wired globally via Vitest `setupFiles`.

**Rule:** Period-close and session-expiry tests must not assert against `Date.now()` without freezing.

---

## Identifiers — `test/qa/factories/ids.js`

| API | Output example |
|---|---|
| `resetIdSequence(start)` | Reset counter (call in `beforeEach`) |
| `nextId('je')` | `je_000001` |
| `businessId(n)` | `biz_TEST_001` |
| `userId(n)` | `user_TEST_001` |

**No `Math.random()`** in factories — failures must replay with same sequence after `resetIdSequence`.

---

## Seeded randomness — `test/qa/helpers/seededRandom.js`

For property-style loops (see `accounting.invariants.test.js`):

```javascript
const rnd = createSeededRandom(42);
// on failure, message includes seed for reproduction
```

---

## Related documents

- `TEST_FACTORIES_AND_BUILDERS.md`
- `PROPERTY_BASED_TESTING.md`
- `FLAKY_TEST_POLICY.md`

---

## Document status

| Field | Value |
|---|---|
| Version | 1.0 |
| Last updated | July 2026 |
| Owner | AD (test/qa conventions) |
