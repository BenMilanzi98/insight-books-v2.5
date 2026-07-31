# Accounting Permission Matrix

Catalogue: `lib/accountingV2/permissions.js` (`ACCOUNTING_PERMISSIONS`), layered on the
existing framework (`hasPermission`/`requirePermission` in `lib/auth.js`; Owner/Admin
full-access roles pass through the existing role logic and remain explicit in `hasPermission`).
Authorization is always server-side and business-scoped (context from session, never client
input).

| Permission | Grants | Owner/Admin | Finance Manager | Accountant | Auditor | Cashier/POS |
|---|---|---|---|---|---|---|
| accounting.view | Accounting module visibility | ✓ | ✓ | ✓ | ✓ (read) | — |
| accounting.configure | Accounting settings | ✓ | ✓ | — | — | — |
| coa.view / coa.manage | Chart of accounts read / maintain | ✓/✓ | ✓/✓ | ✓/— | ✓/— | — |
| journal.view | Read journals | ✓ | ✓ | ✓ | ✓ | — |
| journal.create | Create draft journals | ✓ | ✓ | ✓ | — | — |
| journal.approve | Approve pending journals | ✓ | ✓ | — | — | — |
| journal.post | Post approved journals | ✓ | ✓ | ✓ | — | — |
| journal.reverse | Reverse posted journals | ✓ | ✓ | — | — | — |
| ledger.view / trialBalance.view | GL / TB reports | ✓ | ✓ | ✓ | ✓ | — |
| receivables.view / payables.view | Subledgers | ✓ | ✓ | ✓ | ✓ | — |
| periods.view | Period listing | ✓ | ✓ | ✓ | ✓ | — |
| periods.close / periods.reopen | Period control | ✓/✓ | ✓/✓ | — | — | — |
| capital.view / capital.record / capital.approve | Equity | ✓ | ✓/✓/✓ | ✓/—/— | ✓/—/— | — |
| accountingAudit.view | Forensic audit + architecture status (read) | ✓ | ✓ | — | ✓ | — |
| accountingArchitecture.configure | Posting modes, configuration | ✓ | — | — | — | — |
| accountingFeatureFlags.manage | Accounting flags | ✓ | — | — | — | — |

Rules enforced in Phase 2 code:

- `/api/system/accounting-architecture` GET requires architecture permission or
  `accountingAudit.view`; POST requires architecture/flag permission; every change needs a
  reason and writes an audit record.
- Tenant admins cannot manage flags/configuration for other tenants or global (`*`) scope;
  global scope is reserved for platform operations (no tenant on session).
- `accountingV2Enabled` cannot be switched on through the API at all in Phase 2.
- Auditor behaviour is read-only by granting only `*.view` keys.
- Branch/department restrictions ride on the existing `userBranches` mechanism and the
  `branchId` context field for ledger queries.

Role wiring into seeded role permission-sets is Phase 9 work (routes adopt these keys as they
are migrated); the keys are the single naming source from now on.
