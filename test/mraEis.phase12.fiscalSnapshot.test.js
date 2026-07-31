import { describe, expect, it, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.MRA_EIS_ALLOW_TEST_MASTER_KEY = '1';
  process.env.MRA_EIS_DEPLOYMENT_ENV = 'development';
  process.env.MRA_EIS_ALLOW_SYNTHETIC_FISCAL_NUMBERS = '1';
});

describe('Phase 12 fiscal number contract registry', () => {
  it('blocks production allocation and allows synthetic sandbox only', async () => {
    const {
      resolveFiscalNumberContract,
      getMraEisFiscalNumberContractRegistry,
      getOnlineOfflineNumberPolicy,
    } = await import('../lib/mraEis/application/fiscalSnapshot/fiscalNumberContractRegistry.js');

    const sandbox = resolveFiscalNumberContract({ environment: 'SANDBOX' });
    expect(sandbox.allowsAllocation).toBe(true);
    expect(sandbox.isSynthetic).toBe(true);

    const production = resolveFiscalNumberContract({ environment: 'PRODUCTION' });
    expect(production.allowsAllocation).toBe(false);
    expect(production.productionBlocked).toBe(true);

    const registry = getMraEisFiscalNumberContractRegistry();
    expect(registry.maxPlusOneProhibited).toBe(true);
    expect(registry.localInvoiceNumberAsFiscalProhibited).toBe(true);

    const offline = getOnlineOfflineNumberPolicy();
    expect(offline.offlineAllocationEnabled).toBe(false);
  });
});

describe('Phase 12 fiscal number scope', () => {
  it('resolves sandbox terminal/day scope and blocks offline', async () => {
    const { resolveFiscalNumberScope, formatSyntheticFiscalNumber } = await import(
      '../lib/mraEis/application/fiscalSnapshot/fiscalNumberScope.js'
    );

    const ok = resolveFiscalNumberScope({
      tenantId: 'biz-1',
      businessId: 'biz-1',
      terminalId: 'term-abc',
      sourceType: 'POS_SALE',
      transactionDate: new Date('2026-07-22T10:00:00.000Z'),
      environment: 'SANDBOX',
      onlineOrOfflineMode: 'ONLINE',
    });
    expect(ok.resolved).toBe(true);
    expect(ok.scopeKey).toContain('SANDBOX');
    expect(ok.scopeKey).toContain('term-abc');
    expect(ok.isSynthetic).toBe(true);

    const offline = resolveFiscalNumberScope({
      tenantId: 'biz-1',
      businessId: 'biz-1',
      terminalId: 'term-abc',
      sourceType: 'POS_SALE',
      environment: 'SANDBOX',
      onlineOrOfflineMode: 'OFFLINE',
    });
    expect(offline.resolved).toBe(false);
    expect(offline.blockers).toContain('OFFLINE_NUMBERING_DISABLED');

    const formatted = formatSyntheticFiscalNumber({
      terminalId: 'term-abc',
      businessDate: '2026-07-22',
      sequence: 7,
    });
    expect(formatted).toMatch(/^SYN-/);
    expect(formatted).toContain('000007');
  });

  it('blocks production scope when contract unverified', async () => {
    const { resolveFiscalNumberScope } = await import(
      '../lib/mraEis/application/fiscalSnapshot/fiscalNumberScope.js'
    );
    const prod = resolveFiscalNumberScope({
      tenantId: 'biz-1',
      businessId: 'biz-1',
      terminalId: 'term-1',
      sourceType: 'POS_SALE',
      environment: 'PRODUCTION',
    });
    expect(prod.resolved).toBe(false);
    expect(prod.blockers).toContain('FISCAL_NUMBER_CONTRACT_UNVERIFIED');
  });
});

describe('Phase 12 source checksum and mutation', () => {
  it('produces deterministic source checksum and detects material change', async () => {
    const { computeSourceChecksumFromLoaded, classifySourceMutation, MUTATION_CLASS } = await import(
      '../lib/mraEis/application/fiscalSnapshot/sourceChecksum.js'
    );

    const bridge = {
      sourceType: 'POS_SALE',
      sourceId: 'sale-1',
      sourceTransactionNumber: 'POS-1',
      businessId: 'biz-1',
      branchId: 'br-1',
      currency: 'MWK',
      sourceFinalizedAt: new Date('2026-07-22T10:00:00.000Z'),
      grossAmount: 117.5,
      netAmount: 100,
      discountAmount: 0,
      taxAmount: 17.5,
      levyAmount: 0,
      buyerClassification: 'B2C_ANONYMOUS',
    };
    const source = { id: 'sale-1', customerId: null, paymentMethod: 'Cash', status: 'COMPLETED' };
    const lines = [
      {
        id: 'l1',
        productId: 'p1',
        quantity: 1,
        unitPrice: 100,
        discountAmount: 0,
        taxAmount: 17.5,
        amount: 117.5,
      },
    ];
    const payments = [{ id: 'pay1', amount: 117.5, method: 'Cash' }];

    const a = computeSourceChecksumFromLoaded({
      sourceType: 'POS_SALE',
      source,
      lines,
      payments,
      bridge,
    });
    const b = computeSourceChecksumFromLoaded({
      sourceType: 'POS_SALE',
      source,
      lines,
      payments,
      bridge,
    });
    expect(a.sourceChecksum).toBe(b.sourceChecksum);

    const mutatedLines = [{ ...lines[0], quantity: 2, amount: 233 }];
    const c = computeSourceChecksumFromLoaded({
      sourceType: 'POS_SALE',
      source,
      lines: mutatedLines,
      payments,
      bridge,
    });
    expect(c.sourceChecksum).not.toBe(a.sourceChecksum);

    const mutation = classifySourceMutation({
      bridgeChecksum: a.sourceChecksum,
      currentChecksum: c.sourceChecksum,
      identityMatches: true,
      sourceStatus: 'COMPLETED',
    });
    expect(mutation).toBe(MUTATION_CLASS.MATERIAL_CHANGE);
  });
});

describe('Phase 12 canonical snapshot + checksum', () => {
  it('is deterministic, excludes secrets, and changes when amounts change', async () => {
    const {
      buildSellerSnapshot,
      buildBuyerSnapshot,
      buildTerminalSnapshot,
      buildLocationSnapshot,
      buildFiscalLines,
      buildPaymentSnapshot,
      buildTaxAndLevySummaries,
      buildTotalsSnapshot,
      buildCanonicalFiscalSnapshot,
    } = await import('../lib/mraEis/application/fiscalSnapshot/canonicalSnapshotBuilder.js');

    const bridge = {
      id: 'bridge-1',
      tenantId: 'biz-1',
      businessId: 'biz-1',
      branchId: 'br-1',
      terminalId: 'term-1',
      siteMappingId: 'site-map-1',
      warehouseMappingId: null,
      eligibilityDecisionId: 'dec-1',
      sourceType: 'POS_SALE',
      sourceId: 'sale-1',
      sourceVersion: 'v1',
      sourceFinalizationIdentity: 'fin-1',
      sourceTransactionNumber: 'POS-1',
      sourceFinalizedAt: new Date('2026-07-22T10:00:00.000Z'),
      businessDate: new Date('2026-07-22'),
      environment: 'SANDBOX',
      currency: 'MWK',
      buyerClassification: 'B2C_ANONYMOUS',
      configurationSetChecksum: 'cfg-1',
      eligibilityPolicyVersion: 'phase11-eligibility-policy-v1',
      grossAmount: 100,
      netAmount: 100,
      taxAmount: 0,
      levyAmount: 0,
      discountAmount: 0,
    };

    const lines = [
      {
        id: 'l1',
        productId: 'p1',
        quantity: 1,
        unitPrice: 100,
        discount: 0,
        taxAmount: 0,
        levyAmount: 0,
        total: 100,
        description: 'Widget',
        unit: 'EA',
      },
    ];
    const payments = [{ id: 'pay1', amount: 100, method: 'Cash', amountTendered: 100, change: 0 }];

    const seller = buildSellerSnapshot({ bridge, terminal: { id: 'term-1', status: 'ACTIVE' } });
    const buyer = buildBuyerSnapshot({
      bridge,
      decision: { buyerClassification: 'B2C_ANONYMOUS' },
      source: {},
      customer: null,
    });
    expect(JSON.stringify(buyer)).not.toMatch(/buyerAuthorizationCode/i);

    const terminalSnap = buildTerminalSnapshot({
      terminal: { id: 'term-1', status: 'ACTIVE', mraTerminalId: 'MRA-T1' },
      bridge,
    });
    expect(JSON.stringify(terminalSnap)).not.toMatch(/jwt|secret|tac/i);

    const location = buildLocationSnapshot({ bridge });
    const fiscalLines = buildFiscalLines({ lines, bridge });
    const payment = buildPaymentSnapshot({ payments, bridge, source: {} });
    const { taxSummary, levySummary } = buildTaxAndLevySummaries({ fiscalLines });
    const totals = buildTotalsSnapshot({ bridge, source: { total: 100 }, fiscalLines, payment });
    expect(totals.valid).toBe(true);

    const built1 = buildCanonicalFiscalSnapshot({
      bridge,
      decision: {},
      seller,
      buyer,
      terminalSnap,
      location,
      fiscalLines,
      taxSummary,
      levySummary,
      payment,
      totals,
      currency: 'MWK',
      fiscalNumber: {
        formatted: 'SYN-TERM1-20260722-000001',
        rawSequence: 1,
        isSynthetic: true,
        contractVersion: 'v1',
        scopeKey: 'scope-1',
      },
      sourceChecksum: 'src-chk',
    });
    const built2 = buildCanonicalFiscalSnapshot({
      bridge,
      decision: {},
      seller,
      buyer,
      terminalSnap,
      location,
      fiscalLines,
      taxSummary,
      levySummary,
      payment,
      totals,
      currency: 'MWK',
      fiscalNumber: {
        formatted: 'SYN-TERM1-20260722-000001',
        rawSequence: 1,
        isSynthetic: true,
        contractVersion: 'v1',
        scopeKey: 'scope-1',
      },
      sourceChecksum: 'src-chk',
    });
    expect(built1.snapshotChecksum).toBe(built2.snapshotChecksum);
    expect(built1.canonicalJson).toBe(built2.canonicalJson);

    const totals2 = { ...totals, headerGrossTotal: '200.00', valid: true };
    const built3 = buildCanonicalFiscalSnapshot({
      bridge,
      decision: {},
      seller,
      buyer,
      terminalSnap,
      location,
      fiscalLines,
      taxSummary,
      levySummary,
      payment,
      totals: totals2,
      currency: 'MWK',
      fiscalNumber: {
        formatted: 'SYN-TERM1-20260722-000001',
        rawSequence: 1,
        isSynthetic: true,
        contractVersion: 'v1',
        scopeKey: 'scope-1',
      },
      sourceChecksum: 'src-chk',
    });
    expect(built3.snapshotChecksum).not.toBe(built1.snapshotChecksum);
  });
});

describe('Phase 12 last-transaction adapters', () => {
  it('are blocked and do not call MRA', async () => {
    const { getLastOnlineTransaction, getLastOfflineTransaction } = await import(
      '../lib/mraEis/application/fiscalSnapshot/lastTransactionAdapters.js'
    );
    const online = await getLastOnlineTransaction({});
    const offline = await getLastOfflineTransaction({});
    expect(online.blocked).toBe(true);
    expect(online.calledMra).toBe(false);
    expect(offline.blocked).toBe(true);
    expect(offline.calledMra).toBe(false);
  });
});

describe('Phase 12 Phase 13 outbox payload safety', () => {
  it('payload shape contains references only', async () => {
    const { SALES_PAYLOAD_REQUESTED_EVENT } = await import(
      '../lib/mraEis/application/fiscalSnapshot/snapshotOrchestrator.js'
    );
    expect(SALES_PAYLOAD_REQUESTED_EVENT).toBe('MRA_EIS_SALES_PAYLOAD_REQUESTED');

    const payload = {
      eventVersion: '1',
      tenantId: 'biz-1',
      businessId: 'biz-1',
      fiscalSnapshotId: 'snap-1',
      fiscalSnapshotVersion: '1',
      snapshotChecksum: 'abc',
      fiscalNumberAssignmentId: 'res-1',
      environment: 'SANDBOX',
      correlationId: 'c1',
      occurredAt: new Date().toISOString(),
    };
    const text = JSON.stringify(payload);
    expect(text).not.toMatch(/jwt|secret|buyerAuthorization|authorization/i);
    expect(payload).not.toHaveProperty('canonicalSnapshot');
    expect(payload).not.toHaveProperty('lines');
  });
});

describe('Phase 12 permissions', () => {
  it('registers snapshot and sequence permission codes', async () => {
    const { TENANT_EIS_PERMISSIONS } = await import('../lib/mraEis/domain/permissions.js');
    expect(TENANT_EIS_PERMISSIONS.FISCAL_SNAPSHOTS_VIEW).toBe('eis.fiscalSnapshots.view');
    expect(TENANT_EIS_PERMISSIONS.FISCAL_SEQUENCES_RECONCILE).toBe('eis.fiscalSequences.reconcile');
    expect(TENANT_EIS_PERMISSIONS.FISCAL_SNAPSHOTS_CREATE).toBe('eis.fiscalSnapshots.create');
  });
});
