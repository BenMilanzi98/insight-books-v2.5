import { describe, expect, it, beforeAll, beforeEach } from 'vitest';

beforeAll(() => {
  process.env.MRA_EIS_ALLOW_TEST_MASTER_KEY = '1';
  process.env.MRA_EIS_DEPLOYMENT_ENV = 'development';
  process.env.MRA_EIS_USE_MOCK = '1';
});

describe('Phase 15 Last Transaction contracts', () => {
  it('allows mock Last Online and blocks live sandbox, production, and offline', async () => {
    const {
      resolveLastTransactionContract,
      getLastTransactionContractDecision,
      LAST_TX_CONTRACT_STATUS,
      LAST_TX_ENDPOINT_TYPE,
    } = await import('../lib/mraEis/application/reconciliation/lastTransactionContractRegistry.js');

    const mock = resolveLastTransactionContract({
      endpointType: LAST_TX_ENDPOINT_TYPE.LAST_ONLINE_TRANSACTION,
      environment: 'SANDBOX',
      mode: 'MOCK',
    });
    expect(mock.allowsQuery).toBe(true);
    expect(mock.decision).toBe(LAST_TX_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY);
    expect(mock.contract.absenceIsConclusive).toBe(false);

    const live = resolveLastTransactionContract({
      endpointType: LAST_TX_ENDPOINT_TYPE.LAST_ONLINE_TRANSACTION,
      environment: 'SANDBOX',
      mode: 'SANDBOX',
    });
    expect(live.allowsQuery).toBe(false);
    expect(live.decision).toBe(LAST_TX_CONTRACT_STATUS.BLOCKED);

    const production = resolveLastTransactionContract({
      endpointType: LAST_TX_ENDPOINT_TYPE.LAST_ONLINE_TRANSACTION,
      environment: 'PRODUCTION',
      mode: 'PRODUCTION',
    });
    expect(production.allowsQuery).toBe(false);
    expect(production.decision).toBe(LAST_TX_CONTRACT_STATUS.BLOCKED);

    const offline = resolveLastTransactionContract({
      endpointType: LAST_TX_ENDPOINT_TYPE.LAST_OFFLINE_TRANSACTION,
      environment: 'SANDBOX',
      mode: 'MOCK',
    });
    expect(offline.allowsQuery).toBe(false);
    expect(offline.decision).toBe(LAST_TX_CONTRACT_STATUS.BLOCKED);

    const decision = getLastTransactionContractDecision();
    expect(decision.lastOffline).toBe(LAST_TX_CONTRACT_STATUS.BLOCKED);
    expect(decision.absenceIsConclusive).toBe(false);
  });
});

describe('Phase 15 dispatch certainty', () => {
  it('treats timeout, HTTP 500, and worker crash as ambiguous (not not-processed)', async () => {
    const { classifyDispatchCertainty, isDefinitelyNotSent } = await import(
      '../lib/mraEis/application/reconciliation/dispatchCertainty.js'
    );
    const { DISPATCH_CERTAINTY } = await import('../lib/mraEis/domain/operationalEnums.js');

    const timeout = classifyDispatchCertainty({
      outcome: 'UNKNOWN_OUTCOME',
      httpStatus: 504,
      startedAt: new Date(),
      completedAt: new Date(),
      retryClassification: 'RECONCILE_BEFORE_RETRY',
    });
    expect(timeout.mayHaveBeenProcessed).toBe(true);
    expect(timeout.certainty).toBe(DISPATCH_CERTAINTY.REQUEST_BYTES_MAY_HAVE_LEFT_PROCESS);
    expect(isDefinitelyNotSent(timeout.certainty)).toBe(false);

    const http500 = classifyDispatchCertainty({
      outcome: 'UNKNOWN_OUTCOME',
      httpStatus: 500,
      startedAt: new Date(),
      completedAt: new Date(),
    });
    expect(http500.mayHaveBeenProcessed).toBe(true);

    const crash = classifyDispatchCertainty({
      outcome: 'UNKNOWN_OUTCOME',
      httpStatus: null,
      startedAt: new Date(),
      completedAt: null,
    });
    expect(crash.certainty).toBe(DISPATCH_CERTAINTY.WORKER_CRASH_AFTER_DISPATCH);
    expect(crash.mayHaveBeenProcessed).toBe(true);

    const preDispatch = classifyDispatchCertainty({
      outcome: 'CONTRACT_ERROR',
      httpStatus: null,
      startedAt: null,
      completedAt: null,
    });
    expect(preDispatch.certainty).toBe(DISPATCH_CERTAINTY.DEFINITELY_NOT_SENT);
    expect(isDefinitelyNotSent(preDispatch.certainty)).toBe(true);

    const withResponse = classifyDispatchCertainty(
      { outcome: 'UNKNOWN_OUTCOME', startedAt: new Date() },
      { id: 'resp-1' }
    );
    expect(withResponse.certainty).toBe(DISPATCH_CERTAINTY.RESPONSE_PERSISTED);
  });
});

describe('Phase 15 local-versus-MRA comparator', () => {
  const localBase = {
    environment: 'SANDBOX',
    fiscalNumber: 'FN-100',
    terminal: { terminalId: 'term-1' },
    snapshot: {
      sellerTin: 'TIN123',
      currency: 'MWK',
      grossTotal: '100.00',
      taxTotal: '0.00',
    },
  };

  it('confirms acceptance on conclusive match and does not treat absence as not-processed', async () => {
    const {
      compareLocalAndMraEvidence,
      normalizeMraReconciliationEvidence,
    } = await import('../lib/mraEis/application/reconciliation/localMraComparator.js');
    const { RECONCILIATION_OUTCOME } = await import('../lib/mraEis/domain/operationalEnums.js');
    const { resolveLastTransactionContract, LAST_TX_ENDPOINT_TYPE } = await import(
      '../lib/mraEis/application/reconciliation/lastTransactionContractRegistry.js'
    );

    const contract = resolveLastTransactionContract({
      endpointType: LAST_TX_ENDPOINT_TYPE.LAST_ONLINE_TRANSACTION,
      mode: 'MOCK',
    }).contract;

    const accepted = compareLocalAndMraEvidence({
      localEvidence: localBase,
      mraEvidence: normalizeMraReconciliationEvidence({
        endpointType: 'LAST_ONLINE_TRANSACTION',
        contractVersion: 'last-online-mock-v1',
        environment: 'SANDBOX',
        responseChecksum: 'abc',
        terminalId: 'term-1',
        body: {
          fiscalNumber: 'FN-100',
          taxpayerTin: 'TIN123',
          localTerminalId: 'term-1',
          currency: 'MWK',
          grossAmount: '100.00',
          taxAmount: '0.00',
          applicationStatus: 'SUCCESS',
        },
      }),
      contract,
    });
    expect(accepted.confidence).toBe('CONCLUSIVE_MATCH');
    expect(accepted.outcome).toBe(RECONCILIATION_OUTCOME.ACCEPTED_CONFIRMED);
    expect(accepted.requiredFieldRulesOverrideScoring).toBe(true);

    const absent = compareLocalAndMraEvidence({
      localEvidence: localBase,
      mraEvidence: normalizeMraReconciliationEvidence({
        endpointType: 'LAST_ONLINE_TRANSACTION',
        contractVersion: 'last-online-mock-v1',
        environment: 'SANDBOX',
        responseChecksum: 'def',
        body: { noTransaction: true },
      }),
      contract,
    });
    expect(absent.outcome).toBe(RECONCILIATION_OUTCOME.TARGET_NOT_RETURNED);
    expect(absent.outcome).not.toBe(RECONCILIATION_OUTCOME.DEFINITELY_NOT_PROCESSED);

    const mismatch = compareLocalAndMraEvidence({
      localEvidence: localBase,
      mraEvidence: normalizeMraReconciliationEvidence({
        endpointType: 'LAST_ONLINE_TRANSACTION',
        contractVersion: 'last-online-mock-v1',
        environment: 'SANDBOX',
        responseChecksum: 'ghi',
        terminalId: 'term-1',
        body: {
          fiscalNumber: 'FN-100',
          localTerminalId: 'term-1',
          currency: 'MWK',
          grossAmount: '999.99',
          applicationStatus: 'SUCCESS',
        },
      }),
      contract,
    });
    expect(mismatch.outcome).toBe(RECONCILIATION_OUTCOME.EVIDENCE_CONFLICT);

    const differentLatest = compareLocalAndMraEvidence({
      localEvidence: localBase,
      mraEvidence: normalizeMraReconciliationEvidence({
        endpointType: 'LAST_ONLINE_TRANSACTION',
        contractVersion: 'last-online-mock-v1',
        environment: 'SANDBOX',
        responseChecksum: 'jkl',
        body: {
          fiscalNumber: 'SYN-OTHER-999999',
          grossAmount: '50.00',
          applicationStatus: 'SUCCESS',
        },
      }),
      contract,
    });
    expect(differentLatest.outcome).toBe(RECONCILIATION_OUTCOME.RESPONSE_WINDOW_INSUFFICIENT);

    const duplicate = compareLocalAndMraEvidence({
      localEvidence: localBase,
      mraEvidence: normalizeMraReconciliationEvidence({
        endpointType: 'LAST_ONLINE_TRANSACTION',
        contractVersion: 'last-online-mock-v1',
        environment: 'SANDBOX',
        responseChecksum: 'mno',
        terminalId: 'term-1',
        body: {
          fiscalNumber: 'FN-100',
          localTerminalId: 'term-1',
          currency: 'MWK',
          grossAmount: '100.00',
          applicationStatus: 'SUCCESS',
          duplicateIndicator: true,
        },
      }),
      contract,
    });
    expect(duplicate.outcome).toBe(RECONCILIATION_OUTCOME.DUPLICATE_ACCEPTED_CONFIRMED);
  });

  it('compares amounts as decimal strings without inventing acceptance', async () => {
    const { compareLocalAndMraEvidence, normalizeMraReconciliationEvidence } = await import(
      '../lib/mraEis/application/reconciliation/localMraComparator.js'
    );
    const result = compareLocalAndMraEvidence({
      localEvidence: {
        ...localBase,
        snapshot: { ...localBase.snapshot, grossTotal: '100.00' },
      },
      mraEvidence: normalizeMraReconciliationEvidence({
        environment: 'SANDBOX',
        responseChecksum: 'x',
        body: {
          fiscalNumber: 'FN-100',
          localTerminalId: 'term-1',
          currency: 'MWK',
          grossAmount: '100.00',
          applicationStatus: 'PENDING',
        },
      }),
      contract: { absenceIsConclusive: false },
    });
    expect(result.fields.grossAmount.status).toBe('EXACT_MATCH');
    expect(result.outcome).not.toBe('ACCEPTED_CONFIRMED');
  });
});

describe('Phase 15 retry policy', () => {
  it('blocks unknown/accepted/rejected/terminal-blocked retries and allows only definitely-not-processed', async () => {
    const { evaluateRetryPolicyDecision, RETRY_DECISION } = await import(
      '../lib/mraEis/application/reconciliation/retryPolicyRegistry.js'
    );

    expect(
      evaluateRetryPolicyDecision({
        transmissionStatus: 'UNKNOWN_OUTCOME',
        reconciliationOutcome: 'STILL_UNKNOWN',
      }).decision
    ).toBe(RETRY_DECISION.RETRY_NOT_ALLOWED_UNKNOWN);

    expect(
      evaluateRetryPolicyDecision({
        transmissionStatus: 'UNKNOWN_OUTCOME',
        reconciliationOutcome: 'TARGET_NOT_RETURNED',
      }).blockers
    ).toContain('OUTCOME_STILL_UNKNOWN');

    expect(
      evaluateRetryPolicyDecision({
        transmissionStatus: 'ACCEPTED_ONLINE',
        reconciliationOutcome: 'ACCEPTED_CONFIRMED',
      }).decision
    ).toBe(RETRY_DECISION.RETRY_NOT_ALLOWED_ACCEPTED);

    expect(
      evaluateRetryPolicyDecision({
        transmissionStatus: 'REJECTED',
        reconciliationOutcome: 'REJECTED_CONFIRMED',
      }).decision
    ).toBe(RETRY_DECISION.RETRY_NOT_ALLOWED_REJECTED);

    expect(
      evaluateRetryPolicyDecision({
        transmissionStatus: 'UNKNOWN_OUTCOME',
        reconciliationOutcome: 'TERMINAL_BLOCKED',
        terminalBlocked: true,
      }).decision
    ).toBe(RETRY_DECISION.RETRY_NOT_ALLOWED_TERMINAL_BLOCKED);

    const safe = evaluateRetryPolicyDecision({
      transmissionStatus: 'RETRY_SCHEDULED',
      reconciliationOutcome: 'DEFINITELY_NOT_PROCESSED',
      dispatchCertainty: 'DEFINITELY_NOT_SENT',
      environment: 'SANDBOX',
      mode: 'MOCK',
    });
    expect(safe.allowed).toBe(true);
    expect(safe.sameSnapshotRequired).toBe(true);
    expect(safe.sameFiscalNumberRequired).toBe(true);

    const ambiguousDispatch = evaluateRetryPolicyDecision({
      transmissionStatus: 'RETRY_SCHEDULED',
      reconciliationOutcome: 'DEFINITELY_NOT_PROCESSED',
      dispatchCertainty: 'REQUEST_BYTES_MAY_HAVE_LEFT_PROCESS',
    });
    expect(ambiguousDispatch.decision).toBe(RETRY_DECISION.RECONCILE_BEFORE_RETRY);
  });
});

describe('Phase 15 mock Last Online server', () => {
  beforeEach(async () => {
    const { resetMockLastTransactionState } = await import(
      '../lib/mraEis/application/reconciliation/mockLastTransactionServer.js'
    );
    resetMockLastTransactionState();
  });

  it('returns deterministic synthetic scenarios without credentials', async () => {
    const {
      setMockLastTransactionScenario,
      mockQueryLastOnlineTransaction,
      getMockLastTransactionCallLog,
    } = await import('../lib/mraEis/application/reconciliation/mockLastTransactionServer.js');

    setMockLastTransactionScenario('MATCH_ACCEPTED');
    const match = await mockQueryLastOnlineTransaction({
      fiscalNumber: 'FN-100',
      terminalId: 'term-1',
      expected: { grossTotal: '100.00', sellerTin: 'TIN123', currency: 'MWK' },
    });
    expect(match.httpStatus).toBe(200);
    expect(match.body.fiscalNumber).toBe('FN-100');
    expect(match.body.applicationStatus).toBe('SUCCESS');
    expect(JSON.stringify(match)).not.toMatch(/Bearer|jwt|password|tac|authorization/i);

    setMockLastTransactionScenario('TARGET_ABSENT');
    const absent = await mockQueryLastOnlineTransaction({ fiscalNumber: 'FN-100' });
    expect(absent.body.noTransaction).toBe(true);

    setMockLastTransactionScenario('AMOUNT_MISMATCH');
    const amt = await mockQueryLastOnlineTransaction({ fiscalNumber: 'FN-100' });
    expect(amt.body.grossAmount).toBe('999.99');

    const log = getMockLastTransactionCallLog();
    expect(log.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(log)).not.toMatch(/Bearer|jwt|password/i);
  });
});

describe('Phase 15 rejected remediation + circuit breaker + typed errors', () => {
  it('classifies remediation without allowing blind retry', async () => {
    const { classifyRejectedRemediation, getRejectedRemediationRegistry } = await import(
      '../lib/mraEis/application/reconciliation/rejectedRemediationRegistry.js'
    );
    const registry = getRejectedRemediationRegistry();
    expect(Object.keys(registry).length).toBeGreaterThan(0);

    const rem = classifyRejectedRemediation({
      responseCode: 'VALIDATION_ERROR',
    });
    expect(rem.identicalRetryAllowed).toBe(false);
    expect(rem.newFiscalNumberProhibited).toBe(true);
    expect(rem.editCompletedSnapshotForbidden).toBe(true);
    expect(rem.accountingReversalAutomatic).toBe(false);
  });

  it('exposes typed reconciliation errors without secrets', async () => {
    const { ReconciliationErrors } = await import(
      '../lib/mraEis/application/reconciliation/reconciliationErrors.js'
    );
    const err = ReconciliationErrors.stillUnknown({ message: 'still unknown' });
    expect(err.code).toBe('MRA_EIS_TRANSACTION_STILL_UNKNOWN');
    expect(err.message).not.toMatch(/jwt|Bearer|secret/i);

    const notAuth = ReconciliationErrors.retryNotAuthorized();
    expect(notAuth.code).toBe('MRA_EIS_SAFE_RETRY_NOT_AUTHORIZED');
  });

  it('circuit breaker forbids using Sales as probes', async () => {
    const { getCircuitBreakerProbePolicy, isSalesProbeForbidden } = await import(
      '../lib/mraEis/application/reconciliation/circuitBreaker.js'
    );
    expect(isSalesProbeForbidden()).toBe(true);
    const policy = getCircuitBreakerProbePolicy();
    expect(policy.acceptedSalesForbidden).toBe(true);
    expect(policy.unknownOutcomesForbidden).toBe(true);
    expect(policy.offlineModeNeverAutoEnabled).toBe(true);
  });
});

describe('Phase 15 backoff', () => {
  it('bounds delay and respects Retry-After when provided', async () => {
    const { computeBackoffDelayMs } = await import(
      '../lib/mraEis/application/reconciliation/retryPolicyRegistry.js'
    );
    const after = computeBackoffDelayMs({ attemptNumber: 1, retryAfterSeconds: 12 });
    expect(after).toBe(12_000);

    const jittered = computeBackoffDelayMs({ attemptNumber: 3 });
    expect(jittered).toBeGreaterThanOrEqual(0);
    expect(jittered).toBeLessThanOrEqual(3_600_000);
  });
});
