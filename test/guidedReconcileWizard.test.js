import { afterEach, describe, expect, it, vi } from 'vitest';
import { OPEN_RECON_STATUSES } from '../lib/bankReconciliation/domain/enums.js';
import {
  GUIDED_IMPORT_ACCEPT,
  WIZARD_STEPS,
  assertAllowedGuidedStatementFile,
  buildConfirmImportFormData,
  buildCreateReconciliationBody,
  buildPreviewImportFormData,
  acceptSuggestedMatch,
  autoMatchReconciliation,
  buildManualMatchBody,
  canConfirmGuidedImportPreview,
  canPostManualMatch,
  confirmStatementImport,
  createReconciliation,
  findOpenReconciliation,
  isAllowedGuidedStatementFile,
  listMatchCandidates,
  listReconciliations,
  manualMatchAmountError,
  postManualMatch,
  previewStatementImport,
  reconFetch,
  rejectSuggestedMatch,
  selectedBookSumMinor,
  statementBankAbsMinor,
} from '../components/payments/reconcile/reconApi.js';

function fakeStatementFile(name) {
  return new File(['Date,Description,Amount\n2026-08-01,Deposit,100.00\n'], name, { type: 'text/csv' });
}

describe('guided reconcile statement helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('finds the first open reconciliation and ignores completed ones', () => {
    expect([...OPEN_RECON_STATUSES]).toEqual([
      'DRAFT',
      'IN_PROGRESS',
      'IN_REVIEW',
      'APPROVED',
      'REOPENED',
    ]);

    const open = findOpenReconciliation({
      reconciliations: [
        { id: 'done', status: 'COMPLETED' },
        { id: 'draft-1', status: 'DRAFT' },
        { id: 'progress', status: 'IN_PROGRESS' },
      ],
    });
    expect(open?.id).toBe('draft-1');
    expect(findOpenReconciliation({ reconciliations: [{ id: 'x', status: 'REVERSED' }] })).toBeNull();
  });

  it('builds create payload with statementDate from period end', () => {
    expect(
      buildCreateReconciliationBody({
        paymentAccountId: 'pa-1',
        periodStart: '2026-08-01',
        periodEnd: '2026-08-31',
        statementOpeningBalance: '100.50',
        statementClosingBalance: '250.00',
      })
    ).toEqual({
      paymentAccountId: 'pa-1',
      statementDate: '2026-08-31',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      statementOpeningBalance: 100.5,
      statementClosingBalance: 250,
    });
  });

  it('reconFetch throws the API message when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 422,
        json: async () => ({ message: 'An open reconciliation already exists for this account.' }),
      }))
    );

    await expect(reconFetch('/api/bank-reconciliation/reconciliations')).rejects.toThrow(
      'An open reconciliation already exists for this account.'
    );
  });

  it('lists and creates reconciliations through the Phase 10 APIs', async () => {
    const fetchMock = vi.fn(async (url, options = {}) => ({
      ok: true,
      status: options.method === 'POST' ? 201 : 200,
      json: async () =>
        options.method === 'POST'
          ? { reconciliation: { id: 'rec-new' } }
          : { reconciliations: [] },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await listReconciliations('pa 1');
    const created = await createReconciliation({
      paymentAccountId: 'pa-1',
      statementDate: '2026-08-31',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      statementOpeningBalance: 10,
      statementClosingBalance: 20,
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/bank-reconciliation/reconciliations?paymentAccountId=pa%201'
    );
    expect(fetchMock.mock.calls[1][0]).toBe('/api/bank-reconciliation/reconciliations');
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).statementDate).toBe('2026-08-31');
    expect(created.reconciliation.id).toBe('rec-new');
  });
});

describe('guided reconcile CSV/Excel import helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('accepts only csv/xlsx/xls and rejects OFX', () => {
    expect(GUIDED_IMPORT_ACCEPT).toBe('.csv,.xlsx,.xls');
    expect(isAllowedGuidedStatementFile('stmt.csv')).toBe(true);
    expect(isAllowedGuidedStatementFile('STMT.XLSX')).toBe(true);
    expect(isAllowedGuidedStatementFile('legacy.xls')).toBe(true);
    expect(isAllowedGuidedStatementFile('download.ofx')).toBe(false);
    expect(isAllowedGuidedStatementFile('download.qfx')).toBe(false);
    expect(() => assertAllowedGuidedStatementFile('bank.ofx')).toThrow(/OFX/i);
  });

  it('builds multipart preview FormData with file, account, and statement balances', () => {
    const file = fakeStatementFile('august.csv');
    const form = buildPreviewImportFormData({
      file,
      paymentAccountId: 'pa-1',
      statementOpening: '10.00',
      statementClosing: '90.00',
    });
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('paymentAccountId')).toBe('pa-1');
    expect(form.get('statementOpening')).toBe('10.00');
    expect(form.get('statementClosing')).toBe('90.00');
    expect(form.get('file')).toBeTruthy();
    expect(form.get('profileId')).toBeNull();
  });

  it('builds multipart confirm FormData with batchId, file, and reconciliationId', () => {
    const file = fakeStatementFile('august.csv');
    const form = buildConfirmImportFormData({
      file,
      batchId: 'batch-1',
      reconciliationId: 'rec-1',
    });
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('batchId')).toBe('batch-1');
    expect(form.get('reconciliationId')).toBe('rec-1');
    expect(form.get('file')).toBeTruthy();
  });

  it('posts preview and confirm to the Phase 10 import endpoints without JSON bodies', async () => {
    const file = fakeStatementFile('august.csv');
    const fetchMock = vi.fn(async (url) => ({
      ok: true,
      status: 200,
      json: async () =>
        url.endsWith('/preview')
          ? { batch: { id: 'batch-1' }, previewRows: [], totalRows: 1, duplicateRowCount: 0 }
          : { batch: { id: 'batch-1' }, created: 1, skippedDuplicates: 0 },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const previewed = await previewStatementImport(
      buildPreviewImportFormData({ file, paymentAccountId: 'pa-1' })
    );
    const confirmed = await confirmStatementImport(
      buildConfirmImportFormData({ file, batchId: 'batch-1', reconciliationId: 'rec-1' })
    );

    expect(fetchMock.mock.calls[0][0]).toBe('/api/bank-reconciliation/import/preview');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(fetchMock.mock.calls[0][1].body).toBeInstanceOf(FormData);
    expect(fetchMock.mock.calls[0][1].headers?.['Content-Type']).toBeUndefined();
    expect(previewed.batch.id).toBe('batch-1');

    expect(fetchMock.mock.calls[1][0]).toBe('/api/bank-reconciliation/import/confirm');
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
    expect(fetchMock.mock.calls[1][1].body).toBeInstanceOf(FormData);
    expect(fetchMock.mock.calls[1][1].headers?.['Content-Type']).toBeUndefined();
    expect(confirmed.created).toBe(1);
  });

  it('places Match immediately after Import in the wizard', () => {
    expect(WIZARD_STEPS).toEqual(['statement', 'import', 'match', 'resolve', 'complete']);
    expect(WIZARD_STEPS.indexOf('match')).toBe(2);
  });

  it('allows confirm only when preview has rows, batch id, and file', () => {
    const file = fakeStatementFile('august.csv');
    const withRows = { batch: { id: 'batch-1' }, totalRows: 3 };
    const empty = { batch: { id: 'batch-1' }, totalRows: 0 };
    const noBatch = { totalRows: 5 };

    expect(canConfirmGuidedImportPreview(withRows, file)).toBe(true);
    expect(canConfirmGuidedImportPreview(empty, file)).toBe(false);
    expect(canConfirmGuidedImportPreview(noBatch, file)).toBe(false);
    expect(canConfirmGuidedImportPreview(withRows, null)).toBe(false);
    expect(canConfirmGuidedImportPreview(null, file)).toBe(false);
  });
});

describe('guided reconcile match amount helpers', () => {
  const bank = { id: 'stmt-1', signedAmountMinor: -15000 };
  const booksEqual = [
    { journalEntryLineId: 'jel-1', remainingAmountMinor: -9000 },
    { journalEntryLineId: 'jel-2', remainingAmountMinor: -6000 },
  ];
  const booksShort = [{ journalEntryLineId: 'jel-1', remainingAmountMinor: -10000 }];
  const outstandingBooks = [
    { journalEntryLineId: 'jel-1', amountMinor: 8000 },
    { journalEntryLineId: 'jel-2', amountMinor: 7000 },
  ];

  it('sums selected book amounts as magnitudes and compares to abs(bank.signedAmountMinor)', () => {
    expect(statementBankAbsMinor(bank)).toBe(15000);
    expect(selectedBookSumMinor(booksEqual)).toBe(15000);
    expect(selectedBookSumMinor(outstandingBooks)).toBe(15000);
    expect(canPostManualMatch(bank, booksEqual)).toBe(true);
    expect(canPostManualMatch(bank, outstandingBooks)).toBe(true);
    expect(canPostManualMatch(bank, booksShort)).toBe(false);
    expect(canPostManualMatch(bank, [])).toBe(false);
    expect(canPostManualMatch(null, booksEqual)).toBe(false);
  });

  it('formats a mismatch error with both bank and book totals', () => {
    const message = manualMatchAmountError(bank, booksShort);
    expect(message).toMatch(/150\.00/);
    expect(message).toMatch(/100\.00/);
    expect(message.toLowerCase()).toMatch(/do not match/);
  });

  it('builds a 1:N manual match body with statementIds and bookLinks', () => {
    expect(
      buildManualMatchBody({
        reconciliationId: 'rec-1',
        statement: bank,
        books: booksEqual,
        notes: 'split deposit',
      })
    ).toEqual({
      reconciliationId: 'rec-1',
      statementIds: ['stmt-1'],
      bookLinks: [
        { journalEntryLineId: 'jel-1', amountMinor: -9000, allocatedAmountMinor: -9000 },
        { journalEntryLineId: 'jel-2', amountMinor: -6000, allocatedAmountMinor: -6000 },
      ],
      notes: 'split deposit',
    });
  });
});

describe('guided reconcile match API helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts auto-match with an empty JSON body then can refresh via workspace GET', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ matchesCreated: 2, suggestions: 2 }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await autoMatchReconciliation('rec 1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/bank-reconciliation/reconciliations/rec%201/auto-match'
    );
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(fetchMock.mock.calls[0][1].headers['Content-Type']).toBe('application/json');
    expect(fetchMock.mock.calls[0][1].body).toBe('{}');
    expect(result.matchesCreated).toBe(2);
  });

  it('lists book candidates with paymentAccountId (API required) and optional dates', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ journalEntryLineId: 'jel-1' }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const data = await listMatchCandidates({
      paymentAccountId: 'pa 1',
      reconciliationId: 'rec-1',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });

    expect(fetchMock.mock.calls[0][0]).toContain('/api/bank-reconciliation/candidates?');
    expect(fetchMock.mock.calls[0][0]).toContain('paymentAccountId=pa%201');
    expect(fetchMock.mock.calls[0][0]).toContain('reconciliationId=rec-1');
    expect(fetchMock.mock.calls[0][0]).toContain('startDate=2026-08-01');
    expect(fetchMock.mock.calls[0][0]).toContain('endDate=2026-08-31');
    expect(data.candidates[0].journalEntryLineId).toBe('jel-1');
  });

  it('posts manual match and accept/reject actions', async () => {
    const fetchMock = vi.fn(async (url) => ({
      ok: true,
      status: url.includes('/matches/') ? 200 : 201,
      json: async () => ({ match: { id: 'm-1' } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await postManualMatch({
      reconciliationId: 'rec-1',
      statementIds: ['stmt-1'],
      bookLinks: [{ journalEntryLineId: 'jel-1', amountMinor: 100 }],
    });
    await acceptSuggestedMatch('m-1');
    await rejectSuggestedMatch('m-1');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/bank-reconciliation/matches');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).statementIds).toEqual(['stmt-1']);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/bank-reconciliation/matches/m-1/accept');
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
    expect(fetchMock.mock.calls[2][0]).toBe('/api/bank-reconciliation/matches/m-1/reject');
  });
});
