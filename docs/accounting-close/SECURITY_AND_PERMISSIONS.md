# Security and Permissions

Module: `accountingClose` in `permissionsMap.js`.  
Keys: `lib/accountingClose/permissions.js`.

Enforcement: `guardCloseRoute` + feature flag `accountingCloseV2Enabled` + session tenant scope on every query.

Separation of duties: reopen requester cannot approve own request; closing batch approver preference ≠ generator (audited if same).
