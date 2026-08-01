# Task 4 Review — Activate / Deactivate UX

**Feature:** Tax Codes Activate / Deactivate UX  
**Sources:** `task-4-brief.md`, `task-4-report.md`, working-tree `app/tax-types/page.js`  
**Method:** Read brief/report; inspect `toggleTaxStatus` + card Actions UI; confirm PUT path accepts `{ status }` only; verify existing Active/Inactive badge (no new column)

## Verdicts

1. **Spec compliance:** ✅  
2. **Task quality:** **Approved**

## Critical

None.

## Important

None.

## Minor (non-blocking)

1. **Manual check (Step 4) not run** — Report correctly notes Invoice modal disappear/reappear after reload was not verified in-session. Code path is sound (PUT `{ status }` → `loadData()`); still recommend a quick local smoke once logged in.
2. **Cards vs “table Actions column”** — Page uses card footers, not a table. Activate/Deactivate live in the existing action row (`canUpdateTax`-gated). Matches current UI; intentional adaptation called out in the report.

## Spec checklist

| Requirement | Status |
|-------------|--------|
| `toggleTaxStatus(tax)` PUT `{ status: Active↔Inactive }` | ✅ `app/tax-types/page.js` ~283–316; body `{ status: nextStatus }` |
| Active → “Deactivate” + confirm copy about quotations/invoices/POS | ✅ Confirm exact string; cancel returns early |
| Inactive → “Activate” (no confirm) | ✅ |
| Refresh list after success | ✅ `await loadData()` |
| Toast/alert on failure | ✅ `setError(err.message)`; success banner also shown |
| Use existing Active/Inactive status; no new column | ✅ Reuses `tax.status` badge + filter; no schema/UI column added |
| No commit | ✅ Per report |

## Behavior audit

| Action | UI | Confirm | Request | After |
|--------|----|---------|---------|-------|
| Deactivate | Label “Deactivate” when `tax.status === "Active"` | Yes — exact brief string | `PUT /api/tax-types/:id` `{ status: "Inactive" }` | Success banner + `loadData()`; error banner on failure |
| Activate | Label “Activate” when not Active | No | `PUT …` `{ status: "Active" }` | Same |

API support: `app/api/tax-types/[id]/route.js` applies `if (status !== undefined) updateData.status = status` without requiring other fields — status-only PUT is valid. Permission: UI gated by `canUpdateTax`; API uses `tax.update`.

## Strengths

- Confirm copy matches the brief verbatim.
- Permission check before network call; errors surfaced via existing banner pattern (consistent with edit/delete/sync).
- No new status model or column — reuses Active/Inactive end-to-end.
- Success feedback + list refresh beyond the minimum failure-alert requirement.

## Residual risk

Low. Downstream Active-only filtering (Tasks 1–3) is what makes Deactivate hide taxes from Invoice/POS pickers; this task only flips status in the admin UI. Recommend the brief’s Step 4 smoke when convenient.
