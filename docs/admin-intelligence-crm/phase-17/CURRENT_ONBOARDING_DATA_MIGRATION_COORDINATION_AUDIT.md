# Current Onboarding Data Migration Coordination Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Onboarding migration coordination module | NOT_FOUND | Spec `migration.js` under onboarding absent |
| Phase 16 MIGRATION handoff | CORRECT_AND_REUSABLE | `lib/admin/crm/conversions/migrationHandoff.js` — `productionImportExecuted: false` |
| Full migration engine | NOT_AVAILABLE | Out of Phase 17 scope — coordinate only |
| MRA migration tools | WRONG_DOMAIN for Customer data migration | `lib/mraEis/application/migration/*` — fiscal/MRA migration plane |
| File inventory + private storage | NOT_FOUND | FILE_SECURITY_RISK until Wave 3 |
| Upload alone = migration complete | MIGRATION_TRUTH_RISK / FORBIDDEN | Must require recon gate |
| Dry-run / recon gates | NOT_FOUND | Wave 3 |

**Implication:** Wave 3 state machine + file metadata + recon gate; consume MIGRATION handoff; never mark complete on upload alone.
