# Task 2 Report: Pure outbox push rules

## Summary

Implemented pure outbox state helpers in `lib/desktop/outboxState.js` with Vitest coverage in `test/desktop/outboxState.test.js`. All six tests pass. Committed as `8828a8170`.

## TDD Evidence

### RED (Step 2)

Command:

```
npx vitest run test/desktop/outboxState.test.js
```

Output:

```
 FAIL  test/desktop/outboxState.test.js [ test/desktop/outboxState.test.js ]
Error: Cannot find module '../../lib/desktop/outboxState.js' imported from C:/laragon/www/insight-books-v2.5/test/desktop/outboxState.test.js
 ❯ test/desktop/outboxState.test.js:2:1

 Test Files  1 failed (1)
      Tests  no tests
```

Result: **FAIL** — module not found (expected).

### Interim RED (brief Step 3 pasted verbatim)

After adding the brief Step 3 implementation verbatim, one test still failed:

```
 FAIL  test/desktop/outboxState.test.js > outbox push order > stops when an earlier item failed
AssertionError: expected { id: 'a', seq: 1, status: 'pending' } to be null
```

Root cause: the brief test calls `markPushFailure(rows, 'b', …)` while `a` is still `pending`. The brief Step 3 loop returns the first `pending`/`syncing` row before it reaches the `failed` row at seq 2. The test name implies `a` should already be synced when `b` fails (matching Task 8 sync-worker flow).

### GREEN (Step 4)

Command:

```
npx vitest run test/desktop/outboxState.test.js
```

Output:

```
 Test Files  1 passed (1)
      Tests  6 passed (6)
   Duration  357ms
```

Result: **PASS** — 6/6 tests green.

## Files Created

| File | Purpose |
|------|---------|
| `lib/desktop/outboxState.js` | Pure outbox ordering, push selection, snapshot gate, success/failure transitions |
| `test/desktop/outboxState.test.js` | Vitest suite for push-order rules |

## Exports (per brief)

- `OUTBOX_STATUS` — `{ pending, syncing, failed, synced }`
- `sortOutboxForPush(rows)` — copy sorted by `seq` ascending
- `nextPushItem(rows)` — first non-synced `pending`/`syncing`, or `null` if a `failed` row blocks the queue
- `canPullSnapshot(rows)` — `true` only when every row is `synced` (empty array → `true`)
- `markPushFailure(rows, id, errorMessage)` — sets matching id to `failed`, leaves others unchanged
- `markPushSuccess(rows, id, serverId)` — sets matching id to `synced` with `serverId`

## Deviations from Brief (required for green)

1. **`nextPushItem`** — added `if (row.status === 'synced') continue;` before the `failed` check. Without this, already-synced rows are not skipped and the failure-stop rule cannot work once earlier items succeed (Task 8 loop semantics).

2. **Failure test setup** — added `let r = markPushSuccess(rows, 'a', 'srv-a');` before `markPushFailure(r, 'b', …)`. The verbatim brief test leaves `a` pending, which contradicts both the test expectation (`nextPushItem` → `null`) and sequential push semantics.

All other test cases and the empty-outbox assertion match the brief verbatim.

## Self-Review

| Check | Result |
|-------|--------|
| Pure (no I/O, no side effects) | Pass |
| Immutability (`sortOutboxForPush`, `markPush*`) | Pass — copies/spreads, no input mutation |
| Task 1 files untouched | Pass |
| Only committed task files | Pass — commit contains 2 files, 92 insertions |
| Signatures match brief | Pass |
| Empty outbox snapshot pull | Pass — `canPullSnapshot([])` → `true` |
| Failed item leaves later rows pending | Pass |
| Syncing treated as retry candidate | Pass |

## Commit

```
8828a8170 feat(desktop): add pure outbox push-order helpers
```

## Concerns

- Brief Step 3 implementation and Step 1 failure test are internally inconsistent; minimal fixes above were required to achieve green TDD and align with Task 8 sync-worker algorithm.
- Recommend updating the plan brief to include the `synced` skip and the `markPushSuccess(rows, 'a', …)` prerequisite in the failure test.
