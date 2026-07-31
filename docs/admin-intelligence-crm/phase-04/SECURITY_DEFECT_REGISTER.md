# Phase 4 Security / Quality Defect Register

| ID | Severity | Item | Status |
|----|----------|------|--------|
| P4-D01 | High | No AnalyticsEvent plane | Mitigated (schema + lib) |
| P4-D02 | High | Dual-write without idempotency | Mitigated (idempotencyKey) |
| P4-D03 | Medium | Pipeline APIs unscoped | Mitigated (`requireAdminDecision`) |
| P4-D04 | Medium | PII in payloads | Mitigated (redaction) |
| P3 leftovers | High | See phase-03 SECURITY_DEFECT_REGISTER | Tracked separately |
