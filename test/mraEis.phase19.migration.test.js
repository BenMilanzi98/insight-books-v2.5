import { describe, expect, it, beforeEach } from 'vitest';

beforeEach(async () => {
  const { __resetMigrationSourcesForTests } = await import(
    '../lib/mraEis/application/migration/sourceSystemRegistry.js'
  );
  const { __resetMigrationRunsForTests } = await import(
    '../lib/mraEis/application/migration/migrationRunService.js'
  );
  __resetMigrationSourcesForTests();
  __resetMigrationRunsForTests();
});

describe('Phase 19 source registry', () => {
  it('registers read-only sources and rejects embedded secrets', async () => {
    const {
      registerSourceSystem,
      createExtractionManifest,
      assertSourceChecksumUnchanged,
      SOURCE_TYPE,
    } = await import('../lib/mraEis/application/migration/sourceSystemRegistry.js');
    const { MigrationErrors } = await import(
      '../lib/mraEis/application/migration/migrationErrors.js'
    );

    expect(() =>
      registerSourceSystem({
        name: 'x',
        sourceType: SOURCE_TYPE.LEGACY_EIS_DATABASE,
        readOnlyVerified: false,
      })
    ).toThrow(/read-only/i);

    expect(() =>
      registerSourceSystem({
        name: 'x',
        sourceType: SOURCE_TYPE.LEGACY_EIS_DATABASE,
        readOnlyVerified: true,
        credentialReference: 'password=secret123',
      })
    ).toThrow();

    const source = registerSourceSystem({
      name: 'Assessment DB',
      sourceType: SOURCE_TYPE.LEGACY_EIS_DATABASE,
      environmentClassification: 'SANDBOX',
      tenantScope: 'tenant-a',
      readOnlyVerified: true,
      credentialReference: 'secret-provider://ro-ref-1',
    });
    expect(source.readOnlyVerified).toBe(true);

    const manifest = createExtractionManifest({
      sourceSystemId: source.id,
      dataset: 'sales',
      sourceTableOrFile: 'legacy_sales',
      rows: [{ id: '1', amount: '10.00' }],
    });
    expect(manifest.contentChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(assertSourceChecksumUnchanged({
      manifestId: manifest.id,
      expectedChecksum: manifest.contentChecksum,
    }).contentChecksum).toBe(manifest.contentChecksum);

    expect(() =>
      assertSourceChecksumUnchanged({
        manifestId: manifest.id,
        expectedChecksum: 'deadbeef',
      })
    ).toThrow(/checksum/i);
    expect(MigrationErrors.sourceChecksum().code).toBe('MRA_EIS_MIGRATION_SOURCE_CHECKSUM');
  });
});

describe('Phase 19 ownership and environment', () => {
  it('blocks cross-tenant and never uses default tenant fallback', async () => {
    const { resolveTenantOwnership, classifyEnvironment } = await import(
      '../lib/mraEis/application/migration/ownershipAndEnvironment.js'
    );

    const orphan = resolveTenantOwnership({ record: {} });
    expect(orphan.outcome).toBe('ORPHANED');
    expect(orphan.defaultFallbackUsed).toBe(false);

    const conflict = resolveTenantOwnership({
      record: { tenantId: 'tenant-a' },
      terminalTenantId: 'tenant-b',
    });
    expect(conflict.outcome).toBe('CROSS_TENANT_CONFLICT');
    expect(conflict.blocked).toBe(true);

    const env = classifyEnvironment({
      databaseName: 'production_db',
      recordEnvironment: null,
      sourceEnvironmentHint: null,
    });
    expect(env.environment).toBe('UNKNOWN');
    expect(env.quarantine).toBe(true);

    const mixed = classifyEnvironment({
      recordEnvironment: 'PRODUCTION',
      sourceEnvironmentHint: 'SANDBOX',
    });
    expect(mixed.environment).toBe('CONFLICTING');
  });
});

describe('Phase 19 decision engine scenarios', () => {
  it('scenario: accepted proven migrates historical read-only; receipt-only quarantines', async () => {
    const { evaluateMigrationCandidate, MIGRATION_DECISION, SALE_CLASSIFICATION } = await import(
      '../lib/mraEis/application/migration/migrationDecisionEngine.js'
    );

    const accepted = evaluateMigrationCandidate({
      sourceSystemId: 'src1',
      sourceEntityType: 'POS_SALE',
      sourceRecordId: 's1',
      expectedTenantId: 't1',
      expectedBusinessId: 't1',
      sourceEnvironmentHint: 'PRODUCTION',
      candidateData: {
        tenantId: 't1',
        businessId: 't1',
        environment: 'PRODUCTION',
        hasAcceptedResponseEvidence: true,
        mraTransactionId: 'MRA-1',
        hasReceipt: true,
        accountingLinked: true,
      },
    });
    expect(accepted.decision).toBe(MIGRATION_DECISION.MIGRATE_AS_HISTORICAL_READ_ONLY);
    expect(accepted.saleClassification).toBe(SALE_CLASSIFICATION.EIS_ACCEPTED_PROVEN);
    expect(accepted.historicalTransmissionForbidden).toBe(true);
    expect(accepted.journalCreationForbidden).toBe(true);
    expect(accepted.dispatchable).toBe(false);

    const receiptOnly = evaluateMigrationCandidate({
      sourceSystemId: 'src1',
      sourceEntityType: 'POS_SALE',
      sourceRecordId: 's2',
      expectedTenantId: 't1',
      expectedBusinessId: 't1',
      sourceEnvironmentHint: 'PRODUCTION',
      candidateData: {
        tenantId: 't1',
        businessId: 't1',
        environment: 'PRODUCTION',
        hasReceipt: true,
        localStatusSaysAccepted: true,
        hasAcceptedResponseEvidence: false,
      },
    });
    expect(receiptOnly.decision).toBe(MIGRATION_DECISION.QUARANTINE);
    expect(receiptOnly.saleClassification).toBe(SALE_CLASSIFICATION.RECEIPT_WITHOUT_RESPONSE);
    expect(receiptOnly.fabricateEvidenceForbidden).toBe(true);
  });

  it('scenario: duplicate fiscal numbers and cross-tenant are blocked', async () => {
    const { evaluateMigrationCandidate, MIGRATION_DECISION } = await import(
      '../lib/mraEis/application/migration/migrationDecisionEngine.js'
    );
    const { detectDuplicates } = await import(
      '../lib/mraEis/application/migration/duplicateAndIntegrity.js'
    );

    const dup = detectDuplicates([
      { id: 'a', sourceNaturalKey: 'POS:a', fiscalNumber: 'FN1' },
      { id: 'b', sourceNaturalKey: 'POS:b', fiscalNumber: 'FN1' },
    ]);
    expect(dup.criticalCount).toBeGreaterThan(0);

    const fiscal = evaluateMigrationCandidate({
      sourceSystemId: 'src1',
      sourceEntityType: 'POS_SALE',
      sourceRecordId: 'a',
      expectedTenantId: 't1',
      expectedBusinessId: 't1',
      sourceEnvironmentHint: 'PRODUCTION',
      hasFiscalDuplicateConflict: true,
      candidateData: { tenantId: 't1', businessId: 't1', environment: 'PRODUCTION' },
    });
    expect(fiscal.decision).toBe(MIGRATION_DECISION.BLOCKED_FISCAL_CONFLICT);

    const xt = evaluateMigrationCandidate({
      sourceSystemId: 'src1',
      sourceEntityType: 'POS_SALE',
      sourceRecordId: 'c',
      expectedTenantId: 't1',
      expectedBusinessId: 't1',
      candidateData: {
        tenantId: 't1',
        terminalTenantId: 't2',
        businessId: 't1',
        environment: 'SANDBOX',
      },
    });
    expect(xt.decision).toBe(MIGRATION_DECISION.BLOCKED_CROSS_TENANT);
  });

  it('scenario: historical eligible never submitted is not dispatchable', async () => {
    const { evaluateMigrationCandidate, MIGRATION_DECISION, SALE_CLASSIFICATION, assertHistoricalTransmissionBlocked } =
      await import('../lib/mraEis/application/migration/migrationDecisionEngine.js');

    const r = evaluateMigrationCandidate({
      sourceSystemId: 'src1',
      sourceEntityType: 'POS_SALE',
      sourceRecordId: 'hist1',
      expectedTenantId: 't1',
      expectedBusinessId: 't1',
      sourceEnvironmentHint: 'PRODUCTION',
      candidateData: {
        tenantId: 't1',
        businessId: 't1',
        environment: 'PRODUCTION',
        eisEligible: true,
        hasAnyMraEvidence: false,
        accountingLinked: true,
      },
    });
    expect(r.saleClassification).toBe(SALE_CLASSIFICATION.EIS_ELIGIBLE_NOT_SUBMITTED);
    expect(r.decision).toBe(MIGRATION_DECISION.MIGRATE_AS_HISTORICAL_READ_ONLY);
    expect(r.dispatchable).toBe(false);
    expect(r.warnings).toContain('MUST_NOT_AUTO_SUBMIT');
    expect(() => assertHistoricalTransmissionBlocked()).toThrow(/Historical Sales/);
  });

  it('blocks credential leakage', async () => {
    const { evaluateMigrationCandidate, MIGRATION_DECISION } = await import(
      '../lib/mraEis/application/migration/migrationDecisionEngine.js'
    );
    const r = evaluateMigrationCandidate({
      sourceSystemId: 'src1',
      sourceEntityType: 'POS_SALE',
      sourceRecordId: 'x',
      candidateData: { jwt: 'eyJhbGciOiJIUzI1NiJ9.e30.sig', tenantId: 't1' },
    });
    expect(r.decision).toBe(MIGRATION_DECISION.BLOCKED_SECURITY);
  });
});

describe('Phase 19 assessments', () => {
  it('receipt alone is not acceptance; offline uncertified must not upload', async () => {
    const { assessReceipt, assessOffline, assessTerminal, assessFiscalNumber } = await import(
      '../lib/mraEis/application/migration/assessments.js'
    );
    expect(assessReceipt({ hasReceipt: true }).acceptBecauseReceiptExists).toBe(false);
    expect(assessOffline({ certified: false }).mustNotAutoUpload).toBe(true);
    expect(assessTerminal({ active: true }).mustNotActivate).toBe(true);
    expect(
      assessFiscalNumber({ fiscalNumber: '1', sourceNaturalKey: 'a' }, [
        { fiscalNumber: '1', sourceNaturalKey: 'b' },
      ]).classification
    ).toBe('DUPLICATE_NUMBER');
  });
});

describe('Phase 19 dry-run, migrate, idempotency, rollback', () => {
  it('dry run mutates nothing; migrate is additive and idempotent; rollback preserves lineage', async () => {
    const { registerSourceSystem, SOURCE_TYPE } = await import(
      '../lib/mraEis/application/migration/sourceSystemRegistry.js'
    );
    const {
      createMigrationRun,
      executeDryRun,
      approveMigrationRun,
      executeControlledMigration,
      rollbackMigrationRun,
      RUN_MODE,
    } = await import('../lib/mraEis/application/migration/migrationRunService.js');
    const { runInMigrationContext, assertHookAllowed } = await import(
      '../lib/mraEis/application/migration/hookIsolation.js'
    );

    const source = registerSourceSystem({
      name: 'src',
      sourceType: SOURCE_TYPE.LEGACY_EIS_DATABASE,
      readOnlyVerified: true,
      environmentClassification: 'SANDBOX',
    });

    const run = createMigrationRun({
      cohortId: 'ACCEPTED_TRANSACTIONS',
      sourceSystemId: source.id,
      tenantId: 't1',
      businessId: 't1',
      environment: 'SANDBOX',
      mode: RUN_MODE.DRY_RUN,
      startedBy: 'u1',
    });

    const dry = executeDryRun({
      runId: run.id,
      candidates: [
        {
          id: 's1',
          sourceRecordId: 's1',
          sourceNaturalKey: 'POS_SALE:s1',
          tenantId: 't1',
          businessId: 't1',
          environment: 'SANDBOX',
          hasAcceptedResponseEvidence: true,
          mraTransactionId: 'M1',
          accountingLinked: true,
        },
        {
          id: 's2',
          sourceRecordId: 's2',
          sourceNaturalKey: 'POS_SALE:s2',
          tenantId: 't1',
          businessId: 't1',
          environment: 'SANDBOX',
          hasReceipt: true,
          hasAcceptedResponseEvidence: false,
        },
      ],
    });

    expect(dry.targetMutated).toBe(false);
    expect(dry.journalCreated).toBe(false);
    expect(dry.stockMovementCreated).toBe(false);
    expect(dry.historicalSaleSubmitted).toBe(false);
    expect(dry.expectedInserts).toBeGreaterThanOrEqual(1);
    expect(dry.expectedQuarantines).toBeGreaterThanOrEqual(1);

    approveMigrationRun({
      runId: run.id,
      approverId: 'approver',
      requesterId: 'u1',
      dryRunChecksum: dry.run.dryRunChecksum,
    });

    const mig1 = executeControlledMigration({
      runId: run.id,
      dryRunChecksum: dry.run.dryRunChecksum,
      backupVerified: true,
    });
    expect(mig1.journalCreated).toBe(false);
    expect(mig1.stockMovementCreated).toBe(false);
    expect(mig1.historicalSaleSubmitted).toBe(false);
    expect(mig1.fiscalNumbersGenerated).toBe(0);
    expect(mig1.run.migratedRecords).toBeGreaterThanOrEqual(1);
    const firstMigrated = mig1.run.migratedRecords;

    const mig2 = executeControlledMigration({
      runId: run.id,
      dryRunChecksum: dry.run.dryRunChecksum,
      backupVerified: true,
    });
    expect(mig2.run.linkedRecords).toBeGreaterThanOrEqual(firstMigrated);

    expect(() =>
      runInMigrationContext(() => assertHookAllowed('ACCOUNTING_POSTING'))
    ).toThrow(/forbidden/i);

    const rb = rollbackMigrationRun({ runId: run.id, approvedBy: 'approver' });
    expect(rb.lineagePreserved).toBe(true);
    expect(rb.journalsPreserved).toBe(true);
    expect(rb.stockMovementsPreserved).toBe(true);
    expect(rb.removed).toBeGreaterThanOrEqual(1);
  });

  it('blocks production migrate without approval and backup', async () => {
    const { registerSourceSystem, SOURCE_TYPE } = await import(
      '../lib/mraEis/application/migration/sourceSystemRegistry.js'
    );
    const { createMigrationRun, executeDryRun, executeControlledMigration, RUN_MODE } = await import(
      '../lib/mraEis/application/migration/migrationRunService.js'
    );

    const source = registerSourceSystem({
      name: 'prod-src',
      sourceType: SOURCE_TYPE.CURRENT_INSIGHTBOOKS_DATABASE,
      readOnlyVerified: true,
      environmentClassification: 'PRODUCTION',
    });
    const run = createMigrationRun({
      cohortId: 'ACCEPTED_TRANSACTIONS',
      sourceSystemId: source.id,
      tenantId: 't1',
      businessId: 't1',
      environment: 'PRODUCTION',
      mode: RUN_MODE.DRY_RUN,
    });
    const dry = executeDryRun({
      runId: run.id,
      candidates: [
        {
          id: 'p1',
          sourceRecordId: 'p1',
          tenantId: 't1',
          businessId: 't1',
          environment: 'PRODUCTION',
          hasAcceptedResponseEvidence: true,
          mraTransactionId: 'M',
          accountingLinked: true,
        },
      ],
    });
    expect(() =>
      executeControlledMigration({
        runId: run.id,
        dryRunChecksum: dry.run.dryRunChecksum,
        backupVerified: false,
      })
    ).toThrow(/approval|backup/i);
  });

  it('blocks migrate when dry-run checksum changed', async () => {
    const { registerSourceSystem, SOURCE_TYPE } = await import(
      '../lib/mraEis/application/migration/sourceSystemRegistry.js'
    );
    const { createMigrationRun, executeDryRun, approveMigrationRun, executeControlledMigration, RUN_MODE } =
      await import('../lib/mraEis/application/migration/migrationRunService.js');

    const source = registerSourceSystem({
      name: 's',
      sourceType: SOURCE_TYPE.CSV_PACKAGE,
      readOnlyVerified: true,
      environmentClassification: 'SANDBOX',
    });
    const run = createMigrationRun({
      cohortId: 'RECEIPTS_AND_QR',
      sourceSystemId: source.id,
      tenantId: 't1',
      businessId: 't1',
      environment: 'SANDBOX',
      mode: RUN_MODE.DRY_RUN,
    });
    const dry = executeDryRun({
      runId: run.id,
      candidates: [
        {
          id: 'r1',
          sourceRecordId: 'r1',
          tenantId: 't1',
          businessId: 't1',
          environment: 'SANDBOX',
          hasAcceptedResponseEvidence: true,
          mraTransactionId: 'M',
          accountingLinked: true,
        },
      ],
    });
    approveMigrationRun({ runId: run.id, approverId: 'a', requesterId: 'b' });
    expect(() =>
      executeControlledMigration({
        runId: run.id,
        dryRunChecksum: 'changed-after-dry-run',
        backupVerified: true,
      })
    ).toThrow();
  });
});

describe('Phase 19 hook isolation', () => {
  it('forbids journal, stock, transmission, offline upload, receipt generation hooks', async () => {
    const { runInMigrationContext, assertHookAllowed, isMigrationContext } = await import(
      '../lib/mraEis/application/migration/hookIsolation.js'
    );

    expect(isMigrationContext()).toBe(false);
    runInMigrationContext(() => {
      expect(isMigrationContext()).toBe(true);
      expect(() => assertHookAllowed('ACCOUNTING_POSTING')).toThrow();
      expect(() => assertHookAllowed('INVENTORY_POSTING')).toThrow();
      expect(() => assertHookAllowed('MRA_TRANSMISSION')).toThrow();
      expect(() => assertHookAllowed('OFFLINE_UPLOAD')).toThrow();
      expect(() => assertHookAllowed('RECEIPT_GENERATION')).toThrow();
      expect(() => assertHookAllowed('FISCAL_NUMBER_ALLOCATION')).toThrow();
    });
  });
});
