import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import {
  registerSourceSystem,
  listSourceSystems,
  getSourceSystem,
  createExtractionManifest,
  profileDataset,
  createMigrationRun,
  getMigrationRun,
  executeDryRun,
  approveMigrationRun,
  executeControlledMigration,
  rollbackMigrationRun,
  buildReconciliationSummary,
  evaluateMigrationCandidate,
  assertHistoricalTransmissionBlocked,
  assessTerminal,
  assessReceipt,
  assessOffline,
  assessFiscalNumber,
  COHORTS,
  RUN_MODE,
  MigrationErrors,
} from '@/lib/mraEis';
import { MraEisControlError } from '@/lib/mraEis/domain/errors.js';

function errResponse(error) {
  if (error instanceof MraEisControlError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          requiredAction: error.requiredAction,
        },
      },
      { status: error.httpStatus || 400 }
    );
  }
  if (error?.code && String(error.code).startsWith('MRA_EIS_MIGRATION')) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          requiredAction: error.requiredAction,
        },
      },
      { status: error.httpStatus || 400 }
    );
  }
  return NextResponse.json({ error: error.message || 'Migration error' }, { status: 500 });
}

/** Reject dangerous client fields — migration must never transmit, post, or activate. */
function rejectUnsafeClientFields(body = {}) {
  const banned = [
    'jwt',
    'privateKey',
    'terminalSecret',
    'buyerAuthorizationCode',
    'tac',
    'password',
    'submitHistoricalSale',
    'uploadOfflineQueue',
    'createJournal',
    'createStockMovement',
    'allocateFiscalNumber',
    'setTerminalActive',
    'activateCertification',
    'fabricateMraTransactionId',
    'markAccepted',
    'defaultTenantId',
  ];
  for (const key of banned) {
    if (body[key] != null && body[key] !== false) {
      return {
        code: 'MIGRATION_CLIENT_FIELDS_REJECTED',
        message:
          'Client cannot submit historical sales, upload offline queues, create Journals/Stock, allocate fiscal numbers, activate terminals/certification, fabricate evidence, supply credentials/BAC, or assign a default Tenant.',
      };
    }
  }
  return null;
}

export async function GET(request) {
  const user = await getUserFromSession(request);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('runId');
  const sourceId = searchParams.get('sourceId');

  if (runId) {
    const run = getMigrationRun(runId);
    if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    if (run.tenantId && run.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Cross-tenant access denied' }, { status: 403 });
    }
    return NextResponse.json({
      run: sanitizeRun(run),
      reconciliation: buildReconciliationSummary(run),
    });
  }

  if (sourceId) {
    const source = getSourceSystem(sourceId);
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    return NextResponse.json({ source: sanitizeSource(source) });
  }

  return NextResponse.json({
    sources: listSourceSystems().map(sanitizeSource),
    cohorts: COHORTS,
    modes: RUN_MODE,
    invariants: {
      sourceReadOnly: true,
      noDefaultTenant: true,
      receiptIsNotAcceptance: true,
      noHistoricalTransmission: true,
      noJournalFromMigration: true,
      noStockFromMigration: true,
      noFiscalNumberGeneration: true,
      additiveOnly: true,
      dryRunRequiredForProduction: true,
    },
    note: 'Phase 19 migration is additive evidence import only. Ambiguous data defaults to QUARANTINE / MANUAL_REVIEW.',
  });
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const unsafe = rejectUnsafeClientFields(body);
    if (unsafe) return NextResponse.json({ error: unsafe }, { status: 400 });

    const action = body.action;
    const tenantId = user.tenantId;
    const businessId = user.tenantId;

    switch (action) {
      case 'register-source': {
        const source = registerSourceSystem({
          name: body.name,
          sourceType: body.sourceType,
          environmentClassification: body.environmentClassification || 'UNKNOWN',
          tenantScope: body.tenantScope || tenantId,
          businessScope: body.businessScope || businessId,
          databaseEngine: body.databaseEngine,
          schemaVersion: body.schemaVersion,
          sourceTimezone: body.sourceTimezone,
          sourceCurrency: body.sourceCurrency,
          readOnlyVerified: Boolean(body.readOnlyVerified),
          credentialReference: body.credentialReference || null,
          locationReference: body.locationReference || null,
          sourceOwner: body.sourceOwner || user.id,
        });
        return NextResponse.json({ source: sanitizeSource(source) });
      }

      case 'create-manifest': {
        const manifest = createExtractionManifest({
          sourceSystemId: body.sourceSystemId,
          dataset: body.dataset,
          sourceTableOrFile: body.sourceTableOrFile,
          selectionCriteria: body.selectionCriteria || {},
          rows: body.rows || [],
          columns: body.columns || null,
          operatorId: user.id,
        });
        return NextResponse.json({
          manifest: {
            id: manifest.id,
            sourceSystemId: manifest.sourceSystemId,
            dataset: manifest.dataset,
            sourceTableOrFile: manifest.sourceTableOrFile,
            rowCount: manifest.rowCount,
            contentChecksum: manifest.contentChecksum,
            extractionTimestamp: manifest.extractionTimestamp,
          },
        });
      }

      case 'profile-dataset': {
        const profile = profileDataset({
          sourceSystemId: body.sourceSystemId,
          rows: body.rows || [],
          dataset: body.dataset,
        });
        return NextResponse.json({ profile });
      }

      case 'assess-candidate': {
        const result = evaluateMigrationCandidate({
          sourceSystemId: body.sourceSystemId,
          sourceEntityType: body.sourceEntityType || 'POS_SALE',
          sourceRecordId: body.sourceRecordId,
          candidateData: {
            ...(body.candidateData || {}),
            tenantId: body.candidateData?.tenantId || tenantId,
            businessId: body.candidateData?.businessId || businessId,
          },
          expectedTenantId: tenantId,
          expectedBusinessId: businessId,
          sourceEnvironmentHint: body.environment || 'SANDBOX',
          existingCanonicalId: body.existingCanonicalId || null,
          hasFiscalDuplicateConflict: Boolean(body.hasFiscalDuplicateConflict),
          confirmedTestData: Boolean(body.confirmedTestData),
        });
        return NextResponse.json({ result });
      }

      case 'assess-terminal':
        return NextResponse.json({ result: assessTerminal(body.candidate || {}) });
      case 'assess-receipt':
        return NextResponse.json({ result: assessReceipt(body.candidate || {}) });
      case 'assess-offline':
        return NextResponse.json({ result: assessOffline(body.candidate || {}) });
      case 'assess-fiscal-number':
        return NextResponse.json({ result: assessFiscalNumber(body.candidate || {}) });

      case 'create-run': {
        const run = createMigrationRun({
          cohortId: body.cohortId || 'ACCEPTED_TRANSACTIONS',
          sourceSystemId: body.sourceSystemId,
          tenantId,
          businessId,
          environment: body.environment || 'SANDBOX',
          mode: body.mode || RUN_MODE.DRY_RUN,
          startedBy: user.id,
          manifestId: body.manifestId || null,
          transformationVersion: body.transformationVersion || 'migration-transform-v1',
        });
        return NextResponse.json({ run: sanitizeRun(run) });
      }

      case 'dry-run': {
        const out = executeDryRun({
          runId: body.runId,
          candidates: body.candidates || [],
          expectedManifestChecksum: body.expectedManifestChecksum || null,
        });
        return NextResponse.json({
          ...out,
          run: sanitizeRun(out.run),
          reconciliation: buildReconciliationSummary(out.run),
        });
      }

      case 'approve-run': {
        const run = approveMigrationRun({
          runId: body.runId,
          approverId: user.id,
          requesterId: body.requesterId || null,
          dryRunChecksum: body.dryRunChecksum || null,
        });
        return NextResponse.json({ run: sanitizeRun(run) });
      }

      case 'migrate': {
        // Additive evidence import only — never invokes MRA transmit/upload
        const out = executeControlledMigration({
          runId: body.runId,
          dryRunChecksum: body.dryRunChecksum,
          backupVerified: Boolean(body.backupVerified),
        });
        return NextResponse.json({
          ...out,
          run: sanitizeRun(out.run),
          reconciliation: buildReconciliationSummary(out.run),
          historicalSaleSubmitted: false,
          historicalOfflineUploaded: false,
        });
      }

      case 'rollback': {
        const out = rollbackMigrationRun({
          runId: body.runId,
          approvedBy: user.id,
        });
        return NextResponse.json({
          ...out,
          run: sanitizeRun(out.run),
        });
      }

      case 'block-historical-transmit': {
        assertHistoricalTransmissionBlocked({
          action: body.transmitAction || 'SUBMIT_SALE',
          historical: true,
        });
        return NextResponse.json({ blocked: true });
      }

      default:
        return NextResponse.json(
          {
            error: {
              code: 'UNKNOWN_MIGRATION_ACTION',
              message: `Unknown action: ${action}`,
            },
          },
          { status: 400 }
        );
    }
  } catch (error) {
    if (error?.name === 'MigrationError' || MigrationErrors) {
      return errResponse(error);
    }
    return errResponse(error);
  }
}

function sanitizeSource(source) {
  if (!source) return null;
  return {
    id: source.id,
    name: source.name,
    sourceType: source.sourceType,
    environmentClassification: source.environmentClassification,
    tenantScope: source.tenantScope,
    businessScope: source.businessScope,
    databaseEngine: source.databaseEngine,
    schemaVersion: source.schemaVersion,
    readOnlyVerified: source.readOnlyVerified,
    credentialReference: source.credentialReference ? '[REDACTED_REFERENCE]' : null,
    locationReference: source.locationReference,
    sourceTimezone: source.sourceTimezone,
    sourceCurrency: source.sourceCurrency,
    sourceOwner: source.sourceOwner,
    status: source.status,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

function sanitizeRun(run) {
  if (!run) return null;
  return {
    id: run.id,
    cohortId: run.cohortId,
    sourceSystemId: run.sourceSystemId,
    tenantId: run.tenantId,
    businessId: run.businessId,
    environment: run.environment,
    mode: run.mode,
    state: run.state,
    manifestId: run.manifestId,
    manifestChecksum: run.manifestChecksum,
    dryRunChecksum: run.dryRunChecksum,
    resultChecksum: run.resultChecksum,
    transformationVersion: run.transformationVersion,
    startedBy: run.startedBy,
    approvedBy: run.approvedBy,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    totalRecords: run.totalRecords,
    assessedRecords: run.assessedRecords,
    eligibleRecords: run.eligibleRecords,
    migratedRecords: run.migratedRecords,
    linkedRecords: run.linkedRecords,
    quarantinedRecords: run.quarantinedRecords,
    failedRecords: run.failedRecords,
    skippedRecords: run.skippedRecords,
    rollbackEligible: run.rollbackEligible,
    rollbackState: run.rollbackState,
    journalCreated: run.journalCreated,
    stockMovementCreated: run.stockMovementCreated,
    historicalSaleSubmitted: run.historicalSaleSubmitted,
    historicalOfflineUploaded: run.historicalOfflineUploaded,
    recordCount: Array.isArray(run.records) ? run.records.length : 0,
    records: Array.isArray(run.records)
      ? run.records.map((r) => ({
          id: r.id,
          sourceEntityType: r.sourceEntityType,
          sourceRecordId: r.sourceRecordId,
          sourceNaturalKey: r.sourceNaturalKey,
          sourceChecksum: r.sourceChecksum,
          lineageKey: r.lineageKey,
          tenantId: r.tenantId,
          businessId: r.businessId,
          environment: r.environment,
          decision: r.decision,
          integrityScore: r.integrityScore,
          integrityBand: r.integrityBand,
          saleClassification: r.saleClassification,
          targetEntityType: r.targetEntityType,
          targetRecordId: r.targetRecordId,
          targetChecksum: r.targetChecksum,
          state: r.state,
          blockers: r.blockers,
          warnings: r.warnings,
          rollbackState: r.rollbackState,
        }))
      : [],
  };
}
