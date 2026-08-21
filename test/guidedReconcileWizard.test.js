import { afterEach, describe, expect, it, vi } from 'vitest';
import { OPEN_RECON_STATUSES } from '../lib/bankReconciliation/domain/enums.js';
import {
  GUIDED_IMPORT_ACCEPT,
  WIZARD_STEPS,
  assertAllowedGuidedStatementFile,
  buildConfirmImportFormData,
  buildCreateReconciliationBody,
  buildPreviewImportFormData,
  canConfirmGuidedImportPreview,
  confirmStatementImport,
  createReconciliation,
  findOpenReconciliation,
  isAllowedGuidedStatementFile,
  listReconciliations,
  previewStatementImport,
  reconFetch,
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
