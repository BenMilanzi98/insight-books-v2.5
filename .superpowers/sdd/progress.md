# Desktop offline sync — SDD progress

Branch: `feat/desktop-offline-sync`
Plan: `docs/superpowers/plans/2026-08-15-desktop-offline-sync.md`
Spec: `docs/superpowers/specs/2026-08-15-desktop-offline-sync-design.md`

Notes:
- Working in the current checkout (not a linked worktree): HEAD was `main` with large uncommitted i18n/UI diffs that later tasks need; a worktree from HEAD would drop them.
- Implementers commit **only** files listed in their task. Never stage unrelated dirty files (`.next`, i18n page rewires, etc.).
- User selected Subagent-Driven Development, so task-scoped commits on this feature branch are allowed.

## Ledger

- Task 1: complete (commits 94a4713..b017e25, review clean)
  - Minor: unused WARN_MS import in lock.test.js; codes.js untested; document locked vs warning for Task 12
- Task 2: complete (commits b017e25..8828a81, review clean)
  - Deviation: nextPushItem skips synced; failure test pre-syncs `a` (brief test vs Step 3 were inconsistent). Spec-correct.
  - Minor: no assertions on errorMessage/serverId; extra canPullSnapshot cases
- Task 3: complete (commits 8828a81..b404f4e, review clean)
- Task 4: complete (commits b404f4e..8dfc7b6, review clean)
  - Minor: smoke test is presence-only; redundant @@unique on receipts (plan-mandated)
- Task 5: complete (commits 8dfc7b6..1fb9b32, review clean after 3 fix rounds)
  - Minor: cross-tenant bind has no code field; no prefix-exhaustion test; no HTTP integration tests
- Task 6: complete (commits 1fb9b32..d4ed19d, review clean after membership fix)
  - ⚠️ route 401/403: controller verified route.js uses getUserFromSession 401 + assertBoundDesktopDevice 403
- Task 7: complete (commits d4ed19d..cd5c34b, review approved after P2002/batch/RBAC fixes)
  - Deviation: some kinds use callRouteHandler (controller-accepted)
  - Minor: concurrent double-post window; invoice dup check outside tx; coarse outbox perms
- Task 8: complete (commits cd5c34b..db1ffd5, review conditional pass)
  - Minor: no test that replaceSnapshot leaves lastSuccessfulSyncAt unset; unused test imports
- Task 9: complete (commits db1ffd5..8a128f4; invoice mutations added after review)
- Task 10: complete (commits 8a128f4..760b08f, review approved with caveats)
  - Minor: duplicated session token parse; OnboardingGate tt() extra; cookie vs DESKTOP_RUNTIME pairing
- Task 11: complete (commits 760b08f..8375c33, review clean)
  - Minor: ok:true when outbox blocked; syncStatusFromDb untested
- Task 12: complete (commits 8375c33..8146fbb, review clean)
  - Minor: extra locale keys; banner not gated by hide; duplicate poll
- Task 13: complete (commits 8146fbb..8918064, review approved after P1 electron fixes)
  - Follow-up: post-unbind redirect re-attach; IPC re-registration; spawn idempotency; manual smoke + electron-builder not run

## Branch status

All 13 plan tasks complete on `feat/desktop-offline-sync`.
- Final review: Critical/Important 1–5 fixed in 369e4f439 (91 desktop tests)
  Remaining Important (not blocking this session): GET detail routes, local invoice stock decrement, customer.archive, Electron spawn/IPC lifecycle, installer/smoke
