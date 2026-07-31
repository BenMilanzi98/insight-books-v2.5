# Security and Permissions

## Permissions (`lib/accountingV2/permissions.js`)

`accountingRepair.view`, `.investigate`, `.addEvidence`, `.propose`,
`.preview`, `.approve`, `.execute`, `.verify`, `.rollback`, `.acceptException`,
`.export`, `.manageBatches`, `.rebuildLedger`, `.viewSensitiveEvidence` —
mapped in the role matrix alongside the existing accounting permissions
(auditors get read-only view/export; only finance-manager-level roles hold
approve; execute and approve are grantable to different people to support
separation of duties).

## Enforcement layers

1. **Route guards** — every API action checks its permission server-side.
2. **Business scope** — the accounting context pins `tenantId`; every service
   query filters by it; foreign ids read as "not found" (no existence leak).
3. **Separation of duties** — proposal ≠ decision (registry), approval ≠
   execution (execution service + posting engine), request ≠ batch approval
   (batch service). All are hard server-side errors, not UI hints.
4. **Confidence + permitted-repair gates** — see the approval workflow doc.
5. **Mass assignment** — impossible: commands are rebuilt server-side from
   whitelisted fields; metadata targets/fields come from a static whitelist;
   journal lines must match the approved proposal on the anomaly.
6. **No dangerous surface** — no SQL execution, no debit/credit editing, no
   posted-journal deletion, no unrestricted account reassignment anywhere in
   the API, console or CLI.
7. **Audit** — every action (including denials of interest) logs with user,
   business, request id and correlation id to the immutable audit trail;
   super-administrator activity is logged like any other actor.

Security tests cover: unauthorized repair, unauthorized approval,
cross-business anomaly/journal access, executor approving own high-risk repair,
changed instructions under a claimed identity, and metadata mass-assignment
attempts.

Sensitive evidence (attachments, bank references) requires
`viewSensitiveEvidence`; logs never include attachment contents or full bank
details (see `OBSERVABILITY_GUIDE.md`).
