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
  bookCandidateAmountMinor,
  buildManualMatchBody,
  canAttemptManualMatch,
  canConfirmGuidedImportPreview,
  canPostManualMatch,
  confirmStatementImport,
  createReconciliation,
  findOpenReconciliation,
  isAllowedGuidedStatementFile,
  isStatementSelectable,
  listMatchCandidates,
  listReconciliations,
  manualMatchAmountError,
  postManualMatch,
  previewStatementImport,
  reconFetch,
  rejectSuggestedMatch,
  selectedBookSumMinor,
  statementBankAbsMinor,
  buildAdjustBody,
  canCreateTransactionForStatement,
  classificationForResolveType,
  historyActionLabel,
  historyHrefForReconciliation,
  historyRowsFromPayload,
  isWizardReadOnly,
  listOffsetAccounts,
  offsetAccountTypeForResolveType,
  postReconAdjustment,
  unmatchedStatementLines,
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

  it('treats SUGGESTED as not selectable so the user accepts or rejects instead', () => {
    expect(isStatementSelectable({ matchingStatus: 'UNMATCHED' })).toBe(true);
    expect(isStatementSelectable({ matchingStatus: 'PARTIAL' })).toBe(true);
    expect(isStatementSelectable({ matchingStatus: 'SUGGESTED' })).toBe(false);
    expect(isStatementSelectable({ matchingStatus: 'MATCHED' })).toBe(false);
    expect(isStatementSelectable({ matchingStatus: 'CLASSIFIED' })).toBe(false);
    expect(isStatementSelectable({ matchingStatus: 'EXCLUDED' })).toBe(false);
  });

  it('refuses manual match when the selected statement is not selectable', () => {
    const unmatched = { id: 'stmt-1', matchingStatus: 'UNMATCHED', signedAmountMinor: -15000 };
    const suggested = { ...unmatched, matchingStatus: 'SUGGESTED' };
    expect(canAttemptManualMatch(suggested, booksEqual)).toBe(false);
    expect(canAttemptManualMatch(unmatched, booksEqual)).toBe(true);
    expect(canAttemptManualMatch(unmatched, booksShort)).toBe(false);
  });

  it('signs outstanding fallback amounts from remainingAmountMinor, itemType, or bank sign', () => {
    expect(
      bookCandidateAmountMinor({
        remainingAmountMinor: -9000,
        amountMinor: 9000,
        itemType: 'OUTSTANDING_PAYMENT',
      })
    ).toBe(-9000);
    expect(bookCandidateAmountMinor({ amountMinor: 8000, itemType: 'OUTSTANDING_PAYMENT' })).toBe(-8000);
    expect(bookCandidateAmountMinor({ amountMinor: 7000, itemType: 'DEPOSIT_IN_TRANSIT' })).toBe(7000);
    expect(bookCandidateAmountMinor({ amountMinor: 5000, itemType: 'OTHER' }, bank)).toBe(-5000);
    expect(bookCandidateAmountMinor({ amountMinor: 4000 }, { signedAmountMinor: 12000 })).toBe(4000);
  });

  it('builds signed bookLinks from outstanding itemType when remainingAmountMinor is absent', () => {
    expect(
      buildManualMatchBody({
        reconciliationId: 'rec-1',
        statement: bank,
        books: outstandingBooks.map((row) => ({ ...row, itemType: 'OUTSTANDING_PAYMENT' })),
      })
    ).toEqual({
      reconciliationId: 'rec-1',
      statementIds: ['stmt-1'],
      bookLinks: [
        { journalEntryLineId: 'jel-1', amountMinor: -8000, allocatedAmountMinor: -8000 },
        { journalEntryLineId: 'jel-2', amountMinor: -7000, allocatedAmountMinor: -7000 },
      ],
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

describe('guided reconcile resolve helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('maps Expense to BANK_CHARGE and Money in to INTEREST with expense vs income CoA types', () => {
    expect(classificationForResolveType('EXPENSE')).toBe('BANK_CHARGE');
    expect(classificationForResolveType('MONEY_IN')).toBe('INTEREST');
    expect(offsetAccountTypeForResolveType('EXPENSE')).toBe('Expense');
    expect(offsetAccountTypeForResolveType('MONEY_IN')).toBe('Income');
  });

  it('builds adjust body with postAdjustment true and statement description default', () => {
    const statement = {
      id: 'stmt-9',
      description: 'Bank fee August',
      matchingStatus: 'UNMATCHED',
    };
    expect(
      buildAdjustBody({
        reconciliationId: 'rec-1',
        statement,
        resolveType: 'EXPENSE',
        offsetAccountId: 'acc-exp',
      })
    ).toEqual({
      reconciliationId: 'rec-1',
      statementTransactionId: 'stmt-9',
      classification: 'BANK_CHARGE',
      postAdjustment: true,
      offsetAccountId: 'acc-exp',
      description: 'Bank fee August',
    });
    expect(
      buildAdjustBody({
        reconciliationId: 'rec-1',
        statement,
        resolveType: 'MONEY_IN',
        offsetAccountId: 'acc-inc',
        description: 'Interest received',
      }).classification
    ).toBe('INTEREST');
  });

  it('offers Create Transaction only for fully unmatched bank lines', () => {
    const rows = [
      { id: 'a', matchingStatus: 'UNMATCHED' },
      { id: 'b', matchingStatus: 'PARTIAL' },
      { id: 'c', matchingStatus: 'MATCHED' },
      { id: 'd', matchingStatus: 'CLASSIFIED' },
      { id: 'e', matchingStatus: 'SUGGESTED' },
    ];
    expect(canCreateTransactionForStatement(rows[0])).toBe(true);
    expect(canCreateTransactionForStatement(rows[1])).toBe(false);
    expect(canCreateTransactionForStatement(rows[2])).toBe(false);
    expect(canCreateTransactionForStatement(rows[3])).toBe(false);
    expect(canCreateTransactionForStatement(rows[4])).toBe(false);
    expect(unmatchedStatementLines(rows).map((row) => row.id)).toEqual(['a']);
  });

  it('lists offset CoA accounts by type and posts adjust then can refresh workspace', async () => {
    const fetchMock = vi.fn(async (url) => ({
      ok: true,
      status: url.includes('/adjust') ? 201 : 200,
      json: async () =>
        url.includes('/accounts')
          ? { accounts: [{ id: 'acc-exp', accountCode: '5500', accountName: 'Bank Charges' }] }
          : { posted: { journalEntryId: 'je-1' } },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const listed = await listOffsetAccounts('Expense');
    await postReconAdjustment(
      buildAdjustBody({
        reconciliationId: 'rec-1',
        statement: { id: 'stmt-1', description: 'Fee' },
        resolveType: 'EXPENSE',
        offsetAccountId: 'acc-exp',
      })
    );

    expect(fetchMock.mock.calls[0][0]).toBe('/api/accounts?forSelect=true&type=Expense');
    expect(listed.accounts[0].id).toBe('acc-exp');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/bank-reconciliation/adjust');
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      reconciliationId: 'rec-1',
      statementTransactionId: 'stmt-1',
      classification: 'BANK_CHARGE',
      postAdjustment: true,
      offsetAccountId: 'acc-exp',
      description: 'Fee',
    });
  });
});

describe('guided reconcile history helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('lists hub history without an account filter and account history with paymentAccountId', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ reconciliations: [] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await listReconciliations();
    await listReconciliations('pa-1');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/bank-reconciliation/reconciliations');
    expect(fetchMock.mock.calls[1][0]).toBe(
      '/api/bank-reconciliation/reconciliations?paymentAccountId=pa-1'
    );
  });

  it('maps open and completed recs and skips reversed', () => {
    const rows = historyRowsFromPayload({
      reconciliations: [
        {
          id: 'done-1',
          paymentAccountId: 'pa-1',
          status: 'COMPLETED',
          periodStart: '2026-07-01T00:00:00.000Z',
          periodEnd: '2026-07-31T00:00:00.000Z',
          statementClosingBalance: '1500.00',
          differenceMinor: 0,
          completedBy: 'user-9',
          completedAt: '2026-08-01T09:30:00.000Z',
        },
        {
          id: 'draft-1',
          paymentAccountId: 'pa-1',
          status: 'DRAFT',
          periodStart: '2026-08-01',
          periodEnd: '2026-08-31',
          statementClosingBalance: 250,
          differenceMinor: 1250,
          completedBy: null,
          completedAt: null,
        },
        {
          id: 'rev-1',
          paymentAccountId: 'pa-1',
          status: 'REVERSED',
          periodEnd: '2026-06-30',
          statementClosingBalance: '10.00',
          differenceMinor: 0,
        },
      ],
    });

    expect(rows.map((row) => row.id)).toEqual(['done-1', 'draft-1']);
    expect(rows[0]).toMatchObject({
      period: '2026-07-01 – 2026-07-31',
      closing: '1500.00',
      difference: '0.00',
      status: 'Reconciled',
      completedBy: 'user-9',
      completedAt: '2026-08-01',
      actionLabel: 'View',
      href: '/payments/reconcile/pa-1?id=done-1',
      readOnly: true,
    });
    expect(rows[1]).toMatchObject({
      period: '2026-08-01 – 2026-08-31',
      closing: '250',
      difference: '12.50',
      status: 'DRAFT',
      completedBy: '—',
      completedAt: '—',
      actionLabel: 'Continue',
      href: '/payments/reconcile/pa-1?id=draft-1',
      readOnly: false,
    });
  });

  it('builds Continue/View hrefs and locks only completed wizard workspaces', () => {
    expect(
      historyHrefForReconciliation({ id: 'rec 1', paymentAccountId: 'pa 2' })
    ).toBe('/payments/reconcile/pa%202?id=rec%201');
    expect(historyActionLabel({ status: 'COMPLETED' })).toBe('View');
    expect(historyActionLabel({ status: 'IN_PROGRESS' })).toBe('Continue');
    expect(isWizardReadOnly({ reconciliation: { status: 'COMPLETED' } })).toBe(true);
    expect(isWizardReadOnly({ reconciliation: { status: 'DRAFT' } })).toBe(false);
    expect(isWizardReadOnly({ status: 'COMPLETED' })).toBe(true);
  });
});
