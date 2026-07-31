import { describe, expect, it, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.MRA_EIS_ALLOW_TEST_MASTER_KEY = '1';
  process.env.MRA_EIS_DEPLOYMENT_ENV = 'development';
});

describe('Phase 11 sales transaction type registry', () => {
  it('classifies POS and invoice as qualifying; excludes quote/proforma/payment/purchase', async () => {
    const {
      getSalesTransactionTypeDefinition,
      SALES_SOURCE_TYPE,
      classifySourceTypeFromHints,
    } = await import('../lib/mraEis/application/eligibility/salesTransactionTypeRegistry.js');

    expect(getSalesTransactionTypeDefinition(SALES_SOURCE_TYPE.POS_SALE).eisApplicability).toBe(
      'QUALIFYING'
    );
    expect(getSalesTransactionTypeDefinition(SALES_SOURCE_TYPE.SALES_INVOICE).eisApplicability).toBe(
      'QUALIFYING'
    );
    expect(getSalesTransactionTypeDefinition(SALES_SOURCE_TYPE.QUOTATION).eisApplicability).toBe(
      'EXCLUDED'
    );
    expect(getSalesTransactionTypeDefinition(SALES_SOURCE_TYPE.PROFORMA_INVOICE).eisApplicability).toBe(
      'EXCLUDED'
    );
    expect(getSalesTransactionTypeDefinition(SALES_SOURCE_TYPE.CUSTOMER_PAYMENT).eisApplicability).toBe(
      'EXCLUDED'
    );
    expect(getSalesTransactionTypeDefinition(SALES_SOURCE_TYPE.PURCHASE_INVOICE).eisApplicability).toBe(
      'EXCLUDED'
    );
    expect(getSalesTransactionTypeDefinition(SALES_SOURCE_TYPE.EXPENSE).eisApplicability).toBe(
      'EXCLUDED'
    );
    expect(getSalesTransactionTypeDefinition(SALES_SOURCE_TYPE.CREDIT_NOTE).eisApplicability).toBe(
      'CORRECTION_FUTURE'
    );
    expect(classifySourceTypeFromHints({ isCustomerPayment: true })).toBe(
      SALES_SOURCE_TYPE.CUSTOMER_PAYMENT
    );
  });
});

describe('Phase 11 buyer / VAT5 / payments messaging', () => {
  it('does not treat VAT5 as ordinary zero-rated and requires validation', async () => {
    const { evaluateVat5SaleReadiness } = await import(
      '../lib/mraEis/application/eligibility/buyerAndVat5.js'
    );
    const vat5 = evaluateVat5SaleReadiness({
      isVat5: true,
      buyerTinPresent: true,
      buyerAuthorizationReady: true,
    });
    expect(vat5.treatedAsOrdinaryZeroRated).toBe(false);
    expect(vat5.ready).toBe(false);
    expect(vat5.blockers).toContain('VAT5_RUNTIME_VALIDATION_REQUIRED');
  });

  it('requires buyer TIN for B2B without inventing validity from format alone', async () => {
    const { classifyBuyer, evaluateB2bBuyerReadiness } = await import(
      '../lib/mraEis/application/eligibility/buyerAndVat5.js'
    );
    const cls = classifyBuyer({ customerName: 'Acme', isB2BHint: true });
    expect(cls.buyerClassification).toBe('B2B');
    const ready = evaluateB2bBuyerReadiness({
      buyerClassification: 'B2B',
      buyerLegalName: 'Acme',
      buyerTin: 'ABC123456',
    });
    expect(ready.buyerTinPresent).toBe(true);
    expect(ready.warnings).toContain('TIN_FORMAT_ONLY_NOT_EXTERNALLY_VALIDATED');
  });

  it('never claims MRA acceptance in safe messages', async () => {
    const { safeEligibilityMessage, projectTransactionEisStatus } = await import(
      '../lib/mraEis/application/eligibility/statusAndMessaging.js'
    );
    const msg = safeEligibilityMessage({ decision: 'ELIGIBLE' });
    expect(msg.toLowerCase()).not.toMatch(/accepted by mra|mra validated|fiscalized/);
    expect(msg).toMatch(/not yet submitted/i);
    expect(projectTransactionEisStatus({ bridgeStatus: 'READY_FOR_FISCAL_SNAPSHOT' })).toBe(
      'EIS_READY_FOR_FISCAL_SNAPSHOT'
    );
  });
});

describe('Phase 11 totals and currency', () => {
  it('reconciles exact totals and blocks unsupported currency', async () => {
    const { reconcileSalesTotals, validateSalesCurrency } = await import(
      '../lib/mraEis/application/eligibility/totalsAndCurrency.js'
    );
    const ok = reconcileSalesTotals({
      lineNetTotal: 100,
      lineTaxTotal: 17.5,
      lineLevyTotal: 0,
      lineDiscountTotal: 0,
      lineGrossTotal: 117.5,
      headerNetTotal: 100,
      headerTaxTotal: 17.5,
      headerLevyTotal: 0,
      headerDiscountTotal: 0,
      headerGrossTotal: 117.5,
      paymentTotal: 117.5,
    });
    expect(ok.valid).toBe(true);

    const cur = validateSalesCurrency({ sourceCurrency: 'USD' });
    expect(cur.valid).toBe(false);
    expect(cur.blockers).toContain('UNSUPPORTED_CURRENCY');
  });
});

describe('Phase 11 split payment and line classification', () => {
  it('classifies lines and does not discard unknown sellable ambiguity', async () => {
    const { classifyAllSaleLines, SALE_LINE_CLASS } = await import(
      '../lib/mraEis/application/eligibility/lineClassification.js'
    );
    const lines = classifyAllSaleLines([
      { productId: 'p1', quantity: 1, unitPrice: 10 },
      { isService: true, productId: 's1', quantity: 1, unitPrice: 5 },
      { isBundle: true, quantity: 1, unitPrice: 20 },
      { description: 'mystery' },
    ]);
    expect(lines[0].class).toBe(SALE_LINE_CLASS.PRODUCT);
    expect(lines[1].class).toBe(SALE_LINE_CLASS.SERVICE);
    expect(lines[2].class).toBe(SALE_LINE_CLASS.BUNDLE);
    expect(lines[3].class).toBe(SALE_LINE_CLASS.UNKNOWN);
  });

  it('fail-closes unsupported split payments via payment resolution policy', async () => {
    const { evaluateSplitPaymentSupport } = await import(
      '../lib/mraEis/application/mapping/splitPaymentPolicy.js'
    );
    const split = evaluateSplitPaymentSupport([
      { localPaymentMethodId: 'Cash', amount: 50 },
      { localPaymentMethodId: 'Mobile Money', amount: 50 },
    ]);
    expect(split.blocked).toBe(true);
    expect(split.supported).toBe(false);
  });
});

describe('Phase 11 bridge identity and state machine', () => {
  it('builds stable finalization identity and rejects invalid transitions', async () => {
    const {
      buildSourceFinalizationIdentity,
      assertBridgeTransition,
      BRIDGE_STATUS,
    } = await import('../lib/mraEis/application/eligibility/salesBridgeService.js');

    const a = buildSourceFinalizationIdentity({
      tenantId: 't1',
      businessId: 't1',
      sourceType: 'POS_SALE',
      sourceId: 'sale1',
      sourceVersion: '1',
      finalizedAt: '2026-07-22T10:00:00.000Z',
      environment: 'SANDBOX',
    });
    const b = buildSourceFinalizationIdentity({
      tenantId: 't1',
      businessId: 't1',
      sourceType: 'POS_SALE',
      sourceId: 'sale1',
      sourceVersion: '1',
      finalizedAt: '2026-07-22T10:00:00.000Z',
      environment: 'SANDBOX',
    });
    expect(a.sourceFinalizationIdentity).toBe(b.sourceFinalizationIdentity);

    expect(() =>
      assertBridgeTransition(BRIDGE_STATUS.ELIGIBLE, BRIDGE_STATUS.OUTBOX_PENDING)
    ).not.toThrow();
    expect(() =>
      assertBridgeTransition(BRIDGE_STATUS.NOT_APPLICABLE, BRIDGE_STATUS.ELIGIBLE)
    ).toThrow();
  });

  it('outbox payload builder rejects secrets and buyer auth codes', async () => {
    const { appendEisOutboxEvent } = await import(
      '../lib/mraEis/infrastructure/outbox/outboxService.js'
    );
    await expect(
      appendEisOutboxEvent({
        tenantId: 't1',
        aggregateType: 'MraEisSalesBridge',
        aggregateId: 'b1',
        eventType: 'MRA_EIS_FISCAL_SNAPSHOT_REQUESTED',
        payload: { buyerAuthorizationCode: 'SECRET' },
        idempotencyKey: `test-secret-${Date.now()}`,
      })
    ).rejects.toThrow(/secret/i);
  });
});

describe('Phase 11 customer payment exclusion helper', () => {
  it('documents that customer payments do not create sales bridges', async () => {
    const { assertCustomerPaymentNotFiscalSale } = await import(
      '../lib/mraEis/application/eligibility/finalizationIntegration.js'
    );
    const result = assertCustomerPaymentNotFiscalSale();
    expect(result.createsSalesBridge).toBe(false);
    expect(result.sourceType).toBe('CUSTOMER_PAYMENT');
  });
});

describe('Phase 11 eligibility policy registry', () => {
  it('marks split-payment and VAT5 as clarification-blocked (fail closed)', async () => {
    const { getEligibilityPolicyEntry, policyFailsClosed } = await import(
      '../lib/mraEis/application/eligibility/eligibilityPolicyRegistry.js'
    );
    expect(getEligibilityPolicyEntry('SPLIT_PAYMENT_ELIGIBILITY').contractStatus).toBe(
      'REQUIRES_MRA_CLARIFICATION'
    );
    expect(policyFailsClosed('VAT5_ELIGIBILITY')).toBe(true);
    expect(policyFailsClosed('RETURN_CORRECTION_ELIGIBILITY')).toBe(true);
  });
});

describe('Phase 11 go-live boundary', () => {
  it('excludes transactions before go-live', async () => {
    const { isBeforeGoLive } = await import(
      '../lib/mraEis/application/eligibility/eisApplicability.js'
    );
    expect(
      isBeforeGoLive({
        transactionFinalizedAt: '2026-01-01T00:00:00.000Z',
        goLiveAt: '2026-07-01T00:00:00.000Z',
      })
    ).toBe(true);
    expect(
      isBeforeGoLive({
        transactionFinalizedAt: '2026-08-01T00:00:00.000Z',
        goLiveAt: '2026-07-01T00:00:00.000Z',
      })
    ).toBe(false);
  });
});
