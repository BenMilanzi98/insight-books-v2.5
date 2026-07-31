import { describe, expect, it, beforeAll, beforeEach } from 'vitest';

beforeAll(() => {
  process.env.MRA_EIS_ALLOW_TEST_MASTER_KEY = '1';
  process.env.MRA_EIS_ACTIVATION_MODE = 'MOCK';
  process.env.MRA_EIS_DEPLOYMENT_ENV = 'development';
});

beforeEach(async () => {
  const { resetMockConfigState } = await import(
    '../lib/mraEis/infrastructure/mraClient/mockMraConfigurationServer.js'
  );
  resetMockConfigState();
});

describe('Phase 8 configuration type registry', () => {
  it('orders GLOBAL → TERMINAL → TAXPAYER', async () => {
    const { CONFIGURATION_SYNC_ORDER, MraConfigurationTypeRegistry } = await import(
      '../lib/mraEis/application/configuration/configurationTypeRegistry.js'
    );
    expect(CONFIGURATION_SYNC_ORDER).toEqual(['GLOBAL', 'TERMINAL', 'TAXPAYER']);
    expect(MraConfigurationTypeRegistry.GLOBAL.requiredForFiscalization).toBe(true);
    expect(MraConfigurationTypeRegistry.GLOBAL.requestHashContractStatus).toBe(
      'REQUIRES_MRA_CLARIFICATION'
    );
  });
});

describe('Phase 8 request mappers', () => {
  it('maps verified fields with canonical checksum', async () => {
    const { mapGlobalConfigurationRequest } = await import(
      '../lib/mraEis/application/configuration/configRequestMappers.js'
    );
    const mapped = mapGlobalConfigurationRequest({
      terminal: {
        mraTerminalId: 'MOCK-TID-1',
        productId: 'IB-EIS-MOCK',
        productVersion: '0.0.0-mock',
      },
      taxpayerTin: 'TEST-TIN-0001',
      currentVersion: 'mock-g-1',
    });
    expect(mapped.body.terminalId).toBe('MOCK-TID-1');
    expect(mapped.canonical.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(mapped.endpointKey).toBe('EP-CFG-01');
  });
});

describe('Phase 8 response parser', () => {
  it('does not accept HTTP 200 alone', async () => {
    const { parseConfigurationResponse } = await import(
      '../lib/mraEis/application/configuration/configResponseParser.js'
    );
    const parsed = parseConfigurationResponse({
      httpStatus: 200,
      body: { statusCode: 0, remark: 'no', data: null, errors: [{ code: 'REJECTED' }] },
      configurationType: 'GLOBAL',
    });
    expect(parsed.accepted).toBe(false);
  });

  it('requires version for acceptance', async () => {
    const { parseConfigurationResponse } = await import(
      '../lib/mraEis/application/configuration/configResponseParser.js'
    );
    const parsed = parseConfigurationResponse({
      httpStatus: 200,
      body: { statusCode: 1, data: { configuration: { taxRates: [] } } },
      configurationType: 'GLOBAL',
    });
    expect(parsed.accepted).toBe(false);
    expect(parsed.outcome).toBe('INVALID_RESPONSE');
  });

  it('detects TIN mismatch', async () => {
    const { parseConfigurationResponse } = await import(
      '../lib/mraEis/application/configuration/configResponseParser.js'
    );
    const parsed = parseConfigurationResponse({
      httpStatus: 200,
      body: {
        statusCode: 1,
        data: { configuration: { version: 'p1', tin: 'OTHER' } },
      },
      configurationType: 'TAXPAYER',
      expectedTin: 'EXPECTED',
    });
    expect(parsed.accepted).toBe(false);
    expect(parsed.outcome).toBe('CONTRACT_MISMATCH');
  });
});

describe('Phase 8 version comparison', () => {
  it('detects same version different checksum conflict', async () => {
    const { compareConfigurationVersions } = await import(
      '../lib/mraEis/application/configuration/configResponseParser.js'
    );
    const r = compareConfigurationVersions({
      localActiveVersion: 'v1',
      localChecksum: 'aaa',
      remoteVersion: 'v1',
      remoteChecksum: 'bbb',
    });
    expect(r.conflict).toBe(true);
    expect(r.relation).toBe('SAME_VERSION_DIFFERENT_CHECKSUM');
  });

  it('treats same version same checksum as idempotent no-op', async () => {
    const { compareConfigurationVersions } = await import(
      '../lib/mraEis/application/configuration/configResponseParser.js'
    );
    const r = compareConfigurationVersions({
      localActiveVersion: 'v1',
      localChecksum: 'aaa',
      remoteVersion: 'v1',
      remoteChecksum: 'aaa',
    });
    expect(r.requiresSnapshot).toBe(false);
    expect(r.conflict).toBe(false);
  });
});

describe('Phase 8 mock configuration server', () => {
  it('returns global/terminal/taxpayer success', async () => {
    const { mockGetConfiguration } = await import(
      '../lib/mraEis/infrastructure/mraClient/mockMraConfigurationServer.js'
    );
    for (const type of ['GLOBAL', 'TERMINAL', 'TAXPAYER']) {
      const res = await mockGetConfiguration(type, {
        terminalId: 'MOCK-TID-1',
        taxpayerTin: 'TEST-TIN-0001',
      });
      expect(res.httpStatus).toBe(200);
      expect(res.body.statusCode).toBe(1);
      expect(res.body.data.configuration.version).toBeTruthy();
    }
  });

  it('supports terminal blocked scenario', async () => {
    const { mockGetConfiguration, setMockConfigScenario } = await import(
      '../lib/mraEis/infrastructure/mraClient/mockMraConfigurationServer.js'
    );
    setMockConfigScenario('TERMINAL_BLOCKED');
    const res = await mockGetConfiguration('TERMINAL', { terminalId: 'MOCK-TID-1' });
    expect(res.body.data.configuration.terminalBlocked).toBe(true);
  });
});

describe('Phase 8 extraction', () => {
  it('extracts tax/levy/offline/receipt without enabling offline', async () => {
    const {
      extractTaxDefinitions,
      extractLevyDefinitions,
      extractOfflineThresholds,
      extractReceiptConfiguration,
    } = await import('../lib/mraEis/application/configuration/configExtractors.js');
    const global = {
      taxRates: [{ id: 'TAX-A', code: 'A', rate: 17.5, active: true }],
      levies: [{ id: 'L1', code: 'TL', rate: 1 }],
      receiptRequirements: { version: 'r1', qrRequired: true },
      offlinePolicies: { offlineAllowed: true, maximumAmount: 100, maximumAgeHours: 24 },
    };
    const taxes = extractTaxDefinitions(global, {
      configurationSnapshotId: 's1',
      tenantId: 't1',
      businessId: 't1',
      terminalId: 'term1',
      environment: 'SANDBOX',
    });
    const levies = extractLevyDefinitions(global, {
      configurationSnapshotId: 's1',
      tenantId: 't1',
      businessId: 't1',
      terminalId: 'term1',
      environment: 'SANDBOX',
    });
    const offline = extractOfflineThresholds(global, { offlineAllowed: true, offlineMaximumAmount: 50 });
    const receipt = extractReceiptConfiguration(global);
    expect(taxes).toHaveLength(1);
    expect(levies).toHaveLength(1);
    expect(offline.offlineAllowedByMra).toBe(true);
    expect(offline.offlineEnabledLocally).toBe(false);
    expect(receipt.productionQrGenerated).toBe(false);
  });
});

describe('Phase 8 staleness / pause contract', () => {
  it('pauses fiscal processing when STALE', async () => {
    const { processingPauseContract } = await import(
      '../lib/mraEis/application/configuration/stalenessService.js'
    );
    const pause = processingPauseContract('STALE');
    expect(pause.allowNewFiscalSnapshots).toBe(false);
    expect(pause.allowTransmissionClaims).toBe(false);
    expect(pause.allowReadAccess).toBe(true);
    expect(pause.allowConfigurationSync).toBe(true);
    expect(pause.allowReconciliation).toBe(true);
    expect(pause.processingPaused).toBe(true);
  });

  it('allows fiscal processing when CURRENT', async () => {
    const { processingPauseContract } = await import(
      '../lib/mraEis/application/configuration/stalenessService.js'
    );
    const pause = processingPauseContract('CURRENT');
    expect(pause.allowNewFiscalSnapshots).toBe(true);
    expect(pause.processingPaused).toBe(false);
  });
});

describe('Phase 8 BOD timezone', () => {
  it('resolves Business date in Africa/Blantyre', async () => {
    const { resolveBusinessDate } = await import(
      '../lib/mraEis/application/configuration/bodScheduler.js'
    );
    const d = resolveBusinessDate('Africa/Blantyre', new Date('2026-07-22T22:00:00Z'));
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('Phase 8 end-to-end mock parse path', () => {
  it('parses successful mock responses for all types', async () => {
    const { mockGetConfiguration } = await import(
      '../lib/mraEis/infrastructure/mraClient/mockMraConfigurationServer.js'
    );
    const { parseConfigurationResponse } = await import(
      '../lib/mraEis/application/configuration/configResponseParser.js'
    );
    for (const type of ['GLOBAL', 'TERMINAL', 'TAXPAYER']) {
      const res = await mockGetConfiguration(type, {
        terminalId: 'MOCK-TID-1',
        taxpayerTin: 'TEST-TIN-0001',
      });
      const parsed = parseConfigurationResponse({
        httpStatus: res.httpStatus,
        body: res.body,
        configurationType: type,
        expectedTerminalId: 'MOCK-TID-1',
        expectedTin: 'TEST-TIN-0001',
      });
      expect(parsed.accepted).toBe(true);
      expect(parsed.sanitizedResponse.version).toBeTruthy();
    }
  });
});
