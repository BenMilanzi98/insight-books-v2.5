import { accountBlocksDirectPosting } from './coaDirectPostingEligibility.js';

export const SALARY_ADVANCE_RECEIVABLE_CODE = '1216';

/**
 * @param {{ accountCode?: string|null, code?: string|null, accountName?: string|null, name?: string|null }|null} account
 * @returns {string}
 */
export function salaryAdvanceReceivableCoaLabel(account) {
  const code = String(account?.accountCode ?? account?.code ?? SALARY_ADVANCE_RECEIVABLE_CODE).trim();
  const name = String(account?.accountName ?? account?.name ?? 'Salary Advance Receivable').trim();
  return `${code} - ${name}`;
}

const ADVANCE_NAME_FILTER = [
  { accountName: { contains: 'Salary Advance Receivable', mode: 'insensitive' } },
  { accountName: { contains: 'Advance Salary Receivable', mode: 'insensitive' } },
  { accountName: { contains: 'Employee Advance Receivable', mode: 'insensitive' } },
  { name: { contains: 'Salary Advance Receivable', mode: 'insensitive' } },
  { name: { contains: 'Employee Advance Receivable', mode: 'insensitive' } },
];

const accountSelect = {
  id: true,
  tenantId: true,
  accountCode: true,
  code: true,
  accountName: true,
  name: true,
  accountType: true,
  type: true,
  accountSubtype: true,
  normalBalance: true,
  balance: true,
  isActive: true,
  acceptsNewTransactions: true,
  visibleInChart: true,
  parentAccountId: true,
  _count: {
    select: {
      childAccounts: { where: { isActive: true } },
    },
  },
};

function isUsableAdvanceAccount(account) {
  if (!account || account.isActive === false) return false;
  if ((account.accountType || account.type) !== 'Asset') return false;
  const code = String(account.accountCode ?? account.code ?? '').trim();
  if (code === '1300') return false;
  return !accountBlocksDirectPosting(account).blocked;
}

async function findCurrentAssetsParentId(tenantId, tx) {
  const parent = await tx.account.findFirst({
    where: {
      tenantId,
      accountCode: '1100',
      accountType: 'Asset',
      isActive: true,
    },
    select: { id: true },
  });
  return parent?.id ?? null;
}

/**
 * Resolve a posting-leaf asset account for employee salary advances.
 * Avoids 1300, which is the Inventory branch in the canonical chart.
 */
/**
 * Ensure the 1216 Salary Advance Receivable CoA row exists and is chart-visible.
 * Alias of resolve for call sites that create-on-demand.
 */
export async function ensureSalaryAdvanceReceivableCoaRow(tenantId, tx) {
  const account = await resolveSalaryAdvanceReceivableAccount(tenantId, tx);
  if (account.visibleInChart === false || account.acceptsNewTransactions === false) {
    return tx.account.update({
      where: { id: account.id },
      data: {
        visibleInChart: true,
        acceptsNewTransactions: true,
        isActive: true,
      },
      select: accountSelect,
    });
  }
  return account;
}

export async function resolveSalaryAdvanceReceivableAccount(tenantId, tx) {
  if (!tenantId) throw new Error('Tenant ID is required for salary advance account resolution.');

  const existingByCode = await tx.account.findFirst({
    where: {
      tenantId,
      accountCode: SALARY_ADVANCE_RECEIVABLE_CODE,
      accountType: 'Asset',
      isActive: true,
    },
    select: accountSelect,
  });
  if (isUsableAdvanceAccount(existingByCode)) return existingByCode;

  const namedCandidates = await tx.account.findMany({
    where: {
      tenantId,
      accountType: 'Asset',
      isActive: true,
      OR: ADVANCE_NAME_FILTER,
    },
    select: accountSelect,
    orderBy: [{ accountCode: 'asc' }],
  });
  const namedUsable = namedCandidates.find(isUsableAdvanceAccount);
  if (namedUsable) return namedUsable;

  const parentAccountId = await findCurrentAssetsParentId(tenantId, tx);
  try {
    return await tx.account.create({
      data: {
        tenantId,
        accountCode: SALARY_ADVANCE_RECEIVABLE_CODE,
        code: SALARY_ADVANCE_RECEIVABLE_CODE,
        accountName: 'Salary Advance Receivable',
        name: 'Salary Advance Receivable',
        accountType: 'Asset',
        type: 'ASSET',
        accountSubtype: 'Current Asset',
        normalBalance: 'Debit',
        balance: 0,
        isActive: true,
        acceptsNewTransactions: true,
        visibleInChart: true,
        ...(parentAccountId ? { parentAccountId } : {}),
        description: 'Asset account for tracking salary advances given to employees.',
      },
    });
  } catch (error) {
    if (error?.code !== 'P2002') throw error;
    const retry = await tx.account.findFirst({
      where: {
        tenantId,
        accountCode: SALARY_ADVANCE_RECEIVABLE_CODE,
        accountType: 'Asset',
        isActive: true,
      },
      select: accountSelect,
    });
    if (isUsableAdvanceAccount(retry)) return retry;
    throw new Error(
      `Salary Advance Receivable account ${SALARY_ADVANCE_RECEIVABLE_CODE} exists but cannot receive postings. Use an active detail Asset account.`,
    );
  }
}
