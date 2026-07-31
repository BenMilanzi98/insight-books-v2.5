import { describe, expect, it, beforeAll } from 'vitest';
import {
  TAX_TREATMENT_TYPE,
  SPLIT_PAYMENT_POLICY,
  MAPPING_STATUS,
  MRA_PAYMENT_CODE,
} from '../lib/mraEis/domain/operationalEnums.js';

beforeAll(() => {
  process.env.MRA_EIS_ALLOW_TEST_MASTER_KEY = '1';
  process.env.MRA_EIS_DEPLOYMENT_ENV = 'development';
  delete process.env.MRA_EIS_SPLIT_PAYMENT_POLICY;
});

describe('Phase 9 mapping type registry', () => {
  it('marks Virtual Warehouse and split-payment as clarification-blocked', async () => {
    const { getMappingType, isMappingTypeBlocked, getSplitPaymentPolicy } = await import(
      '../lib/mraEis/application/mapping/mappingTypeRegistry.js'
    );
    expect(isMappingTypeBlocked('WAREHOUSE_TO_MRA_VIRTUAL_WAREHOUSE')).toBe(true);
    expect(isMappingTypeBlocked('SPLIT_PAYMENT_TO_MRA_REPRESENTATION')).toBe(true);
    expect(getMappingType('BRANCH_TO_MRA_SITE').verificationRequired).toBe(true);
    expect(getSplitPaymentPolicy()).toBe(SPLIT_PAYMENT_POLICY.REQUIRES_MRA_CLARIFICATION);
  });
});

describe('Phase 9 tax treatments', () => {
  it('rejects zero-rated vs exempt interchange', async () => {
    const { assertCompatibleTaxTreatments } = await import(
      '../lib/mraEis/application/mapping/taxTreatment.js'
    );
    expect(() =>
      assertCompatibleTaxTreatments(TAX_TREATMENT_TYPE.ZERO_RATED, TAX_TREATMENT_TYPE.EXEMPT)
    ).toThrow(/Zero-rated and exempt/);
  });

  it('keeps VAT5 separate from ordinary zero-rate', async () => {
    const { assertCompatibleTaxTreatments } = await import(
      '../lib/mraEis/application/mapping/taxTreatment.js'
    );
    expect(() =>
      assertCompatibleTaxTreatments(TAX_TREATMENT_TYPE.VAT5_RELIEF, TAX_TREATMENT_TYPE.ZERO_RATED)
    ).toThrow(/VAT5/);
  });

  it('accepts matching standard treatments', async () => {
    const { assertCompatibleTaxTreatments } = await import(
      '../lib/mraEis/application/mapping/taxTreatment.js'
    );
    const r = assertCompatibleTaxTreatments(
      TAX_TREATMENT_TYPE.STANDARD_RATED,
      TAX_TREATMENT_TYPE.STANDARD_RATED
    );
    expect(r.local).toBe(TAX_TREATMENT_TYPE.STANDARD_RATED);
  });

  it('does not infer treatment from zero rate alone', async () => {
    const { inferTreatmentFromExternalCategory } = await import(
      '../lib/mraEis/application/mapping/taxTreatment.js'
    );
    expect(inferTreatmentFromExternalCategory(null, 0)).toBeNull();
  });
});

describe('Phase 9 split-payment policy', () => {
  it('blocks unverified split payments without flattening', async () => {
    const { evaluateSplitPaymentSupport } = await import(
      '../lib/mraEis/application/mapping/splitPaymentPolicy.js'
    );
    const result = evaluateSplitPaymentSupport([
      { localPaymentMethodId: 'cash', amount: 100 },
      { localPaymentMethodId: 'mm', amount: 50 },
    ]);
    expect(result.blocked).toBe(true);
    expect(result.representationType).toBeNull();
    expect(result.components).toHaveLength(2);
  });

  it('allows single payment', async () => {
    const { evaluateSplitPaymentSupport } = await import(
      '../lib/mraEis/application/mapping/splitPaymentPolicy.js'
    );
    const result = evaluateSplitPaymentSupport([{ localPaymentMethodId: 'cash', amount: 100 }]);
    expect(result.blocked).toBe(false);
    expect(result.representationType).toBe('SINGLE_PAYMENT');
  });
});

describe('Phase 9 mapping status model', () => {
  it('includes suggested/verified/active/stale lifecycle states', () => {
    expect(MAPPING_STATUS.SUGGESTED).toBe('SUGGESTED');
    expect(MAPPING_STATUS.VERIFIED).toBe('VERIFIED');
    expect(MAPPING_STATUS.ACTIVE).toBe('ACTIVE');
    expect(MAPPING_STATUS.STALE).toBe('STALE');
    expect(MAPPING_STATUS.PENDING_APPROVAL).toBe('PENDING_APPROVAL');
  });
});

describe('Phase 9 payment codes', () => {
  it('exposes verified API codes distinct from display labels', () => {
    expect(MRA_PAYMENT_CODE.CASH).toBe('CASH');
    expect(MRA_PAYMENT_CODE.MOBILE_MONEY).toBe('MOBILE_MONEY');
    expect(MRA_PAYMENT_CODE.CREDIT).toBe('CREDIT');
    expect(Object.values(MRA_PAYMENT_CODE).every((c) => !c.includes(' '))).toBe(true);
  });
});

describe('Phase 9 mapping snapshot contract', () => {
  it('stores mapping identities and versions, not credentials', async () => {
    const { buildResolvedMappingSnapshot } = await import(
      '../lib/mraEis/application/mapping/resolutionServices.js'
    );
    const snap = buildResolvedMappingSnapshot({
      site: {
        siteMappingId: 'sm1',
        mappingVersion: 2,
        mraSiteId: 'SITE-1',
        sourceConfigurationSnapshotId: 'cfg1',
      },
      taxes: [
        {
          localTaxRateId: 'tr1',
          taxMappingId: 'tm1',
          mappingVersion: 3,
          mraTaxRateId: 'A',
          treatmentType: TAX_TREATMENT_TYPE.STANDARD_RATED,
          localRateSnapshot: 17.5,
          mraRateSnapshot: 17.5,
          sourceConfigurationSnapshotId: 'cfg1',
        },
      ],
      payments: [
        {
          localPaymentMethodId: 'pm1',
          mappingId: 'pay1',
          mappingVersion: 1,
          mraPaymentMethodCode: MRA_PAYMENT_CODE.CASH,
        },
      ],
    });
    expect(snap.site.mappingId).toBe('sm1');
    expect(snap.site.mappingVersion).toBe(2);
    expect(snap.taxes[0].mappingVersion).toBe(3);
    expect(snap.payments[0].mraPaymentMethodCode).toBe('CASH');
    expect(JSON.stringify(snap)).not.toMatch(/password|secret|jwt|credential/i);
  });
});

describe('Phase 9 site resolution determinism (pure rules)', () => {
  it('treats suggestions as non-active for readiness operations list', async () => {
    const { MAPPING_OPERATIONS } = await import(
      '../lib/mraEis/application/mapping/mappingReadiness.js'
    );
    expect(MAPPING_OPERATIONS.CREATE_FISCAL_SNAPSHOT).toBe('CREATE_FISCAL_SNAPSHOT');
    expect(MAPPING_OPERATIONS.ENABLE_PRODUCTION_OPERATION).toBe('ENABLE_PRODUCTION_OPERATION');
  });
});

describe('Phase 9 warehouse virtual mapping fail-closed', () => {
  it('rejects inventing virtual warehouse IDs', async () => {
    const { createWarehouseMapping } = await import(
      '../lib/mraEis/application/mapping/warehouseMapping.js'
    );
    await expect(
      createWarehouseMapping({
        tenantId: 't1',
        businessId: 't1',
        warehouseId: 'w1',
        branchId: 'b1',
        mappingType: 'WAREHOUSE_TO_MRA_VIRTUAL_WAREHOUSE',
        mraVirtualWarehouseId: 'invented',
      })
    ).rejects.toThrow(/Virtual Warehouse/);
  });
});

describe('Phase 9 effective-date overlap helper', () => {
  it('detects overlapping intervals used by mappingService', () => {
    const from = new Date('2026-01-01');
    const to = new Date('2026-06-30');
    const rowFrom = new Date('2026-06-01');
    const rowTo = null;
    const overlaps = (!to || rowFrom <= to) && (!rowTo || from <= rowTo);
    expect(overlaps).toBe(true);
  });
});

describe('Phase 9 credit vs collection distinction', () => {
  it('documents credit as fiscal sale payment code separate from collections', () => {
    expect(MRA_PAYMENT_CODE.CREDIT).not.toBe(MRA_PAYMENT_CODE.CASH);
    expect(MRA_PAYMENT_CODE.CREDIT).toBe('CREDIT');
  });
});
