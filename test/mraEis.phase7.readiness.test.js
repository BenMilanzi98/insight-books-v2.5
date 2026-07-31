import { describe, expect, it, beforeAll, vi } from 'vitest';

beforeAll(() => {
  process.env.MRA_EIS_ALLOW_TEST_MASTER_KEY = '1';
  process.env.MRA_EIS_TEST_MASTER_KEY =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.MRA_EIS_DEPLOYMENT_ENV = 'development';
  process.env.MRA_EIS_ACTIVATION_MODE = 'MOCK';
  process.env.MRA_EIS_PRODUCT_ID = 'IB-EIS-MOCK';
  process.env.MRA_EIS_PRODUCT_VERSION = '0.0.0-mock';
});

function mockDb({ product = null, identity = null, tenant = { id: 't1', name: 'Biz', tin: '123' } } = {}) {
  return {
    mraEisCertifiedProduct: {
      findFirst: async () => product,
    },
    mraEisPlatformIdentity: {
      findFirst: async () => identity,
    },
    tenant: {
      findUnique: async () => tenant,
    },
    branch: {
      findFirst: async () => null,
    },
  };
}

describe('Phase 7 readiness service', () => {
  it('blocks production create (SaaS identity / certification gates)', async () => {
    vi.resetModules();
    vi.doMock('../lib/mraEis/application/capabilityService.js', () => ({
      evaluateTenantEisCapability: async () => ({
        platformEnabled: true,
        tenantEntitled: true,
        tenantParticipating: true,
        businessSetupAllowed: true,
        productionAllowed: true,
        sandboxAllowed: true,
        certificationSatisfied: true,
        environmentAuthorized: true,
      }),
    }));
    const { evaluateTerminalActivationReadiness } = await import(
      '../lib/mraEis/application/activation/readinessService.js'
    );
    const result = await evaluateTerminalActivationReadiness({
      tenantId: 't1',
      businessId: 't1',
      environment: 'PRODUCTION',
      db: mockDb({
        product: { productId: 'P', productVersion: '1.0.0', status: 'ACTIVE' },
        identity: { identityValue: 'x' },
      }),
    });
    expect(result.readyToCreateTerminal).toBe(false);
    expect(result.blockers.some((b) => b.code === 'STABLE_PLATFORM_IDENTITY_REQUIRED')).toBe(true);
  });

  it('allows mock/sandbox create when core gates pass', async () => {
    vi.resetModules();
    vi.doMock('../lib/mraEis/application/capabilityService.js', () => ({
      evaluateTenantEisCapability: async () => ({
        platformEnabled: true,
        tenantEntitled: true,
        tenantParticipating: true,
        businessSetupAllowed: true,
        productionAllowed: false,
        sandboxAllowed: true,
        certificationSatisfied: false,
        environmentAuthorized: true,
      }),
    }));
    const { evaluateTerminalActivationReadiness } = await import(
      '../lib/mraEis/application/activation/readinessService.js'
    );
    const result = await evaluateTerminalActivationReadiness({
      tenantId: 't1',
      businessId: 't1',
      environment: 'SANDBOX',
      db: mockDb(),
    });
    expect(result.readyToCreateTerminal).toBe(true);
    expect(result.productId).toBeTruthy();
    expect(result.productVersion).toBeTruthy();
    expect(result.readyToSubmitActivation).toBe(true);
  });

  it('blocks when tenant not entitled', async () => {
    vi.resetModules();
    vi.doMock('../lib/mraEis/application/capabilityService.js', () => ({
      evaluateTenantEisCapability: async () => ({
        platformEnabled: true,
        tenantEntitled: false,
        tenantParticipating: false,
        businessSetupAllowed: false,
        productionAllowed: false,
        sandboxAllowed: false,
      }),
    }));
    const { evaluateTerminalActivationReadiness } = await import(
      '../lib/mraEis/application/activation/readinessService.js'
    );
    const result = await evaluateTerminalActivationReadiness({
      tenantId: 't1',
      businessId: 't1',
      environment: 'SANDBOX',
      db: mockDb(),
    });
    expect(result.readyToCreateTerminal).toBe(false);
    expect(result.blockers.some((b) => b.code === 'TENANT_NOT_ENTITLED')).toBe(true);
  });
});
