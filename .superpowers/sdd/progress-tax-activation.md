# Tax Activation (Active-Only) SDD Progress

Branch: v2.5
Plan: docs/superpowers/plans/2026-08-01-tax-activation-active-only.md
Spec: docs/superpowers/specs/2026-08-01-tax-activation-active-only-design.md
Workspace: in-place (no worktree)
Constraint: do not git commit unless user explicitly asks

BASE before Task 1: f918aed627019ad3d669c92b382904d266e7bfb7
Task 1: complete (WORKING_TREE, review clean; minors: untested collector/dedupe; vitest include tests/)
Task 2: complete (WORKING_TREE, review clean; fetchActiveTaxTypes wired to Quotation/Invoice/POS)
Task 3: complete (WORKING_TREE, review clean after allowInactiveIds grandfathering on PUT)
Task 4: complete (WORKING_TREE, review clean; Activate/Deactivate on tax-types cards)
Task 5: complete (WORKING_TREE, acceptance sweep PASS; no code changes)
Final review: Important picker+docs fixes applied; re-review Ready to merge: Yes (WORKING_TREE, uncommitted)
