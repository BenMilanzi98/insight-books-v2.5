# Task 1 Report: Lock, codes, and document numbers (pure)

## What was implemented

Pure desktop offline-sync helpers with no I/O:

- **`lib/desktop/codes.js`** — `DESKTOP_CODES` constant object with five error/status codes (`SYNC_REQUIRED`, `ONLINE_ONLY`, `SUBSCRIPTION_INACTIVE`, `DEVICE_BOUND`, `NOT_BOUND`).
- **`lib/desktop/lock.js`** — Time thresholds (`LOCK_MS` 24h, `WARN_MS` 20h, `CLOCK_BACKSHIFT_MS` 5m) and `evaluateDesktopLock()` returning `{ locked, warning, hoursSinceSync, reason }` with reasons `'stale' | 'clock' | 'subscription' | null`.
- **`lib/desktop/documentNumbers.js`** — `formatDesktopDocNumber({ prefix, type, seq })` and `nextSeq(lastIssued)`.

## What was tested and test results

Two Vitest suites, 8 tests total:

| Suite | Tests |
|-------|-------|
| `test/desktop/lock.test.js` | 6 — unlock under 20h, warn 20–24h, lock at 24h, clock backshift lock/no-lock, subscription inactive |
| `test/desktop/documentNumbers.test.js` | 2 — format `TILL1-SALE-12`, `nextSeq` increment |

**Final run:** `npx vitest run test/desktop/lock.test.js test/desktop/documentNumbers.test.js` — **2 files passed, 8 tests passed**.

## TDD Evidence

### RED (before implementation)

**Command:**
```
npx vitest run test/desktop/lock.test.js test/desktop/documentNumbers.test.js
```

**Relevant output:**
```
 FAIL  test/desktop/documentNumbers.test.js
Error: Cannot find module '../../lib/desktop/documentNumbers.js' imported from .../test/desktop/documentNumbers.test.js

 FAIL  test/desktop/lock.test.js
Error: Cannot find module '../../lib/desktop/lock.js' imported from .../test/desktop/lock.test.js

 Test Files  2 failed (2)
      Tests  no tests
```

**Why expected:** Tests were written first; implementation modules did not exist yet, so Vitest failed at import resolution before any assertions ran.

### GREEN (after implementation)

**Command:**
```
npx vitest run test/desktop/lock.test.js test/desktop/documentNumbers.test.js
```

**Relevant output:**
```
 Test Files  2 passed (2)
      Tests  8 passed (8)
   Duration  780ms
```

## Files changed

| File | Action |
|------|--------|
| `lib/desktop/codes.js` | Created |
| `lib/desktop/lock.js` | Created |
| `lib/desktop/documentNumbers.js` | Created |
| `test/desktop/lock.test.js` | Created |
| `test/desktop/documentNumbers.test.js` | Created |

**Commit:** `b017e2507` — `feat(desktop): add lock thresholds and document number helpers`

## Self-review findings

1. **Matches brief verbatim** — Signatures, constants, and logic follow the task brief exactly; no extra files or refactors.
2. **`evaluateDesktopLock` priority order** — Subscription inactive is checked first, then clock backshift, then stale lock (≥24h), then warning (≥20h). Matches specified implementation.
3. **Stale lock sets `warning: true`** — At exactly 24h, both `locked: true` and `warning: true` are returned (brief implementation); tests only assert `locked` and `reason` for that case.
4. **`WARN_MS` import unused in tests** — `lock.test.js` imports `WARN_MS` per brief but does not reference it; harmless, matches brief test file.
5. **`codes.js` has no tests** — Brief specifies the file and constants but no dedicated test suite; acceptable for this task scope.
6. **`nextSeq(0)`** — Uses `Number(lastIssued || 0) + 1`; correctly returns `1` for input `0`.

## Issues or concerns

- None blocking. `DESKTOP_CODES` is untested in this task; later tasks may import and validate usage.
- Stale-lock path returns `warning: true` alongside `locked: true`; consumers should treat `locked` as authoritative if they need a single boolean gate.
