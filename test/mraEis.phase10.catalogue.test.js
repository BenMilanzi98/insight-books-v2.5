import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { MAPPING_TYPE, EXTERNAL_CATALOGUE_TYPE } from '../lib/mraEis/domain/operationalEnums.js';

beforeAll(() => {
  process.env.MRA_EIS_ALLOW_TEST_MASTER_KEY = '1';
  process.env.MRA_EIS_ACTIVATION_MODE = 'MOCK';
  process.env.MRA_EIS_DEPLOYMENT_ENV = 'development';
  delete process.env.MRA_EIS_INITIAL_INVENTORY_SUBMIT;
});

beforeEach(async () => {
  const { resetMockCatalogueState } = await import(
    '../lib/mraEis/infrastructure/mraClient/mockMraCatalogueServer.js'
  );
  resetMockCatalogueState();
});

describe('Phase 10 product sync contract', () => {
  it('blocks production and forbids GET/POST fallback', async () => {
    const {
      getProductSyncContractDecision,
      assertCatalogueSyncContractAllowsLiveCall,
    } = await import('../lib/mraEis/application/catalogue/productSyncContract.js');
    const decision = getProductSyncContractDecision();
    expect(decision.status).toBe('REQUIRES_MRA_CLARIFICATION');
    expect(decision.productionCallsAllowed).toBe(false);
    expect(decision.autoFallbackBetweenGetAndPost).toBe(false);
    expect(() =>
      assertCatalogueSyncContractAllowsLiveCall({ environment: 'PRODUCTION', mode: 'LIVE' })
    ).toThrow(/blocked|clarif/i);
  });
});

describe('Phase 10 catalogue response parser', () => {
  it('does not accept HTTP 200 alone', async () => {
    const { parseCatalogueResponse, CATALOGUE_RESPONSE_OUTCOME } = await import(
      '../lib/mraEis/application/catalogue/catalogueResponseParser.js'
    );
    const parsed = parseCatalogueResponse({
      httpStatus: 200,
      body: { statusCode: 0, remark: 'no' },
    });
    expect(parsed.accepted).toBe(false);
    expect(parsed.outcome).toBe(CATALOGUE_RESPONSE_OUTCOME.INVALID_RESPONSE);
  });

  it('requires catalogue version', async () => {
    const { parseCatalogueResponse } = await import(
      '../lib/mraEis/application/catalogue/catalogueResponseParser.js'
    );
    const parsed = parseCatalogueResponse({
      httpStatus: 200,
      body: { statusCode: 1, data: { products: [] } },
    });
    expect(parsed.accepted).toBe(false);
  });

  it('parses product records without inventing service type from quantity', async () => {
    const { parseCatalogueResponse, CATALOGUE_RESPONSE_OUTCOME } = await import(
      '../lib/mraEis/application/catalogue/catalogueResponseParser.js'
    );
    const parsed = parseCatalogueResponse({
      httpStatus: 200,
      body: {
        statusCode: 1,
        data: {
          version: 'v1',
          tin: 'T1',
          siteId: 'S1',
          products: [
            {
              type: 'PRODUCT',
              productCode: 'P1',
              name: 'Item',
              quantity: 5,
              sellingPrice: 10,
              barcode: '123',
            },
          ],
          complete: true,
        },
      },
      expectedTin: 'T1',
      expectedSiteId: 'S1',
    });
    expect(parsed.accepted).toBe(true);
    expect(parsed.outcome).toBe(CATALOGUE_RESPONSE_OUTCOME.CATALOGUE_RECEIVED);
    expect(parsed.records[0].externalType).toBe(EXTERNAL_CATALOGUE_TYPE.PRODUCT);
    expect(parsed.records[0].mraCode).toBe('P1');
  });
});

describe('Phase 10 mock catalogue server', () => {
  it('rejects non-POST methods', async () => {
    const { mockGetCatalogue } = await import(
      '../lib/mraEis/infrastructure/mraClient/mockMraCatalogueServer.js'
    );
    const res = await mockGetCatalogue({ body: {}, method: 'GET' });
    expect(res.httpStatus).toBe(405);
  });

  it('returns synthetic products for SUCCESS', async () => {
    const { mockGetCatalogue } = await import(
      '../lib/mraEis/infrastructure/mraClient/mockMraCatalogueServer.js'
    );
    const res = await mockGetCatalogue({
      body: { siteId: 'MOCK-SITE-1', tin: 'TEST-TIN-0001', externalType: 'PRODUCT' },
      method: 'POST',
    });
    expect(res.httpStatus).toBe(200);
    expect(res.body.data.products.length).toBeGreaterThan(0);
  });
});

describe('Phase 10 UOM conversion', () => {
  it('converts exactly and rejects negatives', async () => {
    const { buildUomConversionRule, convertQuantityToExternal } = await import(
      '../lib/mraEis/application/catalogue/uomMapping.js'
    );
    const rule = buildUomConversionRule({
      localUom: 'BOX',
      externalUomCode: 'EA',
      conversionNumerator: 12,
      conversionDenominator: 1,
    });
    const converted = convertQuantityToExternal({ localQuantity: 2, conversionRule: rule });
    expect(converted.resolvedExternalQuantity).toBe('24');
    expect(converted.localInventoryMutated).toBe(false);
    expect(() => convertQuantityToExternal({ localQuantity: -1, conversionRule: rule })).toThrow(/Negative/);
  });

  it('rejects display-label external UOM', async () => {
    const { buildUomConversionRule } = await import(
      '../lib/mraEis/application/catalogue/uomMapping.js'
    );
    expect(() =>
      buildUomConversionRule({ localUom: 'EA', externalUomCode: 'Each Unit' })
    ).toThrow(/display label/i);
  });
});

describe('Phase 10 cross-type and bundle policy', () => {
  it('blocks default cross-type mappings', async () => {
    const { assertCrossTypeMappingAllowed, getBundlePolicy } = await import(
      '../lib/mraEis/application/catalogue/crossTypeAndBundlePolicy.js'
    );
    expect(() => assertCrossTypeMappingAllowed('PRODUCT_TO_SERVICE')).toThrow(/blocked/i);
    expect(getBundlePolicy().blocked).toBe(true);
    expect(MAPPING_TYPE.PRODUCT_TO_PRODUCT).toBe('PRODUCT_TO_PRODUCT');
  });
});

describe('Phase 10 initial inventory contract', () => {
  it('blocks unverified submission', async () => {
    const { getInitialInventoryContractDecision } = await import(
      '../lib/mraEis/application/catalogue/productSyncContract.js'
    );
    const { submitInitialInventoryToMra } = await import(
      '../lib/mraEis/infrastructure/mraClient/catalogueClient.js'
    );
    expect(getInitialInventoryContractDecision().submissionEnabled).toBe(false);
    await expect(
      submitInitialInventoryToMra({ snapshotId: 'x', idempotencyKey: 'y' })
    ).rejects.toThrow(/unverified|blocked/i);
  });
});

describe('Phase 10 replacement/delta policy', () => {
  it('forbids inactivation on partial pages under UNKNOWN policy', async () => {
    const { getCatalogueReplacementDeltaPolicy } = await import(
      '../lib/mraEis/application/catalogue/productSyncContract.js'
    );
    const p = getCatalogueReplacementDeltaPolicy();
    expect(p.policy).toBe('UNKNOWN');
    expect(p.inactivationAllowedOnPartialPage).toBe(false);
  });
});

describe('Phase 10 item mapping snapshot', () => {
  it('stores mapping and catalogue versions without credentials', async () => {
    const { buildResolvedItemMappingSnapshot } = await import(
      '../lib/mraEis/application/catalogue/productServiceResolution.js'
    );
    const snap = buildResolvedItemMappingSnapshot(
      {
        mappingId: 'm1',
        mappingVersion: 2,
        externalCatalogueItemId: 'e1',
        mraProductCode: 'P1',
        mraProductName: 'Good',
        sourceCatalogueVersion: 'cat-v1',
        sourceConfigurationSnapshotId: null,
        localUnitOfMeasure: 'BOX',
        mraUnitOfMeasure: 'EA',
        conversionRuleId: 'phase10-uom-conversion-v1',
        resolvedExternalQuantity: '12',
        taxResolution: { taxMappingId: 'tm1', taxMappingVersion: 1, mraTaxRateId: 'A' },
        levyResolutions: [],
        resolutionVersion: 'phase10-product-resolution-v1',
      },
      { sourceLineType: 'PRODUCT', localProductId: 'lp1', localQuantity: 1 }
    );
    expect(snap.mappingVersion).toBe(2);
    expect(snap.sourceCatalogueVersion).toBe('cat-v1');
    expect(JSON.stringify(snap)).not.toMatch(/password|secret|jwt|credential/i);
  });
});

describe('Phase 10 mapping type registry product/service', () => {
  it('blocks PRODUCT_TO_SERVICE by contract status', async () => {
    const { isMappingTypeBlocked, getMappingType } = await import(
      '../lib/mraEis/application/mapping/mappingTypeRegistry.js'
    );
    expect(isMappingTypeBlocked('PRODUCT_TO_SERVICE')).toBe(true);
    expect(getMappingType('PRODUCT_TO_PRODUCT').verificationRequired).toBe(true);
  });
});
