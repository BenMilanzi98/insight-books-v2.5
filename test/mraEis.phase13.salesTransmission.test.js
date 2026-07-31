import { describe, expect, it, beforeAll, beforeEach } from 'vitest';

beforeAll(() => {
  process.env.MRA_EIS_ALLOW_TEST_MASTER_KEY = '1';
  process.env.MRA_EIS_DEPLOYMENT_ENV = 'development';
  process.env.MRA_EIS_USE_MOCK = '1';
});

describe('Phase 13 sales endpoint contract', () => {
  it('allows mock provisional and blocks live sandbox/production', async () => {
    const {
      resolveSalesEndpointContract,
      getSalesEndpointContractDecision,
      SALES_CONTRACT_STATUS,
    } = await import('../lib/mraEis/application/salesTransmission/salesEndpointContractRegistry.js');

    const mock = resolveSalesEndpointContract({ environment: 'SANDBOX', mode: 'MOCK' });
    expect(mock.allowsTransmission).toBe(true);
    expect(mock.isMock).toBe(true);

    const sandbox = resolveSalesEndpointContract({ environment: 'SANDBOX', mode: 'SANDBOX' });
    expect(sandbox.allowsTransmission).toBe(false);

    const production = resolveSalesEndpointContract({ environment: 'PRODUCTION', mode: 'PRODUCTION' });
    expect(production.allowsTransmission).toBe(false);
    expect(production.decision).toBe(SALES_CONTRACT_STATUS.BLOCKED);

    const decision = getSalesEndpointContractDecision();
    expect(decision.httpMethod).toBe('POST');
    expect(decision.productionTransmission).toBe('BLOCKED');
  });
});

describe('Phase 13 payload mapper', () => {
  it('maps immutable canonical snapshot without internal IDs or BAC', async () => {
    const { mapFiscalSnapshotToSalesRequestV1, validateSalesPayloadV1 } = await import(
      '../lib/mraEis/application/salesTransmission/salesPayloadMapper.js'
    );

    const snapshot = {
      terminalId: 'term-1',
      currency: 'MWK',
      localDocumentNumber: 'POS-1',
      transactionDate: new Date('2026-07-22T10:00:00.000Z'),
      subtotal: 100,
      discountTotal: 0,
      taxTotal: 0,
      levyTotal: 0,
      invoiceTotal: 100,
      canonicalSnapshot: {
        source: {
          sourceTransactionNumber: 'POS-1',
          sourceFinalizedAt: '2026-07-22T10:00:00.000Z',
        },
        seller: { sellerTin: 'TIN123', legalName: 'Acme', mraTerminalId: 'MRA-T1' },
        buyer: { buyerClassification: 'ANONYMOUS_B2C', b2bStatus: false, vat5Status: false },
        location: { siteMappingId: 'site-1' },
        transaction: { saleType: 'IMMEDIATE' },
        payment: {
          classification: 'IMMEDIATE',
          representationType: 'SINGLE',
          components: [{ mraPaymentMethodCode: 'CASH', amount: '100.00', isCreditComponent: false }],
          totalPaymentAmount: '100.00',
        },
        totals: {
          headerNetTotal: '100.00',
          headerDiscountTotal: '0.00',
          headerTaxTotal: '0.00',
          headerLevyTotal: '0.00',
          headerGrossTotal: '100.00',
        },
        currency: { transactionCurrency: 'MWK' },
        lines: [
          {
            lineNumber: 1,
            sourceLineType: 'PRODUCT',
            isProduct: true,
            localProductId: 'p1',
            description: 'Widget',
            quantity: '1.000000',
            unitPrice: '100.00',
            discountAmount: '0.00',
            netAmount: '100.00',
            taxAmount: '0.00',
            levyAmount: '0.00',
            grossAmount: '100.00',
            unitOfMeasure: 'EA',
          },
        ],
        taxSummary: [{ taxableAmount: '100.00', taxAmount: '0.00', lineCount: 1 }],
        levySummary: [],
        fiscalNumber: { formatted: 'SYN-TERM1-20260722-000001', isSynthetic: true },
        complianceEvidence: { vat5AuthorizationCodePresent: false },
      },
    };

    const mapped = mapFiscalSnapshotToSalesRequestV1({ snapshot, terminal: { mraTerminalId: 'MRA-T1' } });
    expect(mapped.dto.header.fiscalNumber).toMatch(/^SYN-/);
    expect(mapped.dto.header.onlineIndicator).toBe('ONLINE');
    expect(mapped.dto.lines).toHaveLength(1);
    expect(mapped.dto.offlineSignature).toBeUndefined();
    expect(JSON.stringify(mapped.dto)).not.toMatch(/buyerAuthorizationCode|journalEntryId|tenantId/);

    const validation = validateSalesPayloadV1(mapped.dto);
    expect(validation.valid).toBe(true);
  });

  it('blocks VAT5 submission path', async () => {
    const { mapFiscalSnapshotToSalesRequestV1 } = await import(
      '../lib/mraEis/application/salesTransmission/salesPayloadMapper.js'
    );
    expect(() =>
      mapFiscalSnapshotToSalesRequestV1({
        snapshot: {
          canonicalSnapshot: {
            buyer: { vat5Status: true },
            fiscalNumber: { formatted: 'SYN-1' },
            lines: [{ lineNumber: 1, grossAmount: '1.00' }],
            complianceEvidence: {},
            seller: {},
            payment: { components: [] },
            totals: {},
            currency: {},
            taxSummary: [],
            levySummary: [],
            source: {},
            location: {},
            transaction: {},
          },
        },
      })
    ).toThrow(/VAT5/i);
  });
});

describe('Phase 13 message hash', () => {
  it('hashes exact mock bytes and matches sent buffer', async () => {
    const { generateSalesMessageHash } = await import(
      '../lib/mraEis/application/salesTransmission/salesMessageHash.js'
    );
    const { canonicalize } = await import(
      '../lib/mraEis/infrastructure/security/canonicalization.js'
    );
    const { serializeSalesRequestBytes } = await import(
      '../lib/mraEis/application/salesTransmission/salesMessageHash.js'
    );

    const dto = { a: 1, b: ['x'], c: { d: '2.00' } };
    const ser = serializeSalesRequestBytes(dto, { canonicalizeFn: canonicalize });
    const hash = await generateSalesMessageHash({
      transmittedBytes: ser.transmittedBytes,
      mode: 'MOCK',
      contractHashMode: 'MOCK_SYNTHETIC_SHA256_HEX',
    });
    expect(hash.isMraVerified).toBe(false);
    expect(hash.headerValue).toHaveLength(64);
    expect(hash.inputChecksum).toBe(hash.headerValue);

    // Same bytes → same hash
    const hash2 = await generateSalesMessageHash({
      transmittedBytes: Buffer.from(ser.canonicalJson, 'utf8'),
      mode: 'MOCK',
    });
    expect(hash2.headerValue).toBe(hash.headerValue);
  });

  it('blocks live hash via fail-closed contract', async () => {
    const { generateSalesMessageHash } = await import(
      '../lib/mraEis/application/salesTransmission/salesMessageHash.js'
    );
    await expect(
      generateSalesMessageHash({
        transmittedBytes: Buffer.from('{}'),
        mode: 'PRODUCTION',
        contractHashMode: 'REQUIRES_MRA_CLARIFICATION',
      })
    ).rejects.toThrow(/hash|unverified|Q-010/i);
  });
});

describe('Phase 13 application status classifier', () => {
  it('does not treat HTTP 200 alone as acceptance', async () => {
    const {
      classifyHttpTransport,
      classifyApplicationStatus,
      TRANSPORT_CLASS,
      APP_OUTCOME,
    } = await import('../lib/mraEis/application/salesTransmission/applicationStatusClassifier.js');

    const transport = classifyHttpTransport({
      httpStatus: 200,
      contentType: 'application/json',
    });
    expect(transport).toBe(TRANSPORT_CLASS.HTTP_SUCCESS);

    const unknown = classifyApplicationStatus({
      body: { responseCode: 'WEIRD' },
      contract: { applicationStatusField: 'responseCode', acceptedStatusValues: ['SUCCESS'], rejectedStatusValues: [] },
      transportClass: transport,
    });
    expect(unknown.accepted).toBe(false);
    expect(unknown.outcome).toBe(APP_OUTCOME.UNKNOWN_APPLICATION_STATUS);

    const accepted = classifyApplicationStatus({
      body: { responseCode: 'SUCCESS', mraTransactionId: 'TX-1' },
      contract: { applicationStatusField: 'responseCode', acceptedStatusValues: ['SUCCESS'], rejectedStatusValues: [] },
      transportClass: transport,
    });
    expect(accepted.accepted).toBe(true);

    const rejected200 = classifyApplicationStatus({
      body: { responseCode: 'VALIDATION_ERROR', remark: 'bad' },
      contract: {
        applicationStatusField: 'responseCode',
        acceptedStatusValues: ['SUCCESS'],
        rejectedStatusValues: ['VALIDATION_ERROR'],
      },
      transportClass: transport,
    });
    expect(rejected200.accepted).toBe(false);
    expect(rejected200.outcome).toBe(APP_OUTCOME.REJECTED_VALIDATION);
  });
});

describe('Phase 13 mock sales server', () => {
  beforeEach(async () => {
    const { resetMockSalesState, setMockSalesScenario } = await import(
      '../lib/mraEis/infrastructure/mraClient/mockMraSalesServer.js'
    );
    resetMockSalesState();
    setMockSalesScenario('ACCEPT_STANDARD');
  });

  it('accepts mock sale with hash + bearer and returns transaction id', async () => {
    const { mockSubmitSalesTransaction } = await import(
      '../lib/mraEis/infrastructure/mraClient/mockMraSalesServer.js'
    );
    const res = await mockSubmitSalesTransaction({
      body: { header: { fiscalNumber: 'SYN-1' } },
      headers: {
        'x-eis-message-hash': 'abc',
        Authorization: 'Bearer MOCK',
      },
    });
    expect(res.httpStatus).toBe(200);
    expect(res.body.responseCode).toBe('SUCCESS');
    expect(res.body.mraTransactionId).toMatch(/^MOCK-TXN-/);
    expect(res.body.qrData).toBeTruthy();
  });

  it('returns HTTP 200 rejection without accepting', async () => {
    const { setMockSalesScenario, mockSubmitSalesTransaction } = await import(
      '../lib/mraEis/infrastructure/mraClient/mockMraSalesServer.js'
    );
    setMockSalesScenario('REJECT_VALIDATION');
    const res = await mockSubmitSalesTransaction({
      body: {},
      headers: { 'x-eis-message-hash': 'x', Authorization: 'Bearer y' },
    });
    expect(res.httpStatus).toBe(200);
    expect(res.body.responseCode).toBe('VALIDATION_ERROR');
  });
});

describe('Phase 13 permissions and outbox event names', () => {
  it('registers transmission permissions and Phase 14/15 events', async () => {
    const { TENANT_EIS_PERMISSIONS } = await import('../lib/mraEis/domain/permissions.js');
    expect(TENANT_EIS_PERMISSIONS.SALES_TRANSMISSION_VIEW).toBe('eis.salesTransmission.view');
    expect(TENANT_EIS_PERMISSIONS.SALES_TRANSMISSION_SUBMIT).toBe('eis.salesTransmission.submit');

    const { EIS_OUTBOX_EVENT } = await import('../lib/mraEis/domain/operationalEnums.js');
    expect(EIS_OUTBOX_EVENT.ACCEPTED_RECEIPT_REQUESTED).toBe('MRA_EIS_ACCEPTED_RECEIPT_REQUESTED');
    expect(EIS_OUTBOX_EVENT.TRANSMISSION_RECONCILIATION_REQUESTED).toBe(
      'MRA_EIS_TRANSMISSION_RECONCILIATION_REQUESTED'
    );
  });
});

describe('Phase 13 legacy direct call disabled', () => {
  it('guards eisService.submitInvoice against unsafe direct Sales', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync('lib/eisService.js', 'utf8');
    expect(src).toContain('LEGACY_DIRECT_SALES_DISABLED');
    expect(src).toContain('MRA_EIS_ALLOW_LEGACY_DIRECT_SALES');
    expect(src).toContain('Phase 13');
  });
});
