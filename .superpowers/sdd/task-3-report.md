# Task 3 Report: Operational path lists + runtime flag

**Status:** DONE  
**Date:** 2026-08-15  
**Commit:** `b404f4e15 feat(desktop): classify operational vs online-only API paths`

## Summary

Added pure desktop runtime helpers and API path classification for offline sync. Operational path exceptions are evaluated before operational prefixes so cloud-dependent actions remain online-only.

## Files committed

- `lib/desktop/runtime.js`
  - Exports `DESKTOP_COOKIE = 'ib_desktop'`.
  - `isDesktopRuntime()` is true only when `process.env.DESKTOP_RUNTIME === '1'`.
  - `isDesktopCookie(value)` recognizes the desktop cookie value `1`.
- `lib/desktop/paths.js`
  - Returns only `operational`, `desktop-cloud`, `desktop-local`, `auth-ok`, or `online-only`.
  - Includes all operational, auth, desktop cloud, desktop local, and online-only paths from the task brief.
  - Evaluates fixed and wildcard online-only exceptions before operational prefix matching.
- `test/desktop/paths.test.js`
  - Covers all five classifications, every listed online-only exception, and all runtime helper behavior.

## TDD evidence

### RED

Command:

`npx vitest run test/desktop/paths.test.js`

Result: exit code 1. Vitest reported one failed suite because `../../lib/desktop/paths.js` did not exist. This was the expected feature-missing failure before any production files were created.

### GREEN

Command:

`npx vitest run test/desktop/paths.test.js`

Result: exit code 0; 1 test file passed and 11 tests passed.

### Regression verification

Command:

`npx vitest run test/desktop`

Result: exit code 0; all 4 desktop test files passed and all 25 tests passed.

IDE lint diagnostics reported no errors in the three Task 3 files. `git diff --cached --check` also completed with exit code 0 before commit.

## Self-review

- Confirmed online-only exceptions execute before operational prefix checks.
- Confirmed wildcard invoice/client exceptions require a non-empty path segment.
- Confirmed prefix matching respects path-segment boundaries.
- Confirmed all exact constants and return strings match the brief.
- Confirmed only the three authorized implementation/test files were staged and committed.
- Confirmed Tasks 1–2 lock, document-number, and outbox helpers were not modified.

## Concerns

None.
