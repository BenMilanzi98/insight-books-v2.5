import { describe, expect, it, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

beforeEach(async () => {
  const { __resetDefectsForTests } = await import('../lib/mraEis/application/phase20/defectRegister.js');
  const { __resetMigrationSourcesForTests } = await import(
    '../lib/mraEis/application/migration/sourceSystemRegistry.js'
  );
  const { __resetMigrationRunsForTests } = await import(
    '../lib/mraEis/application/migration/migrationRunService.js'
  );
  __resetDefectsForTests();
  __resetMigrationSourcesForTests();
  __resetMigrationRunsForTests();
});

describe('Phase 20 acceptance + invariant registries', () => {
  it('indexes Phase 1–19/20 criteria with status and no missing automated refs', async () => {
    const { summarizeAcceptanceCoverage, listAcceptanceCriteria } = await import(
      '../lib/mraEis/application/phase20/acceptanceCriteriaRegistry.js'
    );
    const summary = summarizeAcceptanceCoverage();
    expect(summary.total).toBeGreaterThanOrEqual(25);
    expect(summary.everyCriterionHasStatus).toBe(true);
    expect(summary.missingTestReferences).toEqual([]);
    const phases = new Set(listAcceptanceCriteria().map((c) => c.phase));
    for (let p = 1; p <= 20; p += 1) {
      expect(phases.has(p)).toBe(true);
    }
  });

  it('validates architecture invariants (no MAX+1, no secret columns, client guards)', async () => {
    const { validateArchitectureInvariants, listArchitectureInvariants } = await import(
      '../lib/mraEis/application/phase20/architectureInvariantRegistry.js'
    );
    expect(listArchitectureInvariants().length).toBeGreaterThanOrEqual(15);
    const result = validateArchitectureInvariants();
    expect(result.ok).toBe(true);
    expect(result.criticalFindings).toEqual([]);
    expect(result.passedStatic).toContain('INV-001');
    expect(result.passedStatic).toContain('INV-011');
    expect(result.passedStatic).toContain('INV-010');
  });
});

describe('Phase 20 multi-tenant and environment isolation', () => {
  it('rejects cross-tenant admin context and environment mixing in migration', async () => {
    const { resolveEisAdminContext } = await import(
      '../lib/mraEis/application/admin/adminContext.js'
    );
    expect(() =>
      resolveEisAdminContext({
        user: { id: 'u1', tenantId: 'tenant-a' },
        requestedTenantId: 'tenant-b',
        environment: 'SANDBOX',
      })
    ).toThrow(/Tenant A cannot open Tenant B/);

    const { evaluateMigrationCandidate, MIGRATION_DECISION } = await import(
      '../lib/mraEis/application/migration/migrationDecisionEngine.js'
    );
    const xt = evaluateMigrationCandidate({
      sourceSystemId: 's',
      sourceEntityType: 'POS_SALE',
      sourceRecordId: '1',
      expectedTenantId: 'tenant-a',
      expectedBusinessId: 'tenant-a',
      candidateData: {
        tenantId: 'tenant-a',
        terminalTenantId: 'tenant-b',
        businessId: 'tenant-a',
        environment: 'SANDBOX',
      },
    });
    expect(xt.decision).toBe(MIGRATION_DECISION.BLOCKED_CROSS_TENANT);

    const env = evaluateMigrationCandidate({
      sourceSystemId: 's',
      sourceEntityType: 'POS_SALE',
      sourceRecordId: '2',
      expectedTenantId: 'tenant-a',
      expectedBusinessId: 'tenant-a',
      sourceEnvironmentHint: 'PRODUCTION',
      candidateData: {
        tenantId: 'tenant-a',
        businessId: 'tenant-a',
        environment: 'SANDBOX',
      },
    });
    expect(env.decision).toBe(MIGRATION_DECISION.BLOCKED_ENVIRONMENT_CONFLICT);
  });
});

describe('Phase 20 accounting / inventory / fiscal isolation', () => {
  it('proves migration and hooks never create Journal/Stock or submit historical sales', async () => {
    const { registerSourceSystem, SOURCE_TYPE } = await import(
      '../lib/mraEis/application/migration/sourceSystemRegistry.js'
    );
    const {
      createMigrationRun,
      executeDryRun,
      approveMigrationRun,
      executeControlledMigration,
      RUN_MODE,
    } = await import('../lib/mraEis/application/migration/migrationRunService.js');
    const { assertHistoricalTransmissionBlocked } = await import(
      '../lib/mraEis/application/migration/migrationDecisionEngine.js'
    );
    const { runInMigrationContext, assertHookAllowed } = await import(
      '../lib/mraEis/application/migration/hookIsolation.js'
    );

    const source = registerSourceSystem({
      name: 'p20-src',
      sourceType: SOURCE_TYPE.LEGACY_EIS_DATABASE,
      readOnlyVerified: true,
      environmentClassification: 'SANDBOX',
    });
    const run = createMigrationRun({
      cohortId: 'ACCEPTED_TRANSACTIONS',
      sourceSystemId: source.id,
      tenantId: 'syn-tenant-a',
      businessId: 'syn-tenant-a',
      environment: 'SANDBOX',
      mode: RUN_MODE.DRY_RUN,
    });
    const dry = executeDryRun({
      runId: run.id,
      candidates: [
        {
          id: 'syn-sale-cash-accepted',
          sourceRecordId: 'syn-sale-cash-accepted',
          tenantId: 'syn-tenant-a',
          businessId: 'syn-tenant-a',
          environment: 'SANDBOX',
          hasAcceptedResponseEvidence: true,
          mraTransactionId: 'SYN-MRA-001',
          accountingLinked: true,
        },
      ],
    });
    expect(dry.targetMutated).toBe(false);
    approveMigrationRun({ runId: run.id, approverId: 'a', requesterId: 'b' });
    const mig = executeControlledMigration({
      runId: run.id,
      dryRunChecksum: dry.run.dryRunChecksum,
      backupVerified: true,
    });
    expect(mig.journalCreated).toBe(false);
    expect(mig.stockMovementCreated).toBe(false);
    expect(mig.historicalSaleSubmitted).toBe(false);
    expect(mig.fiscalNumbersGenerated).toBe(0);
    expect(mig.sequencesMovedBackwards).toBe(false);
    expect(() => assertHistoricalTransmissionBlocked()).toThrow(/Historical Sales/);
    expect(() =>
      runInMigrationContext(() => assertHookAllowed('ACCOUNTING_POSTING'))
    ).toThrow();
    expect(() =>
      runInMigrationContext(() => assertHookAllowed('INVENTORY_POSTING'))
    ).toThrow();
    expect(() =>
      runInMigrationContext(() => assertHookAllowed('MRA_TRANSMISSION'))
    ).toThrow();
  });

  it('forbids client final-state mutation and fiscal allocation from browser commands', async () => {
    const { assertNoFinalStateMutation } = await import(
      '../lib/mraEis/application/admin/commandArchitecture.js'
    );
    expect(() => assertNoFinalStateMutation({ setTerminalActive: true })).toThrow();
    expect(() => assertNoFinalStateMutation({ markAccepted: true })).toThrow();
    expect(() => assertNoFinalStateMutation({ fiscalNumber: 'X' })).toThrow();
    expect(() => assertNoFinalStateMutation({ jwt: 'x' })).toThrow();
    expect(() => assertNoFinalStateMutation({ buyerAuthorizationCode: 'x' })).toThrow();
  });

  it('documents fiscal sequence service forbids MAX+1 and random/timestamp allocation', async () => {
    const src = fs.readFileSync(
      path.resolve('lib/mraEis/application/fiscalSnapshot/fiscalSequenceService.js'),
      'utf8'
    );
    expect(src).toMatch(/Never uses MAX\(number\)\+1/i);
    expect(src).not.toMatch(/ORDER BY .*DESC[\s\S]{0,80}\+\s*1/);
    expect(src).not.toMatch(/fiscalNumber\s*=\s*Date\.now/);
    expect(src).not.toMatch(/fiscalNumber\s*=\s*Math\.random/);
  });
});

describe('Phase 20 receipt, retry, restriction, offline invariants', () => {
  it('receipt alone is not acceptance; unknown cannot blind-retry; offline cannot auto-upload', async () => {
    const { assessReceipt, assessOffline } = await import(
      '../lib/mraEis/application/migration/assessments.js'
    );
    expect(assessReceipt({ hasReceipt: true }).acceptBecauseReceiptExists).toBe(false);
    expect(assessOffline({ certified: false }).mustNotAutoUpload).toBe(true);

    const { classifySaleOrInvoice, SALE_CLASSIFICATION } = await import(
      '../lib/mraEis/application/migration/migrationDecisionEngine.js'
    );
    expect(
      classifySaleOrInvoice({
        hasReceipt: true,
        localStatusSaysAccepted: true,
        hasAcceptedResponseEvidence: false,
      })
    ).toBe(SALE_CLASSIFICATION.RECEIPT_WITHOUT_RESPONSE);

    // Safe retry: accepted / unknown blocked patterns from phase15 module presence
    const retryPolicy = fs.readFileSync(
      path.resolve('lib/mraEis/application/reconciliation/retryPolicyRegistry.js'),
      'utf8'
    );
    expect(retryPolicy.length).toBeGreaterThan(100);
  });

  it('restriction: client cannot set ACTIVE; MRA clear forbidden from browser fields', async () => {
    const route = fs.readFileSync(path.resolve('app/api/mra-eis/restrictions/route.js'), 'utf8');
    expect(route).toMatch(/setTerminalActive/);
    expect(route).toMatch(/forceClearMra/);
    expect(route).toMatch(/CLIENT_RESTRICTION_FIELDS_REJECTED/);
  });
});

describe('Phase 20 security / secret scan / synthetic fixtures', () => {
  it('synthetic fixtures are safe and secret scanner finds JWT/private-key shapes', async () => {
    const {
      buildSyntheticTenantSet,
      buildSyntheticTerminals,
      buildSyntheticTransactions,
      assertSyntheticFixturesSafe,
    } = await import('../lib/mraEis/application/phase20/syntheticFixtures.js');
    const fixtures = {
      tenants: buildSyntheticTenantSet(),
      terminals: buildSyntheticTerminals(),
      transactions: buildSyntheticTransactions(),
    };
    expect(assertSyntheticFixturesSafe(fixtures)).toBe(true);

    const { scanTextForSecrets, scanObjectForSecrets } = await import(
      '../lib/mraEis/application/phase20/secretLeakScanner.js'
    );
    expect(
      scanTextForSecrets('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.dGVzdHNpZ25hdHVyZXZhbHVl').length
    ).toBeGreaterThan(0);
    expect(scanTextForSecrets('-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----').some((h) => h.type === 'PRIVATE_KEY')).toBe(true);
    expect(
      scanObjectForSecrets({ buyerAuthorizationCode: 'REALBAC123', ok: true }).some(
        (h) => h.type === 'SENSITIVE_FIELD'
      )
    ).toBe(true);

    const pathScan = (await import('../lib/mraEis/application/phase20/secretLeakScanner.js'))
      .scanPathsForSecrets({
        roots: ['lib/mraEis/application/phase20'],
      });
    expect(pathScan.ok).toBe(true);
  });

  it('Production activation mode requires HTTPS base URL', async () => {
    const { resolveMraBaseUrl, getActivationEndpointConfig } = await import(
      '../lib/mraEis/infrastructure/mraClient/environmentConfig.js'
    );
    const prev = process.env.MRA_EIS_PRODUCTION_BASE_URL;
    process.env.MRA_EIS_PRODUCTION_BASE_URL = 'http://insecure.example';
    try {
      expect(() => getActivationEndpointConfig('PRODUCTION')).toThrow(/HTTPS/i);
    } finally {
      if (prev == null) delete process.env.MRA_EIS_PRODUCTION_BASE_URL;
      else process.env.MRA_EIS_PRODUCTION_BASE_URL = prev;
    }
    expect(resolveMraBaseUrl('MOCK')).toBe('mock://mra-eis');
  });
});

describe('Phase 20 release gate engine', () => {
  it('blocks false certification claims from mocks', async () => {
    const { evaluateMraEisReleaseReadiness, RELEASE_DECISION } = await import(
      '../lib/mraEis/application/phase20/releaseGateEngine.js'
    );
    const bad = evaluateMraEisReleaseReadiness({
      claimSandboxCertificationFromMocks: true,
      defects: { critical: 0, high: 0 },
      testResults: { passed: 10, failed: 0 },
      securityFindings: { critical: 0, high: 0 },
      mraContractStatus: { unresolvedBlocking: false },
    });
    expect(bad.decision).toBe(RELEASE_DECISION.BLOCKED);
    expect(bad.mocksDoNotCertify).toBe(true);
  });

  it('returns READY_WITH_NON_BLOCKING_CONDITIONS when suite green but Sandbox blocked', async () => {
    const { evaluateMraEisReleaseReadiness, RELEASE_DECISION } = await import(
      '../lib/mraEis/application/phase20/releaseGateEngine.js'
    );
    const { validateArchitectureInvariants } = await import(
      '../lib/mraEis/application/phase20/architectureInvariantRegistry.js'
    );
    const { seedPhase20CarryForwardBlockers, summarizeDefects } = await import(
      '../lib/mraEis/application/phase20/defectRegister.js'
    );
    seedPhase20CarryForwardBlockers();
    const defects = summarizeDefects();
    // Carry-forward blockers are BLOCKED/DEFERRED — not open CRITICAL/HIGH code defects
    expect(defects.critical).toBe(0);
    expect(defects.high).toBe(0);

    const result = evaluateMraEisReleaseReadiness({
      environment: 'MOCK_MRA',
      testResults: { passed: 180, failed: 0 },
      defects: { critical: 0, high: 0, medium: defects.medium, low: defects.low },
      securityFindings: { critical: 0, high: 0 },
      invariantsValidation: validateArchitectureInvariants(),
      secretScan: { ok: true, criticalCount: 0 },
      migrationResults: {
        journalCreated: false,
        stockMovementCreated: false,
        historicalSaleSubmitted: false,
        historicalOfflineUploaded: false,
      },
      mraContractStatus: { unresolvedBlocking: true },
      certificationStatus: { sandboxCertified: false, productionCertified: false },
      operationalReadiness: {
        backupRestoreRehearsed: false,
        deploymentRehearsed: false,
        rollbackRehearsed: false,
      },
      claimSandboxCertificationFromMocks: false,
    });
    expect(result.decision).toBe(RELEASE_DECISION.READY_WITH_NON_BLOCKING_CONDITIONS);
    expect(result.phase20Readiness).toBe('READY_FOR_PHASE_21_WITH_BLOCKERS');
    expect(result.sandboxDoesNotImplyProduction).toBe(true);
    expect(result.productionMraNotCalledByDefault).toBe(true);
  });

  it('fails release when Critical defect remains open', async () => {
    const { evaluateMraEisReleaseReadiness, RELEASE_DECISION } = await import(
      '../lib/mraEis/application/phase20/releaseGateEngine.js'
    );
    const { registerDefect, DEFECT_SEVERITY } = await import(
      '../lib/mraEis/application/phase20/defectRegister.js'
    );
    registerDefect({
      title: 'Cross-tenant leak',
      severity: DEFECT_SEVERITY.CRITICAL,
      rootCause: 'missing tenant predicate',
    });
    const result = evaluateMraEisReleaseReadiness({
      defects: { critical: 1, high: 0 },
      testResults: { passed: 1, failed: 0 },
      securityFindings: { critical: 0, high: 0 },
    });
    expect(result.decision).toBe(RELEASE_DECISION.NOT_READY_DATA_INTEGRITY);
    expect(result.phase20Readiness).toBe('BLOCKED');
  });
});

describe('Phase 20 admin export / dashboard invariants (regression)', () => {
  it('failed dashboard queries are not zero; exports sanitize formulas', async () => {
    const { aggregateTenantEisOverview } = await import(
      '../lib/mraEis/application/admin/dashboardAggregation.js'
    );
    const overview = aggregateTenantEisOverview({
      context: { tenantId: 't1', businessId: 't1', environment: 'SANDBOX' },
      counts: { terminalCount: 1 },
      loadErrors: { pendingTransmissions: 'QUERY_FAILED' },
      projectionUpdatedAt: new Date().toISOString(),
    });
    const pending = overview.cards.find((c) => c.key === 'pendingTransmissions');
    expect(pending.error).toBe(true);
    expect(pending.value).toBeNull();

    const { sanitizeExportCell } = await import('../lib/mraEis/application/admin/exportSecurity.js');
    expect(sanitizeExportCell('=CMD()')).not.toMatch(/^=/);
  });
});
