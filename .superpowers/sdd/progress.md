# Rentals & Hiring Three Hubs SDD Progress Ledger

Branch: v2.5
Workspace: in-place (dirty tree; same pattern as prior goods-receipt SDD)
Plan: docs/superpowers/plans/2026-08-11-rentals-hirings-three-hubs.md
Started HEAD: 836ef49cc82a389548e91360e3fc2b686814bee0
Note: Do NOT git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" unless user explicitly asks — track WORKING_TREE diffs.
Commits disabled per plan Global Constraints + user rule.


Task 1: complete (WORKING_TREE, review clean; Minor: route stamp untested, partial TRACE const coverage)


Task 2: complete (WORKING_TREE, review clean after fixes; Minor: invoiceVoidService.test.js omitted from first pkg)


Task 3: complete (WORKING_TREE, review Conditional PASS; Minor: customer placeholder until T4, manual smoke deferred)


Task 4: complete (WORKING_TREE, review Approved; Minor residual: auth smoke deferred)


Task 5: complete (WORKING_TREE, review Approved after P1/P2 fixes; Minor: auto-fetch UX, revenue restatement note)


Task 6: complete (WORKING_TREE, review Approved after fixes; Minor: CoA mapping prerequisite, repair 5380, no route tests)


Task 7: complete (WORKING_TREE, 38/38 automated PASS; 8 manual DEFERRED operator smoke)


Final review: Ready with caveats
Final fix: OTHER_INCOME 409 + REPAIRS_AND_MAINTENANCE purpose (WORKING_TREE)


# POS Till Float Funding SDD Progress Ledger

Branch: v2.5
Workspace: in-place (dirty tree; same pattern as rentals SDD)
Plan: docs/superpowers/plans/2026-08-11-pos-till-float-funding.md
Started HEAD: 836ef49cc82a389548e91360e3fc2b686814bee0
Note: Do NOT git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" unless user explicitly asks — track WORKING_TREE diffs.
Commits disabled per plan Global Constraints + user rule.


Task 1 (POS till): complete (WORKING_TREE, review Approved; Minor: capital-only/zero-close tests optional)


Task 2 (POS till): complete (WORKING_TREE, review Approved; generate EPERM env note)


Task 3 (POS till): complete (WORKING_TREE, review Approved after capital catch fix; PETTY_CASH vs HEAD pre-existing)


Task 4 (POS till): complete (WORKING_TREE, review Approved after compensation fix; Minor: silent rollback fail, orphan journal if meta update fails)


Task 5 (POS till): complete (WORKING_TREE, Approved after actor-guard fix)
Task 6 (POS till): complete (WORKING_TREE, review Approved)


Task 7 (POS till): complete (WORKING_TREE, review Approved; manual /pos smoke DEFERRED; sidebar prefill Minor)
Task 8 (POS till): complete (WORKING_TREE, 31/31 automated PASS; 4 manual DEFERRED)


Final review: Ready with fixes
Final fix wave: sidebar open→0; compensation error annotations + orphan journal flag (WORKING_TREE)
Automated: 33/33 focused tests PASS
Manual /pos smoke: DEFERRED


# Tenant POS Theming Unification SDD Progress Ledger

Branch: v2.5
Workspace: in-place (dirty tree)
Plan: docs/superpowers/plans/2026-08-12-tenant-pos-theming-unification.md
Started HEAD: 836ef49cc82a389548e91360e3fc2b686814bee0
Note: Do NOT git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>" unless user explicitly asks — track WORKING_TREE diffs.
Commits disabled per plan Global Constraints + user rule.


Theme Task 0: complete (WORKING_TREE, colors ✅; smoke DEFERRED accepted; PortalPopover pre-existing)


Theme Task 1: complete (WORKING_TREE, review Approved)
Theme Task 2: complete (WORKING_TREE, review deferred-light; invoice/quotations fixed; CDN skipped as matched)


Theme Task 3: complete (WORKING_TREE)


Theme Task 4: complete (WORKING_TREE)


Theme Task 5: complete (WORKING_TREE)


Theme Task 6: complete (WORKING_TREE)


Theme Task 7: complete (WORKING_TREE)


Theme Task 8: complete (WORKING_TREE)
Final review: Ready with fixes
Final fix wave: tax purple→blue, RefundSaleModal icon, broadened purple scan, Badge/MetricCard/AI/Premium; out-of-scope documented
In-scope chrome Fix residual: 0
Accepted exceptions + public/marketing out of scope documented in theming-drift-log.md

