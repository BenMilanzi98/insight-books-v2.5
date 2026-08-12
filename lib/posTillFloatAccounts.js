import prisma from './prisma.js';
import { AccountingValidationError } from './accountingV2/domain/errors.js';
import { resolveEquityAccountByPurpose } from './equityManagement/application/mappingService.js';

const OWNER_CAPITAL_PURPOSE = 'OWNER_CAPITAL';

function isMissingOwnerCapitalMappingError(error) {
  if (!(error instanceof AccountingValidationError)) return false;
  if (error.message.includes(`Missing equity account mapping for purpose ${OWNER_CAPITAL_PURPOSE}`)) {
    return true;
  }
  return error.issues?.some(
    (issue) => issue.path === 'purpose' && issue.message === OWNER_CAPITAL_PURPOSE
  );
}

export const POS_TILL_FLOAT_PA_NAME = 'Till Float';
export const POS_TILL_FLOAT_REFERENCE = 'POS_TILL_FLOAT';
export const POS_TILL_FLOAT_GL_CODE = '1112';
export const POS_TILL_FLOAT_GL_NAME = 'Till / Cash Float';

function normalizedGlCode(account) {
  return String(account?.accountCode ?? account?.code ?? '').trim();
}

async function findTillFloatCoaAccount(tenantId, db) {
  return db.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      mergedIntoAccountId: null,
      OR: [
        { systemPurpose: POS_TILL_FLOAT_REFERENCE },
        { controlAccountPurpose: POS_TILL_FLOAT_REFERENCE },
        { accountCode: POS_TILL_FLOAT_GL_CODE },
        { code: POS_TILL_FLOAT_GL_CODE },
      ],
    },
    orderBy: { accountCode: 'asc' },
  });
}

async function findAccountByCode(tenantId, code, db) {
  return db.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      mergedIntoAccountId: null,
      OR: [{ accountCode: code }, { code }],
    },
    orderBy: { accountCode: 'asc' },
  });
}

async function resolveTillFloatParentId(tenantId, db) {
  const cashMain = await findAccountByCode(tenantId, '1110', db);
  if (cashMain?.id) return cashMain.id;

  const currentAssets = await findAccountByCode(tenantId, '1100', db);
  if (currentAssets?.id) return currentAssets.id;

  const assetsRoot = await findAccountByCode(tenantId, '1000', db);
  return assetsRoot?.id ?? null;
}

async function createTillFloatCoaAccount(tenantId, db) {
  const parentAccountId = await resolveTillFloatParentId(tenantId, db);

  try {
    return await db.account.create({
      data: {
        tenantId,
        code: POS_TILL_FLOAT_GL_CODE,
        name: POS_TILL_FLOAT_GL_NAME,
        type: 'ASSET',
        accountCode: POS_TILL_FLOAT_GL_CODE,
        accountName: POS_TILL_FLOAT_GL_NAME,
        accountType: 'Asset',
        accountSubtype: 'Current Asset',
        normalBalance: 'Debit',
        parentAccountId,
        isActive: true,
        isSystem: true,
        acceptsNewTransactions: true,
        postingAllowed: true,
        visibleInChart: true,
        systemPurpose: POS_TILL_FLOAT_REFERENCE,
        description: 'POS till float funded from cash/capital and swept back to cash on close.',
        balance: 0,
      },
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      const existing = await findTillFloatCoaAccount(tenantId, db);
      if (existing) return existing;
    }
    throw error;
  }
}

async function ensureTillFloatCoaAccount(tenantId, db) {
  const existing = await findTillFloatCoaAccount(tenantId, db);
  if (!existing) return createTillFloatCoaAccount(tenantId, db);

  const desiredParentId =
    existing.parentAccountId != null ? existing.parentAccountId : await resolveTillFloatParentId(tenantId, db);
  const patch = {};

  if (existing.accountCode !== POS_TILL_FLOAT_GL_CODE) patch.accountCode = POS_TILL_FLOAT_GL_CODE;
  if (existing.code !== POS_TILL_FLOAT_GL_CODE) patch.code = POS_TILL_FLOAT_GL_CODE;
  if (existing.accountName !== POS_TILL_FLOAT_GL_NAME) patch.accountName = POS_TILL_FLOAT_GL_NAME;
  if (existing.name !== POS_TILL_FLOAT_GL_NAME) patch.name = POS_TILL_FLOAT_GL_NAME;
  if (existing.systemPurpose !== POS_TILL_FLOAT_REFERENCE) patch.systemPurpose = POS_TILL_FLOAT_REFERENCE;
  if (existing.accountType !== 'Asset') patch.accountType = 'Asset';
  if (existing.type !== 'ASSET') patch.type = 'ASSET';
  if (existing.accountSubtype !== 'Current Asset') patch.accountSubtype = 'Current Asset';
  if (existing.normalBalance !== 'Debit') patch.normalBalance = 'Debit';
  if (existing.isSystem !== true) patch.isSystem = true;
  if (existing.isActive !== true) patch.isActive = true;
  if (existing.acceptsNewTransactions === false) patch.acceptsNewTransactions = true;
  if (existing.postingAllowed === false || existing.postingAllowed == null) patch.postingAllowed = true;
  if (existing.visibleInChart === false) patch.visibleInChart = true;
  if (existing.parentAccountId == null && desiredParentId) patch.parentAccountId = desiredParentId;

  if (!Object.keys(patch).length) return existing;

  return db.account.update({
    where: { id: existing.id },
    data: patch,
  });
}

function buildTillFloatPaymentAccountData(tenantId, tillCoaId) {
  return {
    tenantId,
    name: POS_TILL_FLOAT_PA_NAME,
    accountType: 'Cash',
    reference: POS_TILL_FLOAT_REFERENCE,
    isSystem: true,
    isActive: true,
    coaAccountId: tillCoaId,
  };
}

export async function ensurePosTillFloatPaymentAccount(tenantId, client = prisma) {
  const tillCoa = await ensureTillFloatCoaAccount(tenantId, client);

  const existing = await client.paymentAccount.findFirst({
    where: {
      tenantId,
      OR: [
        { reference: POS_TILL_FLOAT_REFERENCE },
        { name: POS_TILL_FLOAT_PA_NAME, accountType: 'Cash', isSystem: true },
      ],
    },
  });

  if (!existing) {
    try {
      return await client.paymentAccount.create({
        data: buildTillFloatPaymentAccountData(tenantId, tillCoa.id),
      });
    } catch (error) {
      if (error?.code === 'P2002') {
        const concurrent = await client.paymentAccount.findFirst({
          where: { tenantId, reference: POS_TILL_FLOAT_REFERENCE },
        });
        if (concurrent) return concurrent;
      }
      throw error;
    }
  }

  const patch = {};
  if (existing.name !== POS_TILL_FLOAT_PA_NAME) patch.name = POS_TILL_FLOAT_PA_NAME;
  if (existing.accountType !== 'Cash') patch.accountType = 'Cash';
  if (existing.reference !== POS_TILL_FLOAT_REFERENCE) patch.reference = POS_TILL_FLOAT_REFERENCE;
  if (existing.isSystem !== true) patch.isSystem = true;
  if (existing.isActive !== true) patch.isActive = true;
  if (existing.coaAccountId !== tillCoa.id) patch.coaAccountId = tillCoa.id;

  if (!Object.keys(patch).length) return existing;

  return client.paymentAccount.update({
    where: { id: existing.id },
    data: patch,
  });
}

export async function resolveOwnerCapitalCoaAccount(tenantId, client = prisma) {
  try {
    return await resolveEquityAccountByPurpose(client, tenantId, OWNER_CAPITAL_PURPOSE);
  } catch (error) {
    if (isMissingOwnerCapitalMappingError(error)) return null;
    throw error;
  }
}

export function isTillFloatLeafAccount(account) {
  return normalizedGlCode(account) === POS_TILL_FLOAT_GL_CODE;
}
