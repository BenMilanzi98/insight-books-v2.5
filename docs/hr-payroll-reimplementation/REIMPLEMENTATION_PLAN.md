# Reimplementation Plan — HR & Payroll

**Prerequisite:** Approval of [FINAL_GAP_REGISTER.md](./FINAL_GAP_REGISTER.md).  
**Statutory default:** Malawi PAYE + NPS as versioned config.  
**Money:** `lib/money.js` + Prisma `Decimal(18,2)`.

## Phase overview

| Phase | Name | Outcome |
|-------|------|---------|
| 0 | Audit (this pack) | Complete |
| 1 | Foundation & security hotfixes | Safe mutations; Decimal plan; kill status PATCH |
| 2 | Employee + contracts | Versioned pay terms |
| 3 | Leave + attendance engines | Approved inputs |
| 4 | Catalogues + disciplinary | Benefits/deductions/penalties |
| 5 | Pension / gratuity / advances | Ledgers + idempotent recovery |
| 6 | Payroll rules engine | Components, formulas, order, snapshot, explanation |
| 7 | Run state machine + review UI | Commands only |
| 8 | Accounting + payment | Matrix + idempotency |
| 9 | Payslips / reports / reconciliation | Traceability |
| 10 | Permissions, audit, SoD, tests, hardening | Acceptance evidence |

Do not start Phase 2 UI cosmetics before Phase 1–2 data foundations.

---

## Phase 1 — Foundation & hotfixes

**Files (expected):**  
`app/api/payroll/[id]/status/route.js`, payroll mutation routes, `prisma/schema.prisma`, migration(s), `lib/money.js` adoption plan.

**Tasks:**

1. Replace arbitrary status PATCH with forbidden or command-only transitions.  
2. Enforce `where: { id, tenantId }` on payroll/employee/advance mutations.  
3. Add regression test for cross-tenant payroll update.  
4. Design Decimal migration for Employee/Payroll/Benefit/Deduction/Advance/Gratuity money fields (expand/contract or dual-write).  
5. Document cutover flag for V2-only payroll posting (disable dual legacy when ready).

**Exit:** SEC-01 closed; mutation tenant-safe; migration script drafted.

---

## Phase 2 — Employee + contracts

**New models:** EmploymentContract, CompensationRevision (names flexible).  
**Files:** `app/hr/employees/page.js`, `app/api/employees/**`, schema.

**Tasks:** unique (tenantId, employeeNumber); contract states; effective dating; payroll reads contract version for period.

**Exit:** Employee cannot have overlapping ACTIVE contracts; payroll preview uses contract.

---

## Phase 3 — Leave + attendance

Consolidate leave APIs; accrual idempotency keys; attendance approval + export lock; OT as approved records; minute-based durations.

**Exit:** Unapproved attendance cannot enter payroll snapshot.

---

## Phase 4 — Catalogues + disciplinary

Extend Benefit/Deduction with taxable/pensionable/effective dates; EmployeeBenefit.tenantId; disciplinary case → approved penalty input only.

---

## Phase 5 — Pension / gratuity / advances

Versioned NPS rules; contribution/remittance identities; advance FK + unique recovery; dedicated ADVANCE_DISBURSEMENT posting (not PAYROLL_POSTED).

---

## Phase 6 — Rules engine

Component catalogue; formula templates (no eval); calculation order doc; input snapshot; EmployeePayrollResult + components; explanation JSON; Decimal throughout; consolidate Malawi + generic calc.

**Libs to refactor:** `lib/payrollCalculations.js`, `lib/malawiTaxUtils.js`, `lib/payrollEngine/**` → `lib/payrollV2/**` (or equivalent).

---

## Phase 7 — Run state machine + Review Workbench

Commands: create/load/validate/calculate/submit/approve/post/pay/reverse/replace.  
UI: evolve `/hr/payroll` into review workbench; retire/merge `/hr/payroll/create`.

---

## Phase 8 — Accounting + payment

Implement [PAYROLL_ACCOUNTING_POSTING_MATRIX.md](./PAYROLL_ACCOUNTING_POSTING_MATRIX.md); journalId on run; payment batches; remittances; reversePayroll EXTEND.

---

## Phase 9 — Reports & reconciliation

Traceability chain; reconciliation centre; fix false-zero; PAYE nav; exports permission re-check.

---

## Phase 10 — Governance & tests

Fine-grained permissions; SoD flags; audit events; notifications; import Dry Run; full automated matrix + E2E scenarios 1–10; production build.

---

## Explicit non-goals (until later)

- Cosmetic redesign of all HR pages  
- Piece-rate / full commission engine beyond approved inputs  
- Mobile kiosk polish before calc correctness  

## Dependency on other programmes

Reuse accounting V2 cutover (`postPayrollAccounting`), CoA salary enforcement, purchases-style audit discipline.

## Go / No-go

| Gate | Criteria |
|------|----------|
| Start Phase 1 code | This plan + gap register approved |
| Start Phase 6 engine | Contracts + approved attendance/leave inputs available |
| Start Phase 8 posting | Engine produces checksummed results |
| Production claim | Critical+High gaps closed; tests green; TB balances on scenarios |
