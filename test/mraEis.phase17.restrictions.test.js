import { describe, expect, it, beforeAll, beforeEach } from 'vitest';

beforeAll(() => {
  process.env.MRA_EIS_ALLOW_TEST_MASTER_KEY = '1';
  process.env.MRA_EIS_DEPLOYMENT_ENV = 'development';
  process.env.MRA_EIS_USE_MOCK = '1';
  process.env.MRA_EIS_RESTRICTION_MEMORY = '1';
});

beforeEach(async () => {
  const { __resetRestrictionsForTests } = await import(
    '../lib/mraEis/application/restrictions/restrictionService.js'
  );
  const { __resetUnblockRequestsForTests } = await import(
    '../lib/mraEis/application/restrictions/unblockService.js'
  );
  const { __resetRestrictionWorkerClaimsForTests } = await import(
    '../lib/mraEis/application/restrictions/restrictionWorkers.js'
  );
  __resetRestrictionsForTests();
  __resetUnblockRequestsForTests();
  __resetRestrictionWorkerClaimsForTests();
});

describe('Phase 17 contracts and registries', () => {
  it('blocks production unblock and keeps HTTP success insufficient', async () => {
    const {
      getMraBlockUnblockContractDecision,
      RESTRICTION_CONTRACT_STATUS,
      getRestrictionSourceRegistry,
      PRECEDENCE_ORDER,
    } = await import('../lib/mraEis/application/restrictions/restrictionRegistries.js');

    const d = getMraBlockUnblockContractDecision();
    expect(d.unblockStatusProduction).toBe(RESTRICTION_CONTRACT_STATUS.BLOCKED);
    expect(d.httpSuccessInsufficientForClearance).toBe(true);
    expect(d.tenantCannotClearMra).toBe(true);
    expect(d.directActiveForbidden).toBe(true);
    expect(getRestrictionSourceRegistry().MRA_SALES_RESPONSE.tenantCannotClear).toBe(true);
    expect(PRECEDENCE_ORDER[0]).toBe('SECURITY_INCIDENT');
  });
});

describe('Phase 17 capability matrix', () => {
  it('blocks fiscalization on MRA block but allows receipts and reconciliation', async () => {
    const { evaluateCapabilityAgainstRestrictions, COMPLIANCE_OPERATION } = await import(
      '../lib/mraEis/application/restrictions/capabilityMatrix.js'
    );
    const restrictions = [
      { id: '1', reasonCode: 'MRA_TERMINAL_BLOCKED', state: 'ACTIVE', sourceType: 'MRA_SALES_RESPONSE' },
    ];
    expect(
      evaluateCapabilityAgainstRestrictions({
        requestedOperation: COMPLIANCE_OPERATION.FINALIZE_EIS_SALE,
        restrictions,
      }).allowed
    ).toBe(false);
    expect(
      evaluateCapabilityAgainstRestrictions({
        requestedOperation: COMPLIANCE_OPERATION.ALLOCATE_FISCAL_NUMBER,
        restrictions,
      }).allowed
    ).toBe(false);
    expect(
      evaluateCapabilityAgainstRestrictions({
        requestedOperation: COMPLIANCE_OPERATION.RUN_RECONCILIATION,
        restrictions,
      }).allowed
    ).toBe(true);
    expect(
      evaluateCapabilityAgainstRestrictions({
        requestedOperation: COMPLIANCE_OPERATION.VIEW_ACCEPTED_RECEIPT,
        restrictions,
      }).allowed
    ).toBe(true);
  });
});

describe('Phase 17 restriction aggregate', () => {
  it('ingests MRA block, blocks sales, preserves coexistence when clearing one of two', async () => {
    const {
      ingestRestriction,
      clearRestriction,
      buildTerminalComplianceProjection,
      listActiveRestrictions,
      RESTRICTION_SOURCE,
      RESTRICTION_SCOPE,
    } = await import('../lib/mraEis/application/restrictions/restrictionService.js');

    const tenantId = 't-p17';
    const businessId = 't-p17';
    const terminalId = 'term-1';

    const mra = await ingestRestriction({
      tenantId,
      businessId,
      terminalId,
      environment: 'SANDBOX',
      sourceType: RESTRICTION_SOURCE.MRA_SALES_RESPONSE,
      sourceReference: 'resp-1',
      reasonCode: 'MRA_TERMINAL_BLOCKED',
      scopeType: RESTRICTION_SCOPE.TERMINAL,
      scopeId: terminalId,
      evidence: { safe: { code: 'BLOCKED' } },
      useMemory: true,
    });
    expect(mra.created).toBe(true);

    const dup = await ingestRestriction({
      tenantId,
      businessId,
      terminalId,
      environment: 'SANDBOX',
      sourceType: RESTRICTION_SOURCE.MRA_SALES_RESPONSE,
      sourceReference: 'resp-1',
      reasonCode: 'MRA_TERMINAL_BLOCKED',
      scopeType: RESTRICTION_SCOPE.TERMINAL,
      scopeId: terminalId,
      evidence: { safe: { code: 'BLOCKED' } },
      useMemory: true,
    });
    expect(dup.duplicated).toBe(true);

    const cert = await ingestRestriction({
      tenantId,
      businessId,
      terminalId,
      environment: 'SANDBOX',
      sourceType: RESTRICTION_SOURCE.CERTIFICATION_CONTROL,
      sourceReference: 'cert-exp',
      reasonCode: 'CERTIFICATION_EXPIRED',
      scopeType: RESTRICTION_SCOPE.CERTIFICATION,
      scopeId: 'cert-1',
      evidence: { safe: { expired: true } },
      useMemory: true,
    });
    expect(cert.created).toBe(true);

    let projection = await buildTerminalComplianceProjection({
      tenantId,
      businessId,
      terminalId,
      environment: 'SANDBOX',
      useMemory: true,
    });
    expect(projection.canFinalizeEisSale).toBe(false);
    expect(projection.mraBlocked).toBe(true);
    expect(projection.activeRestrictionCount).toBe(2);
    expect(projection.canViewAcceptedReceipt).toBe(true);

    // Tenant cannot clear MRA
    await expect(
      clearRestriction({
        tenantId,
        businessId,
        restrictionId: mra.restriction.id,
        clearAuthority: 'TENANT',
        clearanceEvidence: { cleared: true },
        useMemory: true,
      })
    ).rejects.toMatchObject({ code: 'MRA_EIS_TERMINAL_MRA_BLOCKED' });

    // Clear MRA with MRA authority — certification remains
    await clearRestriction({
      tenantId,
      businessId,
      restrictionId: mra.restriction.id,
      clearAuthority: 'MRA',
      clearanceEvidence: { applicationStatus: 'TERMINAL_CLEARED', cleared: true },
      useMemory: true,
    });

    const remaining = await listActiveRestrictions({
      tenantId,
      businessId,
      terminalId,
      environment: 'SANDBOX',
      useMemory: true,
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].reasonCode).toBe('CERTIFICATION_EXPIRED');

    projection = await buildTerminalComplianceProjection({
      tenantId,
      businessId,
      terminalId,
      environment: 'SANDBOX',
      useMemory: true,
    });
    expect(projection.effectiveState).not.toBe('ACTIVE');
    expect(projection.primaryReasonCode).toBe('CERTIFICATION_EXPIRED');
    expect(projection.canFinalizeEisSale).toBe(false);
  });
});

describe('Phase 17 unblock + revalidation', () => {
  it('requires approval, does not clear on HTTP 200 alone, and revalidates before operational', async () => {
    const {
      ingestRestriction,
      RESTRICTION_SOURCE,
      RESTRICTION_SCOPE,
    } = await import('../lib/mraEis/application/restrictions/restrictionService.js');
    const {
      createUnblockRequest,
      submitUnblockEvidence,
      approveUnblockRequest,
      queryUnblockStatus,
      applyClearanceAndRevalidate,
    } = await import('../lib/mraEis/application/restrictions/unblockService.js');

    const tenantId = 't-p17b';
    const businessId = 't-p17b';
    const terminalId = 'term-2';

    const { restriction } = await ingestRestriction({
      tenantId,
      businessId,
      terminalId,
      environment: 'SANDBOX',
      sourceType: RESTRICTION_SOURCE.MRA_SALES_RESPONSE,
      sourceReference: 'resp-2',
      reasonCode: 'MRA_TERMINAL_BLOCKED',
      scopeType: RESTRICTION_SCOPE.TERMINAL,
      scopeId: terminalId,
      evidence: { safe: { code: 'BLOCKED' } },
      useMemory: true,
    });

    const { request } = createUnblockRequest({
      tenantId,
      businessId,
      terminalId,
      environment: 'SANDBOX',
      restriction,
      requestedBy: 'user-a',
      mraSupportReference: 'SUP-1',
    });
    submitUnblockEvidence({
      tenantId,
      businessId,
      requestId: request.id,
      evidence: { remediationComplete: true, mraSupportReference: 'SUP-1' },
    });

    expect(() =>
      approveUnblockRequest({
        tenantId,
        businessId,
        requestId: request.id,
        approverId: 'user-a',
        requesterId: 'user-a',
      })
    ).toThrow(/Self-approval/);

    approveUnblockRequest({
      tenantId,
      businessId,
      requestId: request.id,
      approverId: 'user-b',
      requesterId: 'user-a',
    });

    const httpOnly = await queryUnblockStatus({
      tenantId,
      businessId,
      requestId: request.id,
      mockScenario: 'HTTP_200_WITHOUT_CLEARANCE',
      useMemory: true,
    });
    expect(httpOnly.cleared).toBe(false);
    expect(httpOnly.response.normalizedOutcome).toBe('STILL_BLOCKED');

    await queryUnblockStatus({
      tenantId,
      businessId,
      requestId: request.id,
      mockScenario: 'TERMINAL_CLEARED',
      useMemory: true,
    });

    const result = await applyClearanceAndRevalidate({
      tenantId,
      businessId,
      requestId: request.id,
      useMemory: true,
    });
    expect(result.terminalSetActiveDirectly).toBe(false);
    expect(result.revalidation.state).toMatch(/PASSED/);
    expect(result.operational).toBe(true);
  });

  it('keeps terminal non-operational when remaining restriction exists after MRA clearance', async () => {
    const {
      ingestRestriction,
      RESTRICTION_SOURCE,
      RESTRICTION_SCOPE,
    } = await import('../lib/mraEis/application/restrictions/restrictionService.js');
    const {
      createUnblockRequest,
      submitUnblockEvidence,
      approveUnblockRequest,
      queryUnblockStatus,
      applyClearanceAndRevalidate,
    } = await import('../lib/mraEis/application/restrictions/unblockService.js');

    const tenantId = 't-p17c';
    const businessId = 't-p17c';
    const terminalId = 'term-3';

    const { restriction: mra } = await ingestRestriction({
      tenantId,
      businessId,
      terminalId,
      environment: 'SANDBOX',
      sourceType: RESTRICTION_SOURCE.MRA_SALES_RESPONSE,
      sourceReference: 'resp-3',
      reasonCode: 'MRA_TERMINAL_BLOCKED',
      scopeType: RESTRICTION_SCOPE.TERMINAL,
      scopeId: terminalId,
      evidence: { safe: { code: 'BLOCKED' } },
      useMemory: true,
    });
    await ingestRestriction({
      tenantId,
      businessId,
      terminalId,
      environment: 'SANDBOX',
      sourceType: RESTRICTION_SOURCE.FISCAL_SEQUENCE_CONTROL,
      sourceReference: 'seq-1',
      reasonCode: 'FISCAL_SEQUENCE_CONFLICT',
      scopeType: RESTRICTION_SCOPE.FISCAL_SEQUENCE,
      scopeId: 'seq-scope',
      evidence: { safe: { conflict: true } },
      useMemory: true,
    });

    const { request } = createUnblockRequest({
      tenantId,
      businessId,
      terminalId,
      restriction: mra,
      requestedBy: 'u1',
      mraSupportReference: 'SUP-2',
    });
    submitUnblockEvidence({
      tenantId,
      businessId,
      requestId: request.id,
      evidence: { mraSupportReference: 'SUP-2' },
    });
    approveUnblockRequest({
      tenantId,
      businessId,
      requestId: request.id,
      approverId: 'u2',
      requesterId: 'u1',
    });
    await queryUnblockStatus({
      tenantId,
      businessId,
      requestId: request.id,
      mockScenario: 'TERMINAL_CLEARED',
      useMemory: true,
    });
    const result = await applyClearanceAndRevalidate({
      tenantId,
      businessId,
      requestId: request.id,
      useMemory: true,
    });
    expect(result.remainingRestrictionCount).toBe(1);
    expect(result.operational).toBe(false);
    expect(result.revalidation.state).toBe('BLOCKED_BY_REMAINING_RESTRICTION');
  });
});

describe('Phase 17 pending work classification', () => {
  it('never retransmits accepted and never blind-retries unknown', async () => {
    const { classifyPendingOnlineWork, classifyPendingOfflineWork } = await import(
      '../lib/mraEis/application/restrictions/unblockService.js'
    );
    const accepted = classifyPendingOnlineWork({ state: 'ACCEPTED' });
    expect(accepted.retransmit).toBe(false);
    const unknown = classifyPendingOnlineWork({ state: 'UNKNOWN_OUTCOME' });
    expect(unknown.blindRetry).toBe(false);
    const offlineAccepted = classifyPendingOfflineWork({ state: 'ACCEPTED' });
    expect(offlineAccepted.action).toBe('NEVER_REUPLOAD');
  });
});

describe('Phase 17 workers and multi-tenant', () => {
  it('uses claim leases and rejects cross-tenant clear patterns', async () => {
    const { claimJob, processRestrictionIngestEvent } = await import(
      '../lib/mraEis/application/restrictions/restrictionWorkers.js'
    );
    const { RestrictionErrors } = await import(
      '../lib/mraEis/application/restrictions/restrictionErrors.js'
    );

    const a = claimJob({ jobType: 'RESTRICTION_INGEST', jobKey: 'k1', workerId: 'w1' });
    expect(a.claimed).toBe(true);
    const b = claimJob({ jobType: 'RESTRICTION_INGEST', jobKey: 'k1', workerId: 'w2' });
    expect(b.claimed).toBe(false);

    const processed = await processRestrictionIngestEvent({
      tenantId: 'tenant-a',
      businessId: 'tenant-a',
      terminalId: 'ta',
      environment: 'SANDBOX',
      sourceType: 'MRA_SALES_RESPONSE',
      sourceReference: 'x1',
      reasonCode: 'MRA_TERMINAL_BLOCKED',
      scopeType: 'TERMINAL',
      scopeId: 'ta',
      evidence: { safe: { ok: true } },
      idempotencyKey: 'evt-1',
    });
    expect(processed.fiscalEvidenceMutated).toBe(false);
    expect(processed.journalCreated).toBe(false);

    const cross = RestrictionErrors.crossTenant();
    expect(cross.code).toBe('MRA_EIS_CROSS_TENANT_RESTRICTION');
  });
});

describe('Phase 17 mock server', () => {
  it('exposes synthetic clearance scenarios without secrets', async () => {
    const { queryMockUnblockStatus, listMockUnblockScenarios } = await import(
      '../lib/mraEis/application/restrictions/mockMraBlockUnblockServer.js'
    );
    expect(listMockUnblockScenarios()).toContain('TERMINAL_CLEARED');
    const r = queryMockUnblockStatus({ terminalId: 't', scenario: 'TERMINAL_CLEARED' });
    expect(r.normalizedOutcome).toBe('TERMINAL_CLEARED');
    expect(r.jwt).toBeUndefined();
    expect(r.privateKey).toBeUndefined();
    expect(r.buyerAuthorizationCode).toBeUndefined();
  });
});
