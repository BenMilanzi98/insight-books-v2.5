/**
 * Phase 18 cutover framework unit tests — does not execute production migration.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  evaluateCutoverAccess,
  CUTOVER_MODES,
  createMigrationManifest,
  sealManifest,
  checksumPayload,
  createLegacyMappingRecord,
  detectMappingConflicts,
  summarizeJournalLines,
  compareControlTotals,
  evaluateStopConditions,
  evaluateGoLiveGates,
  cutoverStopConditionError,
} from '../lib/productionCutover/index.js';

describe('Cutover modes', () => {
  const prev = process.env.CUTOVER_MODE;

  afterEach(() => {
    if (prev === undefined) delete process.env.CUTOVER_MODE;
    else process.env.CUTOVER_MODE = prev;
  });

  it('allows all traffic when off', () => {
    process.env.CUTOVER_MODE = 'off';
    expect(evaluateCutoverAccess({ pathname: '/api/invoices', method: 'POST' }).allow).toBe(true);
  });

  it('blocks non-ops pages in maintenance', () => {
    process.env.CUTOVER_MODE = CUTOVER_MODES.MAINTENANCE;
    const blocked = evaluateCutoverAccess({ pathname: '/dashboard', method: 'GET' });
    expect(blocked.allow).toBe(false);
    expect(blocked.code).toBe('CUTOVER_MAINTENANCE');
    expect(evaluateCutoverAccess({ pathname: '/api/system/health/live', method: 'GET' }).allow).toBe(
      true
    );
  });

  it('blocks financial writes in write_freeze but allows GET', () => {
    process.env.CUTOVER_MODE = CUTOVER_MODES.WRITE_FREEZE;
    expect(evaluateCutoverAccess({ pathname: '/api/invoices', method: 'GET' }).allow).toBe(true);
    const w = evaluateCutoverAccess({ pathname: '/api/invoices', method: 'POST' });
    expect(w.allow).toBe(false);
    expect(w.code).toBe('LEGACY_WRITE_FREEZE');
  });
});

describe('Manifest & legacy mapping', () => {
  it('seals checksum stably', () => {
    const m = createMigrationManifest({ status: 'NOT_STARTED' });
    const sealed = sealManifest(m);
    expect(sealed.checksum).toBe(checksumPayload({ ...sealed, checksum: undefined }));
  });

  it('detects mapping conflicts', () => {
    const a = createLegacyMappingRecord({
      migrationRunId: 'MR1',
      businessId: 'b1',
      entityType: 'Journal',
      legacyId: 'L1',
      targetId: 'T1',
    });
    const b = createLegacyMappingRecord({
      migrationRunId: 'MR1',
      businessId: 'b1',
      entityType: 'Journal',
      legacyId: 'L1',
      targetId: 'T2',
    });
    expect(detectMappingConflicts([a, b]).length).toBe(1);
  });
});

describe('Control totals', () => {
  it('summarizes balanced lines with exact decimals', () => {
    const s = summarizeJournalLines([
      { debit: '100.00', credit: '0' },
      { debit: '0', credit: '100.00' },
    ]);
    expect(s.balanced).toBe(true);
    expect(s.totalDebits).toBe('100.00');
    expect(compareControlTotals(s, s).equal).toBe(true);
  });
});

describe('Stop conditions & go-live gates', () => {
  it('stops on critical findings', () => {
    const r = evaluateStopConditions([{ id: 'SC-TB', triggered: true }]);
    expect(r.mustStop).toBe(true);
    expect(r.decision).toBe('NO_GO');
  });

  it('requires evidence for GO', () => {
    expect(evaluateGoLiveGates({}).decision).toBe('NO_GO');
    const allTrue = Object.fromEntries(
      [
        'backupVerified',
        'restoreVerified',
        'rehearsalPassed',
        'financialReconciliationPassed',
        'securityValidationPassed',
        'technicalValidationPassed',
        'uatPassed',
        'capacityValidated',
        'observabilityActive',
        'alertsActive',
        'hypercareStaffed',
        'rollbackOrForwardReady',
        'financeAcceptance',
        'securityAcceptance',
        'technicalAcceptance',
        'businessAcceptance',
      ].map((k) => [k, true])
    );
    expect(evaluateGoLiveGates(allTrue).decision).toBe('GO');
  });

  it('typed stop error is stopCondition', () => {
    const e = cutoverStopConditionError('TB failed');
    expect(e.stopCondition).toBe(true);
    expect(e.code).toBe('CUTOVER_STOP_CONDITION');
  });
});
