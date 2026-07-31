# Security and Permissions

## Permission catalogue

Defined in `lib/accountingV2/permissions.js` (Phase 2 catalogue + Phase 4
additions):

`accountingPosting.view`, `accountingPosting.preview`,
`accountingPosting.submit`, `accountingPosting.retry`,
`accountingPosting.viewFailures`, `accountingPosting.configure`,
`accountingPosting.manageModes`, `journal.create`, `journal.submit`,
`journal.approve`, `journal.post`, `journal.view`,
`journal.createAdjustment`, `journal.postAdjustment`,
`openingBalances.create`, `openingBalances.approve`, `openingBalances.post`,
`accountingShadow.view`, `accountingDiagnostics.view`.

## Enforcement

- **Server-side only.** `guardAccountingRoute(request, permissions)` resolves
  the session, business scope and permission set before any handler logic;
  role names alone are never trusted. Application services re-check
  permissions via the injected `hasPermission` callback, so internal callers
  cannot skip checks.
- **Business scope on every query and write** — see
  `MULTI-TENANT PROTECTION` below.
- **Separation of duties**: initiator ≠ approver for manual journals,
  adjustments and opening balances (enforced in services + approval
  validation; tested).
- **Auditors** get read-only access through view permissions; no view
  permission grants a mutation.
- **Configuration** (feature flags / posting modes) requires
  `accountingPosting.manageModes`, demands a reason, and is audited. The
  frontend cannot set posting mode, architecture version or approval status.
- **Permission-sensitive actions are audited** (approve, post, mode changes,
  backdated postings).

## Multi-tenant protection

Every entity loaded during posting is validated against the context business:
source, accounts, period, approvals, template permission, bank/customer/
supplier/owner dimensions, attachments, feature-flag scope, shadow records,
audit records, and the journal-number sequence (`tenantId` in the sequence
key). Cross-business IDs are rejected with typed errors even when the IDs are
otherwise valid — covered by the cross-business tests (journal access,
opening-balance access, account validation, period resolution).

## Injection resistance

- Zod schemas (`contracts/apiSchemas.js`) whitelist fields — mass assignment
  onto server-resolved fields is impossible.
- Metadata is JSON-validated, size-limited and rejects prototype-pollution
  keys.
- Errors return safe codes/messages; internal diagnostics stay server-side.
