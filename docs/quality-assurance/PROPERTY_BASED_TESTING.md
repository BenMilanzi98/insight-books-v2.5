# Property-Based Testing

Seeded random generation for reproducible property-style checks. **Partial adoption** — not full fast-check integration.

---

## Current implementation

**File:** `test/qa/helpers/seededRandom.js`

- xorshift32 PRNG with explicit `seed`
- `createSeededRandom(42)` → `{ next, int, pick, seed }`

**Example:** `accounting.invariants.test.js` — 25 random balanced journals per fixed seed (ACC-INV-002 property loop).

On failure, error message includes seed for reproduction.

---

## Scope (Phase 16)

| Property | Status |
|---|---|
| Balanced journals for random amounts | ✅ Seeded loop |
| Full posting engine event × amount matrix | ❌ DEFERRED |
| CoA code permutations | ❌ NOT_STARTED |
| Authorization role permutations | ❌ NOT_STARTED |

---

## Conventions

1. **Always fix seed** in test — no unseeded loops for money.
2. Keep iteration count modest (25–100) for PR-fast runtime.
3. Prefer catalogue ID in describe when property maps to ACC-INV row.
4. Document seed in failure message.

---

## Future (Phase 17+)

Optional `fast-check` for:

- Decimal string parsing round-trip
- Period boundary dates with `clock.js`
- Idempotency key collision resistance

**Not in `package.json` today** — add only if seeded loop insufficient.

---

## Related documents

- `DETERMINISTIC_TIME_AND_IDENTIFIERS.md`
- `EXACT_DECIMAL_TESTING.md`
- `POSTING_ENGINE_TEST_MATRIX.md`

---

## Document status

| Field | Value |
|---|---|
| Version | 1.0 |
| Last updated | July 2026 |
| Owner | Property testing (deferred expansion) |
