# Notification Authorisation Audit

| Finding | Class |
|---------|-------|
| Notification centre foundation empty | EXTEND |
| No permission-scoped notification store | MISSING |
| Risk of future deep links to forbidden routes | AUDIT_GAP |

**Target:** Notifications carry requiredPermission + scope; drop/undeliver if revoke; no COA deep links.
