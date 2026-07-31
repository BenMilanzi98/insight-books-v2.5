-- Phase 12: pre-enable Accounting Close V2 globally (tenantId = '*').
-- Explicit tenant-scoped enabled=false rows still override this.

INSERT INTO "AcctV2FeatureFlag" ("id", "tenantId", "flagKey", "moduleKey", "eventType", "enabled", "reason", "updatedBy", "createdAt", "updatedAt")
VALUES
  (concat('closeflag_', md5(random()::text || clock_timestamp()::text)), '*', 'accountingCloseV2Enabled', '*', '*', true, 'Phase 12 pre-enabled by default', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('closeflag_', md5(random()::text || clock_timestamp()::text)), '*', 'monthEndCloseV2Enabled', '*', '*', true, 'Phase 12 pre-enabled by default', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('closeflag_', md5(random()::text || clock_timestamp()::text)), '*', 'yearEndCloseV2Enabled', '*', '*', true, 'Phase 12 pre-enabled by default', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('closeflag_', md5(random()::text || clock_timestamp()::text)), '*', 'yearEndAdjustmentsV2Enabled', '*', '*', true, 'Phase 12 pre-enabled by default', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('closeflag_', md5(random()::text || clock_timestamp()::text)), '*', 'adjustedTrialBalanceV2Enabled', '*', '*', true, 'Phase 12 pre-enabled by default', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('closeflag_', md5(random()::text || clock_timestamp()::text)), '*', 'closingJournalV2Enabled', '*', '*', true, 'Phase 12 pre-enabled by default', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('closeflag_', md5(random()::text || clock_timestamp()::text)), '*', 'postClosingTrialBalanceV2Enabled', '*', '*', true, 'Phase 12 pre-enabled by default', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('closeflag_', md5(random()::text || clock_timestamp()::text)), '*', 'annualSnapshotsV2Enabled', '*', '*', true, 'Phase 12 pre-enabled by default', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('closeflag_', md5(random()::text || clock_timestamp()::text)), '*', 'financialYearClosureV2Enabled', '*', '*', true, 'Phase 12 pre-enabled by default', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('closeflag_', md5(random()::text || clock_timestamp()::text)), '*', 'financialYearReopenV2Enabled', '*', '*', true, 'Phase 12 pre-enabled by default', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('closeflag_', md5(random()::text || clock_timestamp()::text)), '*', 'financialYearRecloseV2Enabled', '*', '*', true, 'Phase 12 pre-enabled by default', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('closeflag_', md5(random()::text || clock_timestamp()::text)), '*', 'closeIntegrityMonitoringV2Enabled', '*', '*', true, 'Phase 12 pre-enabled by default', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "flagKey", "moduleKey", "eventType")
DO UPDATE SET
  "enabled" = EXCLUDED."enabled",
  "reason" = EXCLUDED."reason",
  "updatedBy" = EXCLUDED."updatedBy",
  "updatedAt" = CURRENT_TIMESTAMP;