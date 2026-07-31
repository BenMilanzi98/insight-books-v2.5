import { describe, expect, it, beforeAll } from 'vitest';
import crypto from 'crypto';

beforeAll(() => {
  process.env.MRA_EIS_ALLOW_TEST_MASTER_KEY = '1';
  process.env.MRA_EIS_DEPLOYMENT_ENV = 'development';
  process.env.MRA_EIS_USE_MOCK = '1';
});

describe('Phase 14 receipt / QR contracts', () => {
  it('allows mock provisional and blocks production / live sandbox generation', async () => {
    const {
      resolveReceiptContract,
      getReceiptContractDecision,
      RECEIPT_CONTRACT_STATUS,
      RECEIPT_TYPE,
    } = await import('../lib/mraEis/application/fiscalReceipt/receiptContractRegistry.js');

    const mock = resolveReceiptContract({ environment: 'SANDBOX', mode: 'MOCK' });
    expect(mock.allowsGeneration).toBe(true);
    expect(mock.decision).toBe(RECEIPT_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY);

    const production = resolveReceiptContract({ environment: 'PRODUCTION', mode: 'PRODUCTION' });
    expect(production.allowsGeneration).toBe(false);
    expect(production.decision).toBe(RECEIPT_CONTRACT_STATUS.BLOCKED);

    const live = resolveReceiptContract({ environment: 'SANDBOX', mode: 'SANDBOX' });
    expect(live.allowsGeneration).toBe(false);

    const mm58 = resolveReceiptContract({
      environment: 'SANDBOX',
      mode: 'MOCK',
      receiptType: RECEIPT_TYPE.POS_FISCAL_RECEIPT_58MM,
    });
    expect(mm58.allowsGeneration).toBe(false);

    const decision = getReceiptContractDecision();
    expect(decision.productionGeneration).toBe('BLOCKED');
  });

  it('QR source contract forbids invention and blocks production', async () => {
    const {
      resolveQrSourceContract,
      getQrSourceContractDecision,
      QR_CONTRACT_STATUS,
    } = await import('../lib/mraEis/application/fiscalReceipt/qrSourceContractRegistry.js');

    const mock = resolveQrSourceContract({ environment: 'SANDBOX', mode: 'MOCK' });
    expect(mock.allowsQrGeneration).toBe(true);
    expect(mock.contract.inventPayloadForbidden).toBe(true);

    const production = resolveQrSourceContract({ environment: 'PRODUCTION', mode: 'PRODUCTION' });
    expect(production.allowsQrGeneration).toBe(false);
    expect(production.decision).toBe(QR_CONTRACT_STATUS.BLOCKED);

    const decision = getQrSourceContractDecision();
    expect(decision.localVerifyUrlForbidden).toBe(true);
  });
});

describe('Phase 14 validation URL security', () => {
  it('accepts allowlisted HTTPS mock MRA host and rejects unsafe URLs', async () => {
    const { validateMraValidationUrl } = await import(
      '../lib/mraEis/application/fiscalReceipt/validationUrlSecurity.js'
    );
    const { resolveQrSourceContract } = await import(
      '../lib/mraEis/application/fiscalReceipt/qrSourceContractRegistry.js'
    );
    const policy = resolveQrSourceContract({ mode: 'MOCK' }).contract.URLPolicy;

    expect(validateMraValidationUrl('https://mock.mra.local/validate/MOCK', policy).valid).toBe(true);
    expect(validateMraValidationUrl('http://mock.mra.local/validate/MOCK', policy).valid).toBe(false);
    expect(validateMraValidationUrl('https://localhost/validate', policy).valid).toBe(false);
    expect(validateMraValidationUrl('https://127.0.0.1/validate', policy).valid).toBe(false);
    expect(validateMraValidationUrl('https://192.168.1.1/validate', policy).valid).toBe(false);
    expect(validateMraValidationUrl('https://evil.example/validate', policy).valid).toBe(false);
    expect(
      validateMraValidationUrl('https://user:pass@mock.mra.local/validate', policy).valid
    ).toBe(false);
    expect(validateMraValidationUrl('https://mock.mra.local:8443/validate', policy).valid).toBe(false);
  });
});

describe('Phase 14 QR source resolution', () => {
  it('selects validation URL by precedence and does not invent local QR', async () => {
    const { resolveQrSource } = await import(
      '../lib/mraEis/application/fiscalReceipt/qrSourceResolution.js'
    );
    const { resolveQrSourceContract } = await import(
      '../lib/mraEis/application/fiscalReceipt/qrSourceContractRegistry.js'
    );
    const contract = resolveQrSourceContract({ mode: 'MOCK' }).contract;

    const resolved = resolveQrSource({
      responseEvidence: {
        validationUrl: 'https://mock.mra.local/validate/ABC',
        sanitizedCanonicalResponse: {
          validationUrl: 'https://mock.mra.local/validate/ABC',
          qrDataPresent: true,
          qrData: 'RAW_PAYLOAD_DIFFERENT',
        },
      },
      qrSourceContract: contract,
      environment: 'SANDBOX',
    });
    expect(resolved.resolved).toBe(true);
    expect(resolved.sourceType).toBe('MRA_VALIDATION_URL');
    expect(resolved.exactSourceValue).toBe('https://mock.mra.local/validate/ABC');

    const missing = resolveQrSource({
      responseEvidence: {
        sanitizedCanonicalResponse: { qrDataPresent: true },
      },
      qrSourceContract: contract,
      environment: 'SANDBOX',
    });
    expect(missing.resolved).toBe(false);
    expect(missing.blockers).toContain('QR_SOURCE_MISSING');

    const localForbidden = resolveQrSource({
      responseEvidence: {
        validationUrl: 'https://app.insightbooks.local/verify/sale-1',
        sanitizedCanonicalResponse: {
          validationUrl: 'https://app.insightbooks.local/verify/sale-1',
        },
      },
      qrSourceContract: contract,
      environment: 'SANDBOX',
    });
    expect(localForbidden.resolved).toBe(false);
  });
});

describe('Phase 14 QR generate + decode', () => {
  it('generates PNG/SVG and decode-matches exact source', async () => {
    const { generateAndVerifyQr } = await import(
      '../lib/mraEis/application/fiscalReceipt/qrCodeGenerator.js'
    );
    const source = 'https://mock.mra.local/validate/PHASE14-TEST';
    const qr = await generateAndVerifyQr({
      exactSourceValue: source,
      minimumPixelSize: 160,
      quietZoneModules: 4,
    });
    expect(qr.decodeVerified).toBe(true);
    expect(qr.exactSourceValue).toBe(source);
    expect(qr.pngBuffer.length).toBeGreaterThan(100);
    expect(qr.svgString).toContain('<svg');
    expect(qr.logoEmbedded).toBe(false);
    expect(qr.exactSourceChecksum).toBe(
      crypto.createHash('sha256').update(source, 'utf8').digest('hex')
    );
  });
});

describe('Phase 14 receipt data + renderers', () => {
  it('builds immutable receipt data without secrets and renders 80mm + A4', async () => {
    const { buildImmutableReceiptData } = await import(
      '../lib/mraEis/application/fiscalReceipt/receiptDataBuilder.js'
    );
    const { renderPos80Html, renderSalesInvoiceA4Pdf, evaluatePos58Support } = await import(
      '../lib/mraEis/application/fiscalReceipt/receiptRenderer.js'
    );
    const { resolveReceiptContract } = await import(
      '../lib/mraEis/application/fiscalReceipt/receiptContractRegistry.js'
    );
    const { resolveReceiptTemplate } = await import(
      '../lib/mraEis/application/fiscalReceipt/receiptTemplateRegistry.js'
    );
    const { RECEIPT_TYPE } = await import(
      '../lib/mraEis/application/fiscalReceipt/receiptContractRegistry.js'
    );

    const contract = resolveReceiptContract({ mode: 'MOCK' }).contract;
    const tpl = resolveReceiptTemplate({
      receiptType: RECEIPT_TYPE.POS_FISCAL_RECEIPT_80MM,
      environment: 'SANDBOX',
    });

    const { receiptData, receiptDataChecksum } = buildImmutableReceiptData({
      identity: {
        fiscalReceiptId: 'rcpt-1',
        transmissionId: 'tx-1',
        acceptedAttemptId: 'att-1',
        responseEvidenceId: 'resp-1',
        fiscalSnapshotId: 'snap-1',
        fiscalNumberAssignmentId: 'alloc-1',
        fiscalNumber: 'SYN-TERM1-20260722-000001',
        mraTransactionId: 'MOCK-TXN-1',
        localTransactionNumber: 'POS-1',
        sourceType: 'POS_SALE',
        snapshotChecksum: 'abc',
        mode: 'MOCK',
      },
      environment: 'SANDBOX',
      canonicalSnapshot: {
        seller: { sellerTin: 'TIN123', legalName: 'Acme Trading' },
        buyer: { buyerClassification: 'ANONYMOUS_B2C' },
        location: { siteMappingId: 'site-1', branchName: 'Main' },
        terminal: { mraTerminalId: 'MRA-T1' },
        source: { sourceFinalizedAt: '2026-07-22T10:00:00.000Z', sourceTransactionNumber: 'POS-1' },
        fiscalNumber: { formatted: 'SYN-TERM1-20260722-000001', isSynthetic: true },
        lines: [
          {
            lineNumber: 1,
            description: 'Widget',
            quantity: '1.000000',
            unitPrice: '100.00',
            discountAmount: '0.00',
            netAmount: '100.00',
            taxAmount: '0.00',
            levyAmount: '0.00',
            grossAmount: '100.00',
            isProduct: true,
            unitOfMeasure: 'EA',
          },
        ],
        taxSummary: [{ taxableAmount: '100.00', taxAmount: '0.00' }],
        levySummary: [],
        payment: {
          classification: 'IMMEDIATE',
          components: [{ mraPaymentMethodCode: 'CASH', amount: '100.00', isCreditComponent: false }],
          totalPaymentAmount: '100.00',
          amountTendered: '100.00',
          changeAmount: '0.00',
        },
        currency: { transactionCurrency: 'MWK' },
        totals: {
          headerNetTotal: '100.00',
          headerDiscountTotal: '0.00',
          headerTaxTotal: '0.00',
          headerLevyTotal: '0.00',
          headerGrossTotal: '100.00',
        },
      },
      responseEvidence: {
        sourceChecksum: 'resp-checksum',
        receivedAt: '2026-07-22T10:01:00.000Z',
        sanitizedCanonicalResponse: { mraTransactionId: 'MOCK-TXN-1' },
      },
      qrResolution: {
        resolved: true,
        sourceType: 'MRA_VALIDATION_URL',
        sourceResponseField: 'validationUrl',
        exactSourceChecksum: 'qr-checksum',
        contractVersion: 'qr-source-mock-v1',
        validationUrl: 'https://mock.mra.local/validate/MOCK',
      },
      receiptContract: contract,
      template: tpl.template,
    });

    expect(receiptDataChecksum).toHaveLength(64);
    expect(receiptData.sandbox).toBe(true);
    expect(receiptData.fiscal.fiscalNumber).toMatch(/^SYN-/);
    expect(JSON.stringify(receiptData)).not.toMatch(/buyerAuthorizationCode|Bearer |journalEntryId/);
    expect(receiptData.mraValidation.acceptedWording).toBe('Accepted by MRA');
    expect(receiptData.complianceEvidence.builtFromMutableMasterData).toBe(false);

    const html = renderPos80Html({
      receiptData,
      qrPngDataUrl: 'data:image/png;base64,AAAA',
      paperWidthMm: 80,
    });
    expect(html.html).toContain('Accepted by MRA');
    expect(html.html).toContain('SANDBOX');
    expect(html.html).toContain('rel="noopener noreferrer"');

    const pdf = renderSalesInvoiceA4Pdf({ receiptData });
    expect(pdf.buffer.slice(0, 4).toString()).toBe('%PDF');
    expect(pdf.checksum).toHaveLength(64);

    const mm58 = evaluatePos58Support();
    expect(mm58.supported).toBe(false);
  });

  it('storage rejects overwrite with different bytes for same key', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    const root = path.join(os.tmpdir(), `mra-eis-receipt-test-${Date.now()}`);
    process.env.MRA_EIS_RECEIPT_STORAGE_ROOT = root;

    const { storeImmutableArtifact } = await import(
      '../lib/mraEis/application/fiscalReceipt/receiptArtifactStorage.js'
    );

    const args = {
      tenantId: 't1',
      businessId: 't1',
      fiscalReceiptId: 'r1',
      artifactType: 'POS_80MM_HTML',
      bytes: Buffer.from('hello'),
      mimeType: 'text/html',
      extension: 'html',
    };
    const first = await storeImmutableArtifact(args);
    const second = await storeImmutableArtifact(args);
    expect(second.reused).toBe(true);
    expect(second.artifactChecksum).toBe(first.artifactChecksum);

    await expect(
      storeImmutableArtifact({ ...args, bytes: Buffer.from('different') })
    ).rejects.toMatchObject({ code: 'MRA_EIS_FISCAL_RECEIPT_IDEMPOTENCY_CONFLICT' });

    await fs.rm(root, { recursive: true, force: true });
  });
});

describe('Phase 14 typed errors', () => {
  it('exposes stable transmission-not-accepted error code', async () => {
    const { FiscalReceiptErrors } = await import(
      '../lib/mraEis/application/fiscalReceipt/fiscalReceiptErrors.js'
    );
    const err = FiscalReceiptErrors.transmissionNotAccepted();
    expect(err.code).toBe('MRA_EIS_TRANSMISSION_NOT_ACCEPTED_FOR_RECEIPT');
    expect(FiscalReceiptErrors.qrSourceMissing().code).toBe('MRA_EIS_QR_SOURCE_MISSING');
    expect(FiscalReceiptErrors.validationUrlUntrusted().code).toBe(
      'MRA_EIS_VALIDATION_URL_UNTRUSTED'
    );
  });
});
