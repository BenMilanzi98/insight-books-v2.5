import { describe, expect, it, beforeAll, beforeEach } from 'vitest';

beforeAll(() => {
  process.env.MRA_EIS_ALLOW_TEST_MASTER_KEY = '1';
  process.env.MRA_EIS_DEPLOYMENT_ENV = 'development';
  process.env.MRA_EIS_USE_MOCK = '1';
});

describe('Phase 16 offline contracts', () => {
  it('allows mock provisional and blocks live sandbox / production', async () => {
    const {
      resolveOfflineModeContract,
      resolveOfflineSignatureContract,
      resolveOfflineNumberingContract,
      resolveOfflineReceiptContract,
      resolveOfflineUploadContract,
      getOfflineContractDecision,
      OFFLINE_CONTRACT_STATUS,
    } = await import('../lib/mraEis/application/offline/offlineContractRegistry.js');

    expect(resolveOfflineModeContract({ mode: 'MOCK' }).allowsOfflineSales).toBe(true);
    expect(resolveOfflineModeContract({ mode: 'SANDBOX', environment: 'SANDBOX' }).allowsOfflineSales).toBe(
      false
    );
    expect(
      resolveOfflineModeContract({ mode: 'PRODUCTION', environment: 'PRODUCTION' }).decision
    ).toBe(OFFLINE_CONTRACT_STATUS.BLOCKED);

    expect(resolveOfflineSignatureContract({ mode: 'MOCK' }).allowsSigning).toBe(true);
    expect(resolveOfflineSignatureContract({ mode: 'PRODUCTION' }).allowsSigning).toBe(false);
    expect(resolveOfflineNumberingContract({ mode: 'PRODUCTION' }).allowsAllocation).toBe(false);
    expect(resolveOfflineReceiptContract({ mode: 'MOCK' }).contract.claimAcceptanceBeforeUploadForbidden).toBe(
      true
    );
    expect(resolveOfflineUploadContract({ mode: 'PRODUCTION' }).allowsUpload).toBe(false);

    const decision = getOfflineContractDecision();
    expect(decision.browserAuthoritativeFiscalization).toBe('PROHIBITED');
    expect(decision.localStorageAuthoritativeForbidden).toBe(true);
    expect(decision.maintenanceAutoEnableForbidden).toBe(true);
  });
});

describe('Phase 16 certification and capability', () => {
  it('requires CERTIFIED_PRODUCTION for production and allows mock', async () => {
    const { evaluateOfflineCertification } = await import(
      '../lib/mraEis/application/offline/offlineCertificationPolicy.js'
    );
    const { evaluateEffectiveOfflineCapability } = await import(
      '../lib/mraEis/application/offline/effectiveOfflineCapability.js'
    );

    const mockCert = evaluateOfflineCertification({ mode: 'MOCK' });
    expect(mockCert.valid).toBe(true);
    expect(mockCert.productionAllowed).toBe(false);

    const prodMissing = evaluateOfflineCertification({
      mode: 'PRODUCTION',
      environment: 'PRODUCTION',
    });
    expect(prodMissing.valid).toBe(false);
    expect(prodMissing.blockers).toContain('PRODUCTION_CERTIFICATION_MISSING');

    const mockCap = evaluateEffectiveOfflineCapability({ mode: 'MOCK', environment: 'SANDBOX' });
    expect(mockCap.offlineEntryAllowed).toBe(true);
    expect(mockCap.browserAuthoritativeForbidden).toBe(true);

    const prodCap = evaluateEffectiveOfflineCapability({
      mode: 'PRODUCTION',
      environment: 'PRODUCTION',
      platformOfflineAvailable: true,
      tenantOfflineEntitled: true,
      businessOfflineEnabled: true,
      browserContext: true,
    });
    expect(prodCap.offlineEntryAllowed).toBe(false);
    expect(prodCap.blockers.length).toBeGreaterThan(0);
  });
});

describe('Phase 16 connectivity and clock', () => {
  it('does not enter offline on a single failure and treats navigator.onLine as non-authoritative', async () => {
    const {
      evaluateConnectivityTransition,
      assertNotBrowserOnlineAuthoritative,
    } = await import('../lib/mraEis/application/offline/connectivityStateMachine.js');
    const { CONNECTIVITY_STATE } = await import('../lib/mraEis/domain/operationalEnums.js');

    const oneFail = evaluateConnectivityTransition({
      currentState: CONNECTIVITY_STATE.ONLINE_STABLE,
      recentChecks: [{ success: false }],
      capabilityAllowsOfflineEntry: true,
      navigatorOnline: false,
    });
    expect(oneFail.state).toBe(CONNECTIVITY_STATE.ONLINE_DEGRADED);
    expect(oneFail.offlineEntryAllowed).toBe(false);
    expect(oneFail.warnings).toContain('NAVIGATOR_ONLINE_NOT_AUTHORITATIVE');

    const confirmed = evaluateConnectivityTransition({
      currentState: CONNECTIVITY_STATE.OFFLINE_CANDIDATE,
      recentChecks: [{ success: false }, { success: false }, { success: false }],
      capabilityAllowsOfflineEntry: true,
    });
    expect(confirmed.state).toBe(CONNECTIVITY_STATE.OFFLINE_CONFIRMED);
    expect(confirmed.offlineEntryAllowed).toBe(true);

    const restore = evaluateConnectivityTransition({
      currentState: CONNECTIVITY_STATE.OFFLINE_ACTIVE,
      recentChecks: [{ success: true }, { success: true }, { success: true }],
    });
    expect(restore.state).toBe(CONNECTIVITY_STATE.ONLINE_RESTORED);
    expect(restore.startUploadAllowed).toBe(true);

    expect(assertNotBrowserOnlineAuthoritative(true).authoritative).toBe(false);
  });

  it('blocks on clock rollback and excessive drift', async () => {
    const { evaluateClockTrust } = await import(
      '../lib/mraEis/application/offline/clockIntegrity.js'
    );
    const { CLOCK_TRUST_STATE } = await import('../lib/mraEis/domain/operationalEnums.js');

    const rollback = evaluateClockTrust({
      deviceWallClock: 1_000_000,
      previousDeviceWallClock: 2_000_000,
    });
    expect(rollback.state).toBe(CLOCK_TRUST_STATE.CLOCK_ROLLBACK_DETECTED);
    expect(rollback.allowsOfflineSale).toBe(false);

    const drift = evaluateClockTrust({
      deviceWallClock: 0,
      lastTrustedServerTime: 20 * 60 * 1000,
    });
    expect(drift.state).toBe(CLOCK_TRUST_STATE.DRIFT_BLOCKED);
  });
});

describe('Phase 16 signature, sequence, envelope', () => {
  beforeEach(async () => {
    const { __resetOfflineSequencesForTests } = await import(
      '../lib/mraEis/application/offline/offlineSequence.js'
    );
    __resetOfflineSequencesForTests();
  });

  it('signs and verifies mock envelopes; browser signing prohibited; numbers never reuse', async () => {
    const {
      canonicalizeOfflinePayload,
      signOfflineFiscalEnvelope,
      verifyOfflineSignature,
    } = await import('../lib/mraEis/application/offline/offlineSigner.js');
    const { OfflineErrors } = await import('../lib/mraEis/application/offline/offlineErrors.js');

    await expect(
      signOfflineFiscalEnvelope({
        mode: 'MOCK',
        exactCanonicalBytes: Buffer.from('x'),
        browserContext: true,
      })
    ).rejects.toMatchObject({ code: 'MRA_EIS_OFFLINE_BROWSER_ONLY_PROHIBITED' });

    await expect(
      signOfflineFiscalEnvelope({
        mode: 'MOCK',
        exactCanonicalBytes: Buffer.from('x'),
        keyReference: 'ONLINE_JWT',
      })
    ).rejects.toMatchObject({ code: 'MRA_EIS_OFFLINE_KEY_UNAVAILABLE' });

    const bytes = canonicalizeOfflinePayload({ a: 1, b: '2.00' });
    const signed = await signOfflineFiscalEnvelope({
      mode: 'MOCK',
      environment: 'SANDBOX',
      exactCanonicalBytes: bytes,
      agentId: 'a1',
      terminalId: 't1',
    });
    expect(signed.signature).toBeTruthy();
    expect(signed.signerIdentity.browserHadPrivateKey).toBe(false);
    expect(verifyOfflineSignature({ exactCanonicalBytes: bytes, signature: signed.signature, mode: 'MOCK' }).valid).toBe(
      true
    );
    expect(JSON.stringify(signed)).not.toMatch(/BEGIN PRIVATE|password|Bearer /i);

    const { reserveOfflineFiscalNumber } = await import(
      '../lib/mraEis/application/offline/offlineSequence.js'
    );
    const r1 = reserveOfflineFiscalNumber({
      tenantId: 't',
      businessId: 't',
      terminalId: 'term',
      agentId: 'agent',
      mode: 'MOCK',
      fiscalSnapshotId: 's1',
    });
    const r2 = reserveOfflineFiscalNumber({
      tenantId: 't',
      businessId: 't',
      terminalId: 'term',
      agentId: 'agent',
      mode: 'MOCK',
      fiscalSnapshotId: 's2',
    });
    expect(r1.numericValue).toBe(1);
    expect(r2.numericValue).toBe(2);
    expect(r1.maxPlusOneUsed).toBe(false);
    expect(r2.offlineFiscalNumber).not.toBe(r1.offlineFiscalNumber);

    // production numbering blocked
    expect(() =>
      reserveOfflineFiscalNumber({
        tenantId: 't',
        businessId: 't',
        mode: 'PRODUCTION',
        environment: 'PRODUCTION',
        fiscalSnapshotId: 's3',
      })
    ).toThrow();

    void OfflineErrors;
  });

  it('seals envelope without claiming MRA acceptance and forbids mutation', async () => {
    const { createAndSealOfflineEnvelope, assertEnvelopeImmutable } = await import(
      '../lib/mraEis/application/offline/offlineEnvelope.js'
    );

    const sealed = await createAndSealOfflineEnvelope({
      tenantId: 't',
      businessId: 't',
      terminalId: 'term',
      agentId: 'agent',
      deviceIdentity: 'dev',
      mode: 'MOCK',
      fiscalSnapshotId: 'snap-1',
      snapshotChecksum: 'chk',
      snapshotPayload: {
        sellerTin: 'TIN',
        currency: 'MWK',
        grossTotal: '100.00',
        taxTotal: '0.00',
        levyTotal: '0.00',
        lines: [],
      },
    });

    expect(sealed.envelope.state).toBe('SEALED');
    expect(sealed.envelope.claimsMraAcceptance).toBe(false);
    expect(sealed.envelope.receiptStatus).toBe('OFFLINE_UPLOAD_PENDING');
    expect(sealed.journalCreated).toBe(false);
    expect(sealed.mraUploadPerformed).toBe(false);

    expect(() =>
      assertEnvelopeImmutable(sealed.envelope, { offlineFiscalNumber: 'OTHER' })
    ).toThrow(/cannot be modified|TAMPER/i);
  });
});

describe('Phase 16 queue, upload, browser quarantine, limits', () => {
  beforeEach(async () => {
    const { resetMockOfflineUploadState } = await import(
      '../lib/mraEis/application/offline/mockOfflineMraServer.js'
    );
    resetMockOfflineUploadState();
  });

  it('detects queue tamper and uploads ordered items without accounting repost', async () => {
    const { verifyQueuePartitionIntegrity } = await import(
      '../lib/mraEis/application/offline/queueIntegrity.js'
    );
    const {
      processOrderedOfflineUploadPartition,
    } = await import('../lib/mraEis/application/offline/offlineUploadWorker.js');
    const { setMockOfflineUploadScenario } = await import(
      '../lib/mraEis/application/offline/mockOfflineMraServer.js'
    );

    const ok = verifyQueuePartitionIntegrity([
      { id: '1', queueSequence: 1, sealedChecksum: 'a', state: 'SEALED' },
      { id: '2', queueSequence: 2, sealedChecksum: 'b', previousChecksum: 'a', state: 'SEALED' },
    ]);
    expect(ok.valid).toBe(true);

    const tampered = verifyQueuePartitionIntegrity([
      { id: '1', queueSequence: 1, sealedChecksum: 'a', state: 'SEALED', _tampered: true },
    ]);
    expect(tampered.blocksNewOfflineSales).toBe(true);

    setMockOfflineUploadScenario('ACCEPT');
    const upload = await processOrderedOfflineUploadPartition({
      mode: 'MOCK',
      items: [
        {
          id: 'q1',
          queueSequence: 1,
          offlineFiscalNumber: 'OFF-1',
          sealedChecksum: 'x',
          state: 'SEALED',
          uploadAttemptCount: 0,
        },
      ],
    });
    expect(upload.results[0].outcome).toBe('ACCEPTED');
    expect(upload.accountingReposted).toBe(false);
    expect(upload.inventoryReposted).toBe(false);

    setMockOfflineUploadScenario('TIMEOUT');
    const unknown = await processOrderedOfflineUploadPartition({
      mode: 'MOCK',
      items: [
        {
          id: 'q2',
          queueSequence: 1,
          offlineFiscalNumber: 'OFF-2',
          sealedChecksum: 'y',
          state: 'SEALED',
        },
        {
          id: 'q3',
          queueSequence: 2,
          offlineFiscalNumber: 'OFF-3',
          sealedChecksum: 'z',
          previousChecksum: 'y',
          state: 'SEALED',
        },
      ],
    });
    expect(unknown.results[0].outcome).toBe('UNKNOWN_OUTCOME');
    expect(unknown.results[0].blindRetryForbidden).toBe(true);
    expect(unknown.results[1].skipped).toBe(true);
  });

  it('quarantines browser force-offline and enforces limits', async () => {
    const { denyBrowserForceOfflineEntry, evaluateBrowserOfflineAuthoritativeRequest } =
      await import('../lib/mraEis/application/offline/browserOfflineQuarantine.js');
    const { evaluateOfflineLimits } = await import(
      '../lib/mraEis/application/offline/offlineLimits.js'
    );

    expect(denyBrowserForceOfflineEntry().allowed).toBe(false);
    expect(
      evaluateBrowserOfflineAuthoritativeRequest({
        usesIndexedDb: true,
        requestsMraFiscalOffline: true,
      }).blockers
    ).toContain('BROWSER_ONLY_PROHIBITED');

    const limits = evaluateOfflineLimits({
      offlineSaleCount: 100,
      proposedSaleGrossAmount: '1',
    });
    expect(limits.allowed).toBe(false);
    expect(limits.cashierCannotOverride).toBe(true);
  });
});

describe('Phase 16 typed errors', () => {
  it('exposes stable codes without secrets', async () => {
    const { OfflineErrors } = await import('../lib/mraEis/application/offline/offlineErrors.js');
    expect(OfflineErrors.browserProhibited().code).toBe('MRA_EIS_OFFLINE_BROWSER_ONLY_PROHIBITED');
    expect(OfflineErrors.certificationRequired().code).toBe('MRA_EIS_OFFLINE_CERTIFICATION_REQUIRED');
    expect(OfflineErrors.uploadUnknown().message).not.toMatch(/jwt|private key/i);
  });
});
