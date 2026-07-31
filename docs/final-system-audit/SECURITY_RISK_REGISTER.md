# Security Risk Register

| ID | Risk | Severity | Status |
|---|---|---|---|
| SR-001 | Cross-tenant IDOR | CRITICAL | Tests partial; prod pen-test pending |
| SR-002 | Privilege escalation via hidden UI | HIGH | Server-side checks required everywhere |
| SR-003 | Secret leakage in logs/bundles | CRITICAL | mra-eis secret scanner; broaden |
| SR-004 | Mass assignment of status=POSTED/PAID | HIGH | Prefer intent commands (V2) |
| SR-005 | Signed URL / attachment leakage | HIGH | Scope checks required |
| SR-006 | Queue/outbox impersonation | HIGH | Dispatcher must authenticate context |
