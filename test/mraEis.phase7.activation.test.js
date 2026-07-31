import { describe, expect, it, beforeAll, beforeEach } from 'vitest';

beforeAll(() => {
  process.env.MRA_EIS_ALLOW_TEST_MASTER_KEY = '1';
  process.env.MRA_EIS_TEST_MASTER_KEY =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.MRA_EIS_DEPLOYMENT_ENV = 'development';
  process.env.MRA_EIS_ACTIVATION_MODE = 'MOCK';
  process.env.MRA_EIS_PRODUCT_ID = 'IB-EIS-MOCK';
  process.env.MRA_EIS_PRODUCT_VERSION = '0.0.0-mock';
});

beforeEach(async () => {
  const { resetMockMraState } = await import(
    '../lib/mraEis/infrastructure/mraClient/mockMraActivationServer.js'
  );
  resetMockMraState();
});

describe('Phase 7 activation request mapper', () => {
  it('maps verified fields and canonicalizes', async () => {
    const { mapTerminalActivationRequest } = await import(
      '../lib/mraEis/application/activation/activationMapper.js'
    );
    const mapped = mapTerminalActivationRequest({
      terminalActivationCode: 'MOCK-OK-001',
      productId: 'IB-EIS-MOCK',
      productVersion: '0.0.0-mock',
      platformIdentity: 'ibeis:sandbox:test-identity',
      taxpayerTin: 'TEST-TIN-0001',
    });
    expect(mapped.body.productID).toBe('IB-EIS-MOCK');
    expect(mapped.body.environment.platform.platformIdentityReference).toContain('ibeis:');
    expect(mapped.canonical.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(mapped.endpointKey).toBe('EP-ONB-01');
  });

  it('rejects missing TAC without logging value', async () => {
    const { mapTerminalActivationRequest } = await import(
      '../lib/mraEis/application/activation/activationMapper.js'
    );
    expect(() =>
      mapTerminalActivationRequest({
        terminalActivationCode: '',
        productId: 'P',
        productVersion: '1',
        platformIdentity: 'id',
      })
    ).toThrow(/invalid/i);
  });
});

describe('Phase 7 activation response parser', () => {
  it('does not accept HTTP 200 alone', async () => {
    const { parseActivationResponse } = await import(
      '../lib/mraEis/application/activation/activationResponseParser.js'
    );
    const parsed = parseActivationResponse({
      httpStatus: 200,
      body: { statusCode: 0, remark: 'fail', data: null, errors: [{ code: 'INVALID_TAC' }] },
    });
    expect(parsed.accepted).toBe(false);
    expect(parsed.outcome).toBe('INVALID_TAC');
    expect(parsed.jwtToken).toBeNull();
  });

  it('requires terminalId, JWT and secret for acceptance', async () => {
    const { parseActivationResponse } = await import(
      '../lib/mraEis/application/activation/activationResponseParser.js'
    );
    const missing = parseActivationResponse({
      httpStatus: 200,
      body: {
        statusCode: 1,
        data: {
          activatedTerminal: {
            terminalId: 'T1',
            terminalCredentials: { jwtToken: 'x' },
          },
        },
      },
    });
    expect(missing.accepted).toBe(false);
    expect(missing.outcome).toBe('INVALID_RESPONSE');

    const ok = parseActivationResponse({
      httpStatus: 200,
      body: {
        statusCode: 1,
        data: {
          activatedTerminal: {
            terminalId: 'T1',
            terminalCredentials: { jwtToken: 'jwt', secretKey: 'sec' },
            globalConfiguration: { version: 'g1' },
          },
        },
      },
    });
    expect(ok.accepted).toBe(true);
    expect(ok.sanitizedResponse.hasJwt).toBe(true);
    expect(ok.sanitizedResponse.jwtToken).toBeUndefined();
    expect(ok.sanitizedResponse.secretKey).toBeUndefined();
    expect(JSON.stringify(ok.sanitizedResponse)).not.toContain('"jwt"');
    expect(JSON.stringify(ok.sanitizedResponse)).not.toContain('secretKey');
  });
});

describe('Phase 7 mock MRA server', () => {
  it('returns success for MOCK-OK TAC', async () => {
    const { mockActivateTerminal } = await import(
      '../lib/mraEis/infrastructure/mraClient/mockMraActivationServer.js'
    );
    const res = await mockActivateTerminal({
      terminalActivationCode: 'MOCK-OK-ABC',
      productID: 'IB-EIS-MOCK',
      productVersion: '0.0.0-mock',
    });
    expect(res.httpStatus).toBe(200);
    expect(res.body.statusCode).toBe(1);
    expect(res.body.data.activatedTerminal.terminalCredentials.jwtToken).toBeTruthy();
    expect(res.body.data.activatedTerminal.terminalCredentials.secretKey).toBeTruthy();
  });

  it('marks timeout as dispatched for unknown-outcome handling', async () => {
    const { mockActivateTerminal } = await import(
      '../lib/mraEis/infrastructure/mraClient/mockMraActivationServer.js'
    );
    await expect(
      mockActivateTerminal({ terminalActivationCode: 'MOCK-TIMEOUT' })
    ).rejects.toMatchObject({ dispatched: true });
  });

  it('rejects invalid TAC with application status not accepted', async () => {
    const { mockActivateTerminal } = await import(
      '../lib/mraEis/infrastructure/mraClient/mockMraActivationServer.js'
    );
    const { parseActivationResponse } = await import(
      '../lib/mraEis/application/activation/activationResponseParser.js'
    );
    const res = await mockActivateTerminal({ terminalActivationCode: 'MOCK-INVALID-TAC' });
    const parsed = parseActivationResponse(res);
    expect(parsed.accepted).toBe(false);
    expect(parsed.outcome).toBe('INVALID_TAC');
  });

  it('confirms successfully', async () => {
    const { mockConfirmTerminal } = await import(
      '../lib/mraEis/infrastructure/mraClient/mockMraActivationServer.js'
    );
    const { parseConfirmationResponse } = await import(
      '../lib/mraEis/application/activation/activationResponseParser.js'
    );
    const res = await mockConfirmTerminal({ terminalId: 'MOCK-TID-1' });
    const parsed = parseConfirmationResponse(res);
    expect(parsed.accepted).toBe(true);
  });
});

describe('Phase 7 state machine', () => {
  it('allows DRAFT → TAC_REQUIRED → … → ACTIVE path edges', async () => {
    const { transitionTerminal, TERMINAL_TRANSITIONS } = await import(
      '../lib/mraEis/domain/operationalStateMachines.js'
    );
    const { TERMINAL_STATUS } = await import('../lib/mraEis/domain/operationalEnums.js');
    expect(() => transitionTerminal(TERMINAL_STATUS.DRAFT, TERMINAL_STATUS.TAC_REQUIRED)).not.toThrow();
    expect(() =>
      transitionTerminal(TERMINAL_STATUS.CONFIRMATION_IN_PROGRESS, TERMINAL_STATUS.ACTIVE)
    ).not.toThrow();
    expect(() => transitionTerminal(TERMINAL_STATUS.BLOCKED, TERMINAL_STATUS.ACTIVE)).toThrow();
    expect(TERMINAL_TRANSITIONS[TERMINAL_STATUS.ACTIVE].has(TERMINAL_STATUS.TOKEN_EXPIRED)).toBe(true);
  });

  it('blocks ACTIVE from activation response alone', async () => {
    const { transitionTerminal } = await import('../lib/mraEis/domain/operationalStateMachines.js');
    const { TERMINAL_STATUS } = await import('../lib/mraEis/domain/operationalEnums.js');
    expect(() =>
      transitionTerminal(TERMINAL_STATUS.ACTIVATION_RESPONSE_RECEIVED, TERMINAL_STATUS.ACTIVE)
    ).toThrow();
    expect(() =>
      transitionTerminal(TERMINAL_STATUS.CREDENTIALS_PERSISTED, TERMINAL_STATUS.ACTIVE)
    ).toThrow();
  });
});

describe('Phase 7 rate limiting', () => {
  it('enforces TAC submission limits', async () => {
    const { checkActivationRateLimit, resetActivationRateLimitsForTests } = await import(
      '../lib/mraEis/application/activation/rateLimit.js'
    );
    resetActivationRateLimitsForTests();
    let last;
    for (let i = 0; i < 6; i += 1) {
      last = checkActivationRateLimit({
        action: 'tac',
        tenantId: 't1',
        userId: 'u1',
        terminalId: 'term1',
        limit: 5,
      });
    }
    expect(last.allowed).toBe(false);
  });
});

describe('Phase 7 platform identity', () => {
  it('blocks production identity generation', async () => {
    const { ensureStablePlatformIdentity } = await import(
      '../lib/mraEis/application/activation/platformIdentity.js'
    );
    const db = {
      mraEisPlatformIdentity: {
        findFirst: async () => null,
        create: async () => {
          throw new Error('should not create');
        },
      },
    };
    await expect(
      ensureStablePlatformIdentity({
        tenantId: 't1',
        businessId: 't1',
        environment: 'PRODUCTION',
        db,
      })
    ).rejects.toThrow(/production|Q-017|identity/i);
  });
});

describe('Phase 7 confirmation HMAC KAT still holds', () => {
  it('signs with TAC as plaintext and secretKey as key', async () => {
    const { computeActivationConfirmationSignature, ACTIVATION_CONFIRMATION_KAT } = await import(
      '../lib/mraEis/infrastructure/security/activationHmac.js'
    );
    expect(
      computeActivationConfirmationSignature(
        ACTIVATION_CONFIRMATION_KAT.plaintext,
        ACTIVATION_CONFIRMATION_KAT.key
      )
    ).toBe(ACTIVATION_CONFIRMATION_KAT.expected);
  });
});

describe('Phase 7 security invariants (static)', () => {
  it('safe terminal DTO has no credential fields', async () => {
    const { safeTerminalDto } = await import(
      '../lib/mraEis/application/activation/activationOrchestrator.js'
    );
    const dto = safeTerminalDto({
      id: 'x',
      tenantId: 't',
      businessId: 't',
      environment: 'SANDBOX',
      terminalLabel: 'L',
      status: 'ACTIVE',
      jwtToken: 'should-not-leak',
      secretKey: 'should-not-leak',
      version: 1,
    });
    expect(dto.jwtToken).toBeUndefined();
    expect(dto.secretKey).toBeUndefined();
    expect(JSON.stringify(dto)).not.toMatch(/should-not-leak/);
  });
});
