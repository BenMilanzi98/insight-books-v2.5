/**
 * Resolve purpose → CoA account for tax posting (Wave 3).
 * Prefers TaxAccountMapping; falls back to TaxType.accountId / fixed 2041/2045.
 */

import prisma from '../prisma.js';
import { TAX_PURPOSE_LIST, TAX_PURPOSES } from './purposes.js';

function registerEnabled(db = prisma) {
  return Boolean(db?.taxAccountMapping?.findFirst);
}

export async function listTaxAccountMappings({ tenantId, purpose = null, db = prisma }) {
  if (!registerEnabled(db)) return [];
  return db.taxAccountMapping.findMany({
    where: {
      tenantId,
      status: 'ACTIVE',
      ...(purpose ? { purpose } : {}),
    },
    include: {
      account: { select: { id: true, code: true, name: true, type: true } },
    },
    orderBy: [{ purpose: 'asc' }, { effectiveFrom: 'desc' }],
  });
}

export async function resolveTaxAccountForPurpose({
  tenantId,
  purpose,
  taxTypeId = null,
  asOf = new Date(),
  db = prisma,
}) {
  if (!TAX_PURPOSE_LIST.includes(purpose)) {
    const err = new Error(`Unknown tax purpose: ${purpose}`);
    err.code = 'UNKNOWN_PURPOSE';
    throw err;
  }

  if (registerEnabled(db)) {
    const mapping = await db.taxAccountMapping.findFirst({
      where: {
        tenantId,
        purpose,
        status: 'ACTIVE',
        effectiveFrom: { lte: asOf },
        AND: [
          { OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }] },
          taxTypeId
            ? { OR: [{ taxTypeId }, { taxTypeId: null }] }
            : { taxTypeId: null },
        ],
      },
      orderBy: [{ taxTypeId: 'desc' }, { effectiveFrom: 'desc' }],
      include: { account: true },
    });
    if (mapping) {
      return {
        accountId: mapping.accountId,
        account: mapping.account,
        source: 'TaxAccountMapping',
        mappingId: mapping.id,
      };
    }
  }


  if (taxTypeId) {
    const taxType = await db.taxType.findFirst({
      where: { id: taxTypeId, tenantId },
      include: { account: true },
    });
    if (taxType?.accountId) {
      return {
        accountId: taxType.accountId,
        account: taxType.account,
        source: 'TaxType.accountId',
        mappingId: null,
      };
    }
  }

  // Fixed COA fallback for output/payable-style purposes
  try {
    const { getFixedTaxInflowAccount, getFixedTaxOutflowAccount } = await import(
      '../taxAccountsInitialization.js'
    );
    if (
      purpose === TAX_PURPOSES.VAT_OUTPUT ||
      purpose === TAX_PURPOSES.TAX_PAYABLE ||
      purpose === TAX_PURPOSES.WITHHOLDING_PAYABLE
    ) {
      const account = await getFixedTaxInflowAccount(tenantId, db);
      if (account) {
        return {
          accountId: account.id,
          account,
          source: 'fixed-2041',
          mappingId: null,
        };
      }
    }
    if (purpose === TAX_PURPOSES.VAT_INPUT || purpose === TAX_PURPOSES.TAX_RECEIVABLE) {
      const account = await getFixedTaxOutflowAccount(tenantId, db);
      if (account) {
        return {
          accountId: account.id,
          account,
          source: 'fixed-2045',
          mappingId: null,
        };
      }
    }
  } catch {
    // initialization helper optional during tests
  }

  return null;
}

export async function upsertTaxAccountMapping({
  tenantId,
  userId,
  purpose,
  accountId,
  taxTypeId = null,
  effectiveFrom = new Date(),
  effectiveTo = null,
  notes = null,
  db = prisma,
}) {
  if (!registerEnabled(db)) {
    const err = new Error(
      'TaxAccountMapping unavailable. Run prisma migrate + generate, then restart the app.'
    );
    err.code = 'MAPPING_UNAVAILABLE';
    throw err;
  }
  if (!TAX_PURPOSE_LIST.includes(purpose)) {
    const err = new Error(`Unknown tax purpose: ${purpose}`);
    err.code = 'UNKNOWN_PURPOSE';
    throw err;
  }

  // Close prior open mapping for same tenant/purpose/taxType scope
  await db.taxAccountMapping.updateMany({
    where: {
      tenantId,
      purpose,
      status: 'ACTIVE',
      taxTypeId: taxTypeId || null,
      effectiveTo: null,
    },
    data: {
      effectiveTo: effectiveFrom,
      status: 'SUPERSEDED',
    },
  });

  return db.taxAccountMapping.create({
    data: {
      tenantId,
      purpose,
      accountId,
      taxTypeId,
      effectiveFrom,
      effectiveTo,
      status: 'ACTIVE',
      notes,
      createdById: userId || null,
    },
    include: {
      account: { select: { id: true, code: true, name: true, type: true } },
    },
  });
}
