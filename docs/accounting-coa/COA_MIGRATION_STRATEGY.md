# CoA Migration Strategy & Rollback (Phase 3 §W)

## 1. Stage-gated approach

| Stage | What | State |
|---|---|---|
| 1 | Additive schema (`20260720130000_coa_v2_governance`): 27 nullable `Account` columns + 5 new tables (`CoaV2AccountMapping`, `CoaV2AccountAlias`, `CoaV2Template`, `CoaV2TemplateAccount`, `CoaV2ConsolidationPlan`) + indexes | Applied |
| 2 | Classification backfill (`npm run coa:classify:apply`): derives category/subtype/behaviour/normal balance/FS/CF from blueprint matches or unambiguous legacy types; ambiguous rows go to a manual-review file, never guessed | Applied — 540/540 classified, 0 manual-review rows |
| 3 | Governance activation: templates seeded, registry mappings assigned per business, `coaV2CanonicalMappings` flag flipped per business | Templates seeded; mappings/flags per business pending rollout |
| 4 | Constraint tightening (`tenantId NOT NULL`, duplicate-column retirement) | Deferred to a separate approved migration after production verification |

Rules held throughout: strictly additive DDL; no destructive changes; no historical journal
modification; reruns are idempotent (backfill skips already-classified rows; template seed
skips existing versions).

## 2. Deployment procedure

1. `npx prisma migrate deploy` (additive DDL only — safe with live traffic).
2. `npm run coa:classify` (dry-run; review counts) → `npm run coa:classify:apply`.
3. `npm run coa:seed-templates`.
4. `npm run coa:governance` (`all`) to regenerate the duplicate register, readiness and
   salary artifacts.
5. `npm run audit:forensic:coa-v2` — expect 0 CRITICAL findings before enabling flags.
6. Per business: assign purpose mappings (API/console), then enable
   `coaV2CanonicalMappings`.

## 3. Rollback

- **Flags first**: disabling `coaV2CanonicalMappings` instantly returns resolution to the
  Phase 2 legacy blueprint adapter — no schema action needed.
- **Backfill**: V2 columns are ignored by all legacy code paths; clearing them is
  `UPDATE "Account" SET "coaV2Category"=NULL, …` (documented, but normally unnecessary).
- **Schema**: the migration is reversible with `DROP TABLE` on the five `CoaV2*` tables and
  `ALTER TABLE "Account" DROP COLUMN …` for the added columns — no legacy column or row is
  ever touched, so legacy behaviour is fully preserved at every stage.

## 4. Failure handling

The governance CLI runs stages independently; a failure in one step (e.g. the duplicates
step) leaves previously applied steps consistent and rerunnable. All writes happen in
transactions per account/template row.
