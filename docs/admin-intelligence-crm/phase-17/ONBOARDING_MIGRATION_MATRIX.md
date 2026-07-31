# Onboarding Migration Matrix

| State / action | Allowed in Phase 17? | Current | Class |
|----------------|----------------------|---------|-------|
| Consume MIGRATION handoff | Yes (coordinate) | Emit only | CORRECT_AND_REUSABLE / UNRECONCILED |
| File inventory metadata | Yes | Absent | NOT_FOUND / FILE_SECURITY_RISK |
| Private storage + scan | Yes | Absent | NOT_FOUND |
| Dry-run | Coordinate | Absent | NOT_FOUND |
| Production import execute | No (engine out of scope) | Forbidden on handoff | NOT_AVAILABLE / FORBIDDEN fabricate |
| Complete on upload alone | No | — | MIGRATION_TRUTH_RISK / FORBIDDEN |
| Financial recon gate | Required before COMPLETED | Absent | NOT_FOUND |
| Customer sign-off | Required per policy | Absent | NOT_FOUND |
| MRA migration modules | Separate plane | `lib/mraEis/application/migration/*` | WRONG_DOMAIN |
