import { afterEach, describe, expect, it, vi } from 'vitest';
import { OPEN_RECON_STATUSES } from '../lib/bankReconciliation/domain/enums.js';
import {
  buildCreateReconciliationBody,
  createReconciliation,
  findOpenReconciliation,
  listReconciliations,
  reconFetch,
} from '../components/payments/reconcile/reconApi.js';

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
