import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/equityManagement/application/mappingService.js', () => ({
  resolveEquityAccountByPurpose: vi.fn(),
}));

import { AccountingValidationError } from '../lib/accountingV2/domain/errors.js';
import { resolveEquityAccountByPurpose } from '../lib/equityManagement/application/mappingService.js';
import { SYSTEM_ACCOUNT_PURPOSES } from '../lib/coaV2/domain/systemPurposes.js';
import {
  POS_TILL_FLOAT_GL_CODE,
  POS_TILL_FLOAT_PA_NAME,
  POS_TILL_FLOAT_REFERENCE,
  ensurePosTillFloatPaymentAccount,
  resolveOwnerCapitalCoaAccount,
} from '../lib/posTillFloatAccounts.js';

function makeClient() {
  return {
    account: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    paymentAccount: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe('posTillFloatAccounts constants', () => {
  it('registers POS_TILL_FLOAT purpose on 1112', () => {
    expect(SYSTEM_ACCOUNT_PURPOSES.POS_TILL_FLOAT.legacyCode).toBe('1112');
    expect(POS_TILL_FLOAT_GL_CODE).toBe('1112');
    expect(POS_TILL_FLOAT_PA_NAME).toBe('Till Float');
    expect(POS_TILL_FLOAT_REFERENCE).toBe('POS_TILL_FLOAT');
  });
});

describe('ensurePosTillFloatPaymentAccount', () => {
  it('creates a dedicated 1112 till float leaf and payment account', async () => {
    const client = makeClient();
    const mainCash = { id: 'cash-1110', accountCode: '1110', code: '1110' };
    const tillLeaf = { id: 'till-1112', accountCode: '1112', code: '1112', parentAccountId: 'cash-1110' };
    const createdPaymentAccount = { id: 'pa-1', coaAccountId: 'till-1112' };

    client.account.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mainCash)
      .mockResolvedValueOnce({ id: 'asset-1100' });
    client.account.create.mockResolvedValueOnce(tillLeaf);
    client.paymentAccount.findFirst.mockResolvedValueOnce(null);
    client.paymentAccount.create.mockResolvedValueOnce(createdPaymentAccount);

    const result = await ensurePosTillFloatPaymentAccount('tenant-1', client);

    expect(client.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          accountCode: '1112',
          code: '1112',
          accountName: 'Till / Cash Float',
          name: 'Till / Cash Float',
          parentAccountId: 'cash-1110',
          isSystem: true,
          systemPurpose: 'POS_TILL_FLOAT',
          postingAllowed: true,
        }),
      })
    );
    expect(client.paymentAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        name: 'Till Float',
        accountType: 'Cash',
        reference: 'POS_TILL_FLOAT',
        isSystem: true,
        isActive: true,
        coaAccountId: 'till-1112',
      }),
    });
    expect(result).toBe(createdPaymentAccount);
  });

  it('repairs an existing till-float payment account linked to cash main 1110', async () => {
    const client = makeClient();
    const tillLeaf = {
      id: 'till-1112',
      accountCode: '1112',
      code: '1112',
      accountName: 'Till / Cash Float',
      name: 'Till / Cash Float',
      accountType: 'Asset',
      type: 'ASSET',
      accountSubtype: 'Current Asset',
      normalBalance: 'Debit',
      isSystem: true,
      isActive: true,
      acceptsNewTransactions: true,
      postingAllowed: true,
      visibleInChart: true,
      systemPurpose: 'POS_TILL_FLOAT',
    };
    const existing = { id: 'pa-1', tenantId: 'tenant-1', coaAccountId: 'cash-1110' };
    const repaired = { ...existing, coaAccountId: 'till-1112' };

    client.account.findFirst.mockResolvedValueOnce(tillLeaf);
    client.paymentAccount.findFirst.mockResolvedValueOnce(existing);
    client.paymentAccount.update.mockResolvedValueOnce(repaired);

    const result = await ensurePosTillFloatPaymentAccount('tenant-1', client);

    expect(client.paymentAccount.update).toHaveBeenCalledWith({
      where: { id: 'pa-1' },
      data: expect.objectContaining({
        coaAccountId: 'till-1112',
        isActive: true,
        isSystem: true,
        name: 'Till Float',
        accountType: 'Cash',
        reference: 'POS_TILL_FLOAT',
      }),
    });
    expect(result).toEqual(repaired);
  });
});

describe('resolveOwnerCapitalCoaAccount', () => {
  beforeEach(() => {
    vi.mocked(resolveEquityAccountByPurpose).mockReset();
  });

  it('returns the mapped equity account when available', async () => {
    const client = makeClient();
    const capital = { id: 'capital-1' };
    vi.mocked(resolveEquityAccountByPurpose).mockResolvedValueOnce(capital);

    await expect(resolveOwnerCapitalCoaAccount('tenant-1', client)).resolves.toBe(capital);
    expect(resolveEquityAccountByPurpose).toHaveBeenCalledWith(client, 'tenant-1', 'OWNER_CAPITAL');
  });

  it('returns null when owner capital is not mapped', async () => {
    const client = makeClient();
    vi.mocked(resolveEquityAccountByPurpose).mockRejectedValueOnce(
      new AccountingValidationError('Missing equity account mapping for purpose OWNER_CAPITAL.', [
        { path: 'purpose', message: 'OWNER_CAPITAL' },
      ])
    );

    await expect(resolveOwnerCapitalCoaAccount('tenant-1', client)).resolves.toBeNull();
  });

  it('rethrows non-missing-mapping errors', async () => {
    const client = makeClient();
    const dbError = new Error('connection refused');
    vi.mocked(resolveEquityAccountByPurpose).mockRejectedValueOnce(dbError);

    await expect(resolveOwnerCapitalCoaAccount('tenant-1', client)).rejects.toBe(dbError);
  });

  it('rethrows validation errors that are not a missing owner-capital mapping', async () => {
    const client = makeClient();
    const headerError = new AccountingValidationError('Mapped equity account must be a posting account.', [
      { path: 'accountId', message: 'acct-1' },
    ]);
    vi.mocked(resolveEquityAccountByPurpose).mockRejectedValueOnce(headerError);

    await expect(resolveOwnerCapitalCoaAccount('tenant-1', client)).rejects.toBe(headerError);
  });
});
