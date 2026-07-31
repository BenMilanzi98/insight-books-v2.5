# Final Phase 10 Fix Pass — Support Ops

**Date:** 2026-07-30  
**Source review:** `.superpowers/sdd/final-phase-10-review.md`  
**Commit:** none (explicitly deferred)

## Final fix pass

### Must-fix items

| Finding | Status | Change |
|---------|--------|--------|
| **P1** Upload size gate | Fixed | `createAttachment` gates on `Math.max(declared, actual)` via `Buffer.byteLength(content)`; persists actual length when content present |
| **P2** Download ticket binding | Fixed | `getAttachmentDownload` requires `ticketId` (id or SUP number); mismatch → `notFound`; download route passes `params.id` |
| **P2** Path containment | Fixed | `absolutePathForKey` uses `path.resolve` + `path.relative` (`..` / absolute reject) and `startsWith(root + sep)` |
| **P2** Content-Disposition | Fixed | `sanitizeContentDispositionFileName` strips CR/LF/`"`/controls/path seps; used by download route |
| **P2** `evaluateClockBreach` full scan | Fixed | Removed `findMany({})` fallback; missing scoped lookup → `UNAVAILABLE`; else `clock_not_found` |

### Tests

```text
npx vitest run test/systemAdmin.support.attachments.test.js \
  test/systemAdmin.support.sla.test.js \
  test/systemAdmin.support.messages.test.js
```

**Result:** 3 files, 34 passed.

New / adjusted coverage:

- Oversized content with small declared `sizeBytes` rejected
- Stored `sizeBytes` prefers actual content length
- Download ticket mismatch → not found; ticket number path OK; missing ticketId rejected
- Path sibling-prefix escape rejected
- Content-Disposition sanitization
- `evaluateClockBreach` does not call `findMany` when scoped lookup missing

### Files touched

- `lib/admin/support/attachments.js` (rewrite + hygiene; cleared accidental blank-line inflation)
- `lib/admin/support/index.js` (export helpers)
- `lib/admin/support/sla/clocks.js`
- `app/api/admin/support/tickets/[id]/attachments/[attachmentId]/download/route.js`
- `test/systemAdmin.support.attachments.test.js`
- `test/systemAdmin.support.sla.test.js`

### Residual (not in this pass)

- P3 ledger items (listClocks `ok` shape, getTicket swallow, UI attachments gap, commit isolation ~997 dirty paths)
- No HTTP route tests yet
- Queue scope still stubbed `mode: 'all'`

### Post-fix readiness

**Ready to commit with caveats** after isolating Phase 10 paths (per review P2 process hygiene).
