export { MigrationErrors } from './migrationErrors.js';
export {
  SOURCE_TYPE,
  SOURCE_STATUS,
  registerSourceSystem,
  getSourceSystem,
  listSourceSystems,
  createExtractionManifest,
  getExtractionManifest,
  assertSourceChecksumUnchanged,
  profileDataset,
  __resetMigrationSourcesForTests,
} from './sourceSystemRegistry.js';
export {
  OWNERSHIP_OUTCOME,
  ENVIRONMENT_CLASS,
  resolveTenantOwnership,
  resolveBusinessOwnership,
  classifyEnvironment,
} from './ownershipAndEnvironment.js';
export {
  DUPLICATE_CLASS,
  INTEGRITY_BAND,
  detectDuplicates,
  detectOrphans,
  scoreIntegrity,
} from './duplicateAndIntegrity.js';
export {
  MIGRATION_DECISION,
  SALE_CLASSIFICATION,
  detectCredentialLeak,
  classifySaleOrInvoice,
  evaluateMigrationCandidate,
  assertHistoricalTransmissionBlocked,
} from './migrationDecisionEngine.js';
export {
  RUN_MODE,
  RUN_STATE,
  RECORD_STATE,
  COHORTS,
  createMigrationRun,
  getMigrationRun,
  executeDryRun,
  approveMigrationRun,
  executeControlledMigration,
  rollbackMigrationRun,
  buildReconciliationSummary,
  __resetMigrationRunsForTests,
} from './migrationRunService.js';
export {
  FORBIDDEN_HOOKS,
  runInMigrationContext,
  isMigrationContext,
  assertHookAllowed,
  assertNoJournalFromMigration,
  assertNoStockMovementFromMigration,
  assertNoTransmissionFromMigration,
} from './hookIsolation.js';
export {
  assessTerminal,
  assessConfiguration,
  assessReceipt,
  assessOffline,
  assessFiscalNumber,
} from './assessments.js';
