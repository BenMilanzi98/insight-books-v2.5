export {
  AUTOMATION_STATUS,
  ACCEPTANCE_CRITERIA,
  listAcceptanceCriteria,
  summarizeAcceptanceCoverage,
} from './acceptanceCriteriaRegistry.js';

export {
  ARCHITECTURE_INVARIANTS,
  listArchitectureInvariants,
  validateArchitectureInvariants,
} from './architectureInvariantRegistry.js';

export {
  RELEASE_DECISION,
  evaluateMraEisReleaseReadiness,
} from './releaseGateEngine.js';

export {
  scanTextForSecrets,
  scanPathsForSecrets,
  scanObjectForSecrets,
} from './secretLeakScanner.js';

export {
  buildSyntheticTenantSet,
  buildSyntheticTerminals,
  buildSyntheticTransactions,
  assertSyntheticFixturesSafe,
} from './syntheticFixtures.js';

export {
  DEFECT_SEVERITY,
  DEFECT_STATE,
  registerDefect,
  updateDefect,
  listDefects,
  summarizeDefects,
  seedPhase20CarryForwardBlockers,
  __resetDefectsForTests,
} from './defectRegister.js';
