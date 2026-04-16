/**
 * One-time-safe structural fixes so legacy tenants match the canonical CoA.
 * Runs in two phases from chartOfAccountsInitialization (before / after blueprint).
 */

import prisma from './prisma.js';
import {
  findCurrentLiabilitiesGroupId,
  findLiabilitiesRootId,
  CODE_ACCOUNTS_PAYABLE,
  CODE_CURRENT_LIABILITIES_GROUP,
} from './coaPostingCodes.js';

/** @param {import('@prisma/client').PrismaClient} tx */
function isCurrentLiabilitiesGroupRow(row) {
  if (!row || row.accountCode !== CODE_CURRENT_LIABILITIES_GROUP) return false;
  if (row.accountSubtype === 'Group') return true;
  return /current liabilities/i.test(row.accountName || '');
}

/** @param {import('@prisma/client').PrismaClient} tx */
function looksLikeTradePayables(row) {
  if (!row) return false;
  const n = (row.accountName || '').toLowerCase();
  return /accounts payable|trade payable|supplier/i.test(n);
}

/**
 * Allocate a free numeric code in 5970–5999 for temporary / legacy shells.
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient} tx
 */
async function allocateLegacyExpenseCode(tenantId, tx) {
  const used = new Set(
    (
      await tx.account.findMany({
        where: { tenantId, accountCode: { startsWith: '59' } },
        select: { accountCode: true },
      })
    ).map((r) => r.accountCode),
  );
  for (let n = 5970; n <= 5999; n += 1) {
    const c = String(n);
    if (!used.has(c)) return c;
  }
  return `5999`;
}

/**
 * Pre-blueprint: free codes blocked by legacy rows; AP 2100 → 2110; create Current Liabilities group.
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient} tx
 */
export async function runCanonicalCoaMigrationsPhase1(tenantId, tx = prisma) {
  if (!tenantId) return;

  const row2100 = await tx.account.findFirst({
    where: { tenantId, accountCode: CODE_CURRENT_LIABILITIES_GROUP, isActive: true },
  });

  if (row2100 && !isCurrentLiabilitiesGroupRow(row2100) && looksLikeTradePayables(row2100)) {
    const blocking2110 = await tx.account.findFirst({
      where: { tenantId, accountCode: CODE_ACCOUNTS_PAYABLE, isActive: true },
      select: { id: true },
    });
    if (!blocking2110) {
      await tx.account.update({
        where: { id: row2100.id },
        data: {
          accountCode: CODE_ACCOUNTS_PAYABLE,
          accountName: row2100.accountName?.includes('Accounts')
            ? row2100.accountName
            : 'Accounts Payable',
          isSystem: true,
        },
      });
    }
  }

  let group2100 = await tx.account.findFirst({
    where: { tenantId, accountCode: CODE_CURRENT_LIABILITIES_GROUP, isActive: true },
  });
  if (!group2100 || !isCurrentLiabilitiesGroupRow(group2100)) {
    const rootId = await findLiabilitiesRootId(tenantId, tx);
    if (rootId) {
      const occupant = await tx.account.findFirst({
        where: { tenantId, accountCode: CODE_CURRENT_LIABILITIES_GROUP, isActive: true },
      });
      if (occupant && !isCurrentLiabilitiesGroupRow(occupant)) {
        const tmp = await allocateLegacyExpenseCode(tenantId, tx);
        await tx.account.update({
          where: { id: occupant.id },
          data: { accountCode: tmp, accountName: `${occupant.accountName || 'Account'} (legacy code)` },
        });
      }
      group2100 = await tx.account.create({
        data: {
          tenantId,
          accountCode: CODE_CURRENT_LIABILITIES_GROUP,
          accountName: 'Current Liabilities',
          accountType: 'Liability',
          accountSubtype: 'Group',
          normalBalance: 'Credit',
          parentAccountId: rootId,
          isActive: true,
          isSystem: true,
          balance: 0,
        },
      });
    }
  }

  const liabilityRenames = [
    { from: '2200', to: '2140', name: 'Accrued Expenses' },
    { from: '2300', to: '2160', name: 'Short-term Loans' },
    { from: '2400', to: '2510', name: 'Bank Loans (Long-term)' },
  ];
  for (const { from, to, name } of liabilityRenames) {
    const src = await tx.account.findFirst({ where: { tenantId, accountCode: from, isActive: true } });
    const dst = await tx.account.findFirst({ where: { tenantId, accountCode: to, isActive: true } });
    if (src && !dst) {
      await tx.account.update({
        where: { id: src.id },
        data: { accountCode: to, accountName: name },
      });
    }
  }

  const op5200 = await tx.account.findFirst({
    where: { tenantId, accountCode: '5200', accountType: 'Expense', isActive: true },
  });
  if (op5200) {
    const children = await tx.account.findMany({
      where: { tenantId, parentAccountId: op5200.id, isActive: true },
      select: { id: true, accountCode: true, accountName: true },
    });
    const hasRentChild = children.some(
      (c) =>
        String(c.accountCode) === '5210' &&
        /rent|lease/i.test(c.accountName || ''),
    );
    if (hasRentChild || /operating expenses/i.test(op5200.accountName || '')) {
      const tmp = await allocateLegacyExpenseCode(tenantId, tx);
      await tx.account.update({
        where: { id: op5200.id },
        data: {
          accountCode: tmp,
          accountName: 'Operating Expenses (legacy shell)',
        },
      });
    }
  }

  const sal5190 = await tx.account.findFirst({
    where: { tenantId, accountCode: '5190', accountType: 'Expense', isActive: true },
  });
  if (sal5190) {
    const tmp = await allocateLegacyExpenseCode(tenantId, tx);
    await tx.account.update({
      where: { id: sal5190.id },
      data: { accountCode: tmp, accountName: 'Salaries & Wages (legacy shell)' },
    });
  }

  const rent5210 = await tx.account.findFirst({
    where: { tenantId, accountCode: '5210', accountType: 'Expense', isActive: true },
  });
  if (rent5210 && /rent|lease/i.test(rent5210.accountName || '')) {
    const dst5300 = await tx.account.findFirst({
      where: { tenantId, accountCode: '5300', isActive: true },
    });
    if (!dst5300) {
      await tx.account.update({
        where: { id: rent5210.id },
        data: { accountCode: '5300', accountName: 'Rent & Lease' },
      });
    }
  }

  const svc4200 = await tx.account.findFirst({
    where: { tenantId, accountCode: '4200', accountType: 'Income', isActive: true },
  });
  const svc4150 = await tx.account.findFirst({
    where: { tenantId, accountCode: '4150', accountType: 'Income', isActive: true },
  });
  if (svc4200 && !svc4150) {
    await tx.account.update({
      where: { id: svc4200.id },
      data: { accountCode: '4150', accountName: 'Service Revenue' },
    });
  }
}

/**
 * Post-blueprint: reparent statutory + AP under 2100; salary children under 5200; bank subs under 1120.
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient} tx
 */
export async function runCanonicalCoaMigrationsPhase2(tenantId, tx = prisma) {
  if (!tenantId) return;

  const groupId = await findCurrentLiabilitiesGroupId(tenantId, tx);
  if (groupId) {
    const codesUnderCurrent = [
      CODE_ACCOUNTS_PAYABLE,
      '2120',
      '2130',
      '2140',
      '2150',
      '2160',
      '2041',
      '2045',
    ];
    for (const code of codesUnderCurrent) {
      const acc = await tx.account.findFirst({
        where: { tenantId, accountCode: code, isActive: true },
        select: { id: true, parentAccountId: true },
      });
      if (acc && acc.parentAccountId !== groupId) {
        await tx.account.update({ where: { id: acc.id }, data: { parentAccountId: groupId } });
      }
    }
  }

  const salaries5200 = await tx.account.findFirst({
    where: { tenantId, accountCode: '5200', accountType: 'Expense', isActive: true },
    select: { id: true, accountName: true },
  });
  if (salaries5200 && /salaries|wages/i.test(salaries5200.accountName || '')) {
    for (const code of ['5201', '5202', '5203', '5210', '5215']) {
      const child = await tx.account.findFirst({
        where: { tenantId, accountCode: code, accountType: 'Expense', isActive: true },
        select: { id: true, parentAccountId: true },
      });
      if (child && child.parentAccountId !== salaries5200.id) {
        await tx.account.update({
          where: { id: child.id },
          data: { parentAccountId: salaries5200.id },
        });
      }
    }
    const paye5215 = await tx.account.findFirst({
      where: { tenantId, accountCode: '5215', accountType: 'Expense', isActive: true },
    });
    const paye5210 = await tx.account.findFirst({
      where: { tenantId, accountCode: '5210', accountType: 'Expense', isActive: true },
    });
    if (paye5215 && !paye5210) {
      await tx.account.update({
        where: { id: paye5215.id },
        data: { accountCode: '5210', accountName: 'Employer PAYE & Contributions' },
      });
    }
  }

  const parent1120 = await tx.account.findFirst({
    where: { tenantId, accountCode: '1120', accountType: 'Asset', isActive: true },
    select: { id: true },
  });
  const old1130 = await tx.account.findFirst({
    where: { tenantId, accountCode: '1130', accountType: 'Asset', isActive: true },
    select: { id: true },
  });
  if (parent1120 && old1130) {
    const bankChildren = await tx.account.findMany({
      where: { tenantId, parentAccountId: old1130.id, isActive: true },
    });
    let seq = 1;
    for (const ch of bankChildren) {
      let newCode = ch.accountCode;
      if (/^\d{6}$/.test(String(ch.accountCode))) {
        newCode = `1130-${String(seq).padStart(2, '0')}`;
        seq += 1;
        const clash = await tx.account.findFirst({
          where: { tenantId, accountCode: newCode, NOT: { id: ch.id } },
        });
        if (!clash) {
          await tx.account.update({
            where: { id: ch.id },
            data: { accountCode: newCode, parentAccountId: parent1120.id },
          });
        } else {
          await tx.account.update({
            where: { id: ch.id },
            data: { parentAccountId: parent1120.id },
          });
        }
      } else {
        await tx.account.update({
          where: { id: ch.id },
          data: { parentAccountId: parent1120.id },
        });
      }
    }
    const linesOn1130 = (await tx.journalEntryLine.count({ where: { accountId: old1130.id } }))
      + (await tx.transactionLine.count({ where: { accountId: old1130.id } }));
    if (linesOn1130 === 0 && bankChildren.length === 0) {
      await tx.account.update({
        where: { id: old1130.id },
        data: { isActive: false },
      });
    }
  }

  await tx.account.updateMany({
    where: { tenantId, accountCode: '3300' },
    data: { accountName: 'Current Year Earnings' },
  });

  const cos5100 = await tx.account.findFirst({
    where: { tenantId, accountCode: '5100', accountType: 'Expense', isActive: true },
    select: { id: true },
  });
  if (cos5100) {
    for (const code of ['5110', '5120', '5130', '5140']) {
      const line = await tx.account.findFirst({
        where: { tenantId, accountCode: code, accountType: 'Expense', isActive: true },
        select: { id: true, parentAccountId: true },
      });
      if (line && line.parentAccountId !== cos5100.id) {
        await tx.account.update({
          where: { id: line.id },
          data: { parentAccountId: cos5100.id },
        });
      }
    }
  }

  const rootExpense = await tx.account.findFirst({
    where: { tenantId, accountCode: '5000', accountType: 'Expense', isActive: true },
    select: { id: true },
  });
  if (rootExpense) {
    for (const code of ['5300', '5310', '5320', '5330', '5340', '5400', '5500', '5900']) {
      const row = await tx.account.findFirst({
        where: { tenantId, accountCode: code, accountType: 'Expense', isActive: true },
        select: { id: true, parentAccountId: true },
      });
      if (row && row.parentAccountId !== rootExpense.id) {
        await tx.account.update({
          where: { id: row.id },
          data: { parentAccountId: rootExpense.id },
        });
      }
    }
  }

  const longTerm2500 = await tx.account.findFirst({
    where: { tenantId, accountCode: '2500', accountType: 'Liability', isActive: true },
    select: { id: true },
  });
  const loan2510 = await tx.account.findFirst({
    where: { tenantId, accountCode: '2510', accountType: 'Liability', isActive: true },
    select: { id: true, parentAccountId: true },
  });
  if (longTerm2500 && loan2510 && loan2510.parentAccountId !== longTerm2500.id) {
    await tx.account.update({
      where: { id: loan2510.id },
      data: { parentAccountId: longTerm2500.id },
    });
  }

  const cap500 = await tx.account.findFirst({
    where: { tenantId, accountCode: '500000', isActive: true },
    select: { id: true, parentAccountId: true },
  });
  const own3100 = await tx.account.findFirst({
    where: { tenantId, accountCode: '3100', isActive: true },
    select: { id: true },
  });
  if (cap500 && own3100 && cap500.parentAccountId !== own3100.id) {
    await tx.account.update({
      where: { id: cap500.id },
      data: { parentAccountId: own3100.id },
    });
  }
}
