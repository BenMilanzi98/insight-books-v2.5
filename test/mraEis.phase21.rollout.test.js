import { describe, expect, it, beforeEach } from 'vitest';

beforeEach(async () => {
  const { __resetCertificationForTests } = await import(
    '../lib/mraEis/application/phase21/certificationReview.js'
  );
  const { __resetProvisioningForTests } = await import(
    '../lib/mraEis/application/phase21/productionProvisioning.js'
  );
  const { __resetPilotsForTests } = await import('../lib/mraEis/application/phase21/pilotEngine.js');
  const { __resetCohortsForTests } = await import('../lib/mraEis/application/phase21/cohortRollout.js');
  const { __resetHypercareForTests } = await import('../lib/mraEis/application/phase21/hypercare.js');
  const { __resetDefectsForTests } = await import('../lib/mraEis/application/phase20/defectRegister.js');
  __resetCertificationForTests();
  __resetProvisioningForTests();
  __resetPilotsForTests();
  __resetCohortsForTests();
  __resetHypercareForTests();
  __resetDefectsForTests();
});

describe('Phase 21 release-gate revalidation', () => {
  it('revalidates Phase 20 READY_WITH_CONDITIONS and rejects mock certification claims', async () => {
    const { revalidatePhase20ReleaseGate } = await import(
      '../lib/mraEis/application/phase21/programmeDecision.js'
    );
    const { Phase21Errors } = await import('../lib/mraEis/application/phase21/phase21Errors.js');

    expect(() =>
      revalidatePhase20ReleaseGate({ claimSandboxFromMocks: true })
    ).toThrow(/Mock|Sandbox|certification/i);

    const ok = revalidatePhase20ReleaseGate({
      releaseId: 'rc-phase21',
      commit: 'abc123',
      testResults: { passed: 200, failed: 0 },
    });
    expect(ok.proceedToCertificationPlanning).toBe(true);
    expect(ok.proceedToProductionProvisioning).toBe(false);
    expect(ok.phase20Decision).toBe('READY_FOR_PHASE_21_WITH_BLOCKERS');
    expect(ok.gate.decision).toMatch(/READY/);
    expect(Phase21Errors.releaseGateFailed().code).toBe('MRA_EIS_RELEASE_GATE_FAILED');
  });
});

describe('Phase 21 certification', () => {
  it('packages evidence without secrets and forbids self-approved certification', async () => {
    const {
      buildCertificationEvidencePackage,
      createCertificationReviewCase,
      transitionCertificationReview,
      recordCertificationOutcome,
      assertCertificationAllowsProduction,
      CERTIFICATION_REVIEW_STATE,
    } = await import('../lib/mraEis/application/phase21/certificationReview.js');

    const pkg = buildCertificationEvidencePackage({
      productId: 'IB-EIS',
      productVersion: '2.1.0',
      environment: 'SANDBOX',
      sandboxResults: { onlineSale: 'PASS' },
    });
    expect(pkg.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(pkg.packageBody.credentialsExcluded).toBe(true);

    const review = createCertificationReviewCase({
      productId: 'IB-EIS',
      productVersion: '2.1.0',
      evidencePackageId: pkg.id,
      evidenceChecksum: pkg.checksum,
      preparedBy: 'prep-1',
    });

    expect(() =>
      transitionCertificationReview({
        caseId: review.id,
        toState: CERTIFICATION_REVIEW_STATE.APPROVED,
        actorId: 'prep-1',
        mraEvidence: { selfDeclared: true, mraReference: 'X', verified: true },
      })
    ).toThrow(/Self-declared/);

    transitionCertificationReview({
      caseId: review.id,
      toState: CERTIFICATION_REVIEW_STATE.APPROVED,
      actorId: 'mra-officer',
      mraEvidence: {
        mraReference: 'MRA-CERT-001',
        verified: true,
        conditions: [],
      },
    });

    const outcome = recordCertificationOutcome({
      caseId: review.id,
      environment: 'PRODUCTION',
      productId: 'IB-EIS',
      productVersion: '2.1.0',
      mraReference: 'MRA-CERT-001',
      evidenceChecksum: pkg.checksum,
      approvalState: CERTIFICATION_REVIEW_STATE.APPROVED,
    });

    expect(() =>
      assertCertificationAllowsProduction({
        outcome: { ...outcome, environment: 'SANDBOX' },
        productId: 'IB-EIS',
        productVersion: '2.1.0',
        environment: 'PRODUCTION',
      })
    ).toThrow(/Sandbox certification is not Production/);

    expect(
      assertCertificationAllowsProduction({
        outcome,
        productId: 'IB-EIS',
        productVersion: '2.1.0',
        environment: 'PRODUCTION',
      })
    ).toBe(true);
  });
});

describe('Phase 21 production change + credentials', () => {
  it('enforces approvals, freeze, artifact match, and secret-provider credentials', async () => {
    const {
      createProductionChangeRequest,
      approveProductionChange,
      startReleaseFreeze,
      verifyProductionArtifacts,
      provisionProductionCredential,
      getCredentialInternal,
    } = await import('../lib/mraEis/application/phase21/productionProvisioning.js');

    const change = createProductionChangeRequest({
      releaseId: 'r1',
      commit: 'c1',
      buildDigest: 'b1',
      containerDigest: 'd1',
      migrationChecksum: 'm1',
      workerVersion: 'w1',
      requestedBy: 'req-1',
      backupPlan: 'full',
      rollbackPlan: 'disable-capability',
    });

    for (const role of ['security', 'finance', 'compliance', 'operations']) {
      approveProductionChange({ changeId: change.id, approverId: `a-${role}`, role });
    }
    expect(() =>
      approveProductionChange({ changeId: change.id, approverId: 'req-1', role: 'change' })
    ).toThrow(/cannot approve own/);
    approveProductionChange({ changeId: change.id, approverId: 'change-approver', role: 'change' });

    startReleaseFreeze({ changeId: change.id });
    verifyProductionArtifacts({
      changeId: change.id,
      testedCommit: 'c1',
      testedBuildDigest: 'b1',
      testedContainerDigest: 'd1',
      testedMigrationChecksum: 'm1',
    });

    expect(() =>
      verifyProductionArtifacts({
        changeId: change.id,
        testedCommit: 'c1',
        testedBuildDigest: 'b1',
        testedContainerDigest: 'd1',
        testedMigrationChecksum: 'm1',
        hasMockEndpoints: true,
      })
    ).toThrow(/mock/i);

    expect(() =>
      provisionProductionCredential({
        changeId: change.id,
        alias: 'mra-prod',
        secretProviderReference: 'secret-provider://prod/mra-auth',
        provisionedBy: 'ops-1',
        approvedBy: 'ops-1',
      })
    ).toThrow(/four-eyes|approv/i);

    expect(() =>
      provisionProductionCredential({
        changeId: change.id,
        alias: 'mra-prod',
        secretProviderReference: 'secret-provider://sandbox/mra-auth',
        environment: 'PRODUCTION',
        provisionedBy: 'ops-1',
        approvedBy: 'sec-1',
      })
    ).toThrow(/Sandbox|mix/i);

    const cred = provisionProductionCredential({
      changeId: change.id,
      alias: 'mra-prod',
      secretProviderReference: 'secret-provider://production/mra-auth',
      environment: 'PRODUCTION',
      credentialType: 'MRA_AUTH',
      provisionedBy: 'ops-1',
      approvedBy: 'sec-1',
    });
    expect(cred.secretProviderReference).toBe('[REDACTED_REFERENCE]');
    expect(cred.tacPersisted).toBe(false);
    expect(getCredentialInternal(cred.id).secretProviderReference).toContain('secret-provider://');
  });
});

describe('Phase 21 pilot Go/No-Go', () => {
  async function readyPilot() {
    const certMod = await import('../lib/mraEis/application/phase21/certificationReview.js');
    const prov = await import('../lib/mraEis/application/phase21/productionProvisioning.js');
    const pilot = await import('../lib/mraEis/application/phase21/pilotEngine.js');

    const pkg = certMod.buildCertificationEvidencePackage({
      productId: 'IB-EIS',
      productVersion: '2.1.0',
    });
    const review = certMod.createCertificationReviewCase({
      productId: 'IB-EIS',
      productVersion: '2.1.0',
      evidencePackageId: pkg.id,
      evidenceChecksum: pkg.checksum,
      preparedBy: 'p',
    });
    certMod.transitionCertificationReview({
      caseId: review.id,
      toState: certMod.CERTIFICATION_REVIEW_STATE.APPROVED,
      actorId: 'mra',
      mraEvidence: { mraReference: 'MRA-1', verified: true },
    });
    const outcome = certMod.recordCertificationOutcome({
      caseId: review.id,
      environment: 'PRODUCTION',
      mraReference: 'MRA-1',
      evidenceChecksum: pkg.checksum,
      approvalState: certMod.CERTIFICATION_REVIEW_STATE.APPROVED,
    });

    const change = prov.createProductionChangeRequest({
      releaseId: 'r',
      commit: 'c',
      buildDigest: 'b',
      containerDigest: 'd',
      migrationChecksum: 'm',
      workerVersion: 'w',
      requestedBy: 'req',
    });
    for (const role of ['security', 'finance', 'compliance', 'operations', 'change']) {
      prov.approveProductionChange({
        changeId: change.id,
        approverId: role === 'change' ? 'other' : `a-${role}`,
        role,
      });
    }
    prov.startReleaseFreeze({ changeId: change.id });

    const scope = pilot.definePilotScope({
      tenantId: 'pilot-t',
      businessId: 'pilot-t',
      branchId: 'br-1',
      siteId: 'site-1',
      terminalId: 'term-1',
      userIds: ['u1'],
      productIds: ['prod-1'],
    });

    const p = pilot.evaluatePilotEntryCriteria({
      changeId: change.id,
      certificationOutcome: outcome,
      scope,
      productId: 'IB-EIS',
      productVersion: '2.1.0',
      monitoringActive: true,
      alertsTested: true,
      backupVerified: true,
      rollbackReady: true,
      usersTrained: true,
      supportAvailable: true,
      incidentCommanderAssigned: true,
      terminalActivated: true,
      configurationCurrent: true,
      catalogueCurrent: true,
      mappingsComplete: true,
      sequenceHealthy: true,
      noActiveRestrictions: true,
      credentialsProvisioned: true,
      releaseGatePassed: true,
    });
    return { pilot, p };
  }

  it('requires explicit scope and validates once-only accounting/fiscal effects', async () => {
    const { pilot, p } = await readyPilot();
    const { Phase21Errors } = await import('../lib/mraEis/application/phase21/phase21Errors.js');

    expect(() =>
      pilot.recordPilotTransactionResult({
        pilotId: p.id,
        approved: true,
        historicalSale: true,
        journalCount: 1,
        stockMovementCount: 1,
        snapshotCount: 1,
        fiscalNumberAssignedOnce: true,
        submissionCount: 1,
        acceptanceBasedOnApplicationEvidence: true,
        receiptBasedOnAcceptedEvidence: true,
        qrFollowsContract: true,
        accountingBalanced: true,
        reconciled: true,
      })
    ).toThrow(/Historical/);
    expect(Phase21Errors.historicalTransmissionBlocked().code).toBe(
      'MRA_EIS_HISTORICAL_PRODUCTION_TRANSMISSION_BLOCKED'
    );

    const tx = pilot.recordPilotTransactionResult({
      pilotId: p.id,
      approved: true,
      journalCount: 1,
      stockMovementCount: 1,
      snapshotCount: 1,
      fiscalNumberAssignedOnce: true,
      submissionCount: 1,
      acceptanceBasedOnApplicationEvidence: true,
      receiptBasedOnAcceptedEvidence: true,
      qrFollowsContract: true,
      accountingBalanced: true,
      reconciled: true,
    });
    expect(tx.transaction.journalCount).toBe(1);

    const go = pilot.evaluatePilotOutcome({
      pilotId: p.id,
      observationComplete: true,
      acceptanceRate: 1,
    });
    expect(go.decision).toBe('GO_TO_LIMITED_ROLLOUT');
    expect(go.informalApprovalForbidden).toBe(true);
  });
});

describe('Phase 21 cohort rollout + hypercare', () => {
  it('blocks auto-enable-all, is idempotent, pauses on critical, and exits hypercare objectively', async () => {
    const {
      createRolloutPlan,
      evaluateCohortReadiness,
      enableCohortMember,
      verifyCohortPostEnable,
      pauseRollout,
    } = await import('../lib/mraEis/application/phase21/cohortRollout.js');
    const {
      startHypercare,
      recordDailyHypercareReport,
      updateHypercareHealth,
      evaluateHypercareExit,
      completeBauHandover,
    } = await import('../lib/mraEis/application/phase21/hypercare.js');
    const { evaluatePhase21ProgrammeStatus, PHASE21_PROGRAMME_STATUS } = await import(
      '../lib/mraEis/application/phase21/programmeDecision.js'
    );

    const plan = createRolloutPlan({ pilotDecision: 'GO_TO_LIMITED_ROLLOUT' });
    expect(plan.autoEnableAllForbidden).toBe(true);

    evaluateCohortReadiness({
      planId: plan.planId,
      cohortId: 'COHORT_2',
      entitlement: true,
      participation: true,
      certificationValid: true,
      terminalReady: true,
      configurationCurrent: true,
      mappingsComplete: true,
      sequenceHealthy: true,
      trainingComplete: true,
      supportCoverage: true,
      monitoringActive: true,
      backupVerified: true,
      rollbackReady: true,
      noActiveRestrictions: true,
      communicationSent: true,
    });

    const e1 = enableCohortMember({
      planId: plan.planId,
      cohortId: 'COHORT_2',
      tenantId: 't2',
      businessId: 't2',
      operatorId: 'op',
      idempotencyKey: 'en-1',
    });
    const e2 = enableCohortMember({
      planId: plan.planId,
      cohortId: 'COHORT_2',
      tenantId: 't2',
      businessId: 't2',
      operatorId: 'op',
      idempotencyKey: 'en-1',
    });
    expect(e1.duplicate).toBe(false);
    expect(e2.duplicate).toBe(true);
    expect(e1.fiscalEffects).toBe(0);

    verifyCohortPostEnable({
      planId: plan.planId,
      cohortId: 'COHORT_2',
      accountingOk: true,
      inventoryOk: true,
      fiscalOk: true,
      reportsOk: true,
      noRegressionPriorCohorts: true,
    });

    const paused = pauseRollout({
      planId: plan.planId,
      reason: 'CRITICAL_INCIDENT',
    });
    expect(paused.paused).toBe(true);

    const hc = startHypercare({
      planId: plan.planId,
      pilotId: 'pilot-x',
      incidentCommander: 'ic-1',
    });
    recordDailyHypercareReport({
      hypercareId: hc.id,
      enabledTenants: 1,
      fiscalSalesCount: 10,
      acceptedCount: 10,
      currency: 'MWK',
      grossValue: '1500.00',
    });

    expect(() => evaluateHypercareExit({ hypercareId: hc.id, elapsedDaysOnly: true })).toThrow(
      /elapsed time/
    );

    updateHypercareHealth(hc.id, {
      acceptancesStable: true,
      reconciliationWithinSla: true,
      sequenceHealthy: true,
      supportManageable: true,
      monitoringStable: true,
      ownership: {
        operations: true,
        support: true,
        compliance: true,
        security: true,
        finance: true,
        engineering: true,
      },
    });
    evaluateHypercareExit({ hypercareId: hc.id });
    const bau = completeBauHandover({
      hypercareId: hc.id,
      acceptances: {
        operations: true,
        support: true,
        compliance: true,
        security: true,
        finance: true,
        engineering: true,
      },
    });
    expect(bau.bauReady).toBe(true);

    const programme = evaluatePhase21ProgrammeStatus({
      releaseGateOk: true,
      sandboxValidated: false,
      certificationApproved: false,
    });
    expect(programme.decision).toBe(PHASE21_PROGRAMME_STATUS.BLOCKED);
    expect(programme.frameworkDecision).toBe(
      PHASE21_PROGRAMME_STATUS.CONTROLS_READY_PRODUCTION_BLOCKED
    );
  });
});
