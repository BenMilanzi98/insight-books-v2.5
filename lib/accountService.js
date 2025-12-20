import prisma from './prisma';

const ACCOUNT_TYPE_META = {
  Asset: {
    normalBalance: 'Debit',
    defaultSubtype: 'Current Asset',
  },
  Liability: {
    normalBalance: 'Credit',
    defaultSubtype: 'Current Liability',
  },
  Equity: {
    normalBalance: 'Credit',
    defaultSubtype: 'Equity',
  },
  Revenue: {
    normalBalance: 'Credit',
    defaultSubtype: 'Revenue',
  },
  Expense: {
    normalBalance: 'Debit',
    defaultSubtype: 'Operating Expense',
  },
};

const FLOAT_TOLERANCE = 0.0001;

const normalizeCode = (code) => (code || '').trim();

const sanitizeAccountType = (type) => {
  if (!type) return null;
  const normalized = type.trim().toLowerCase();
  const entry = Object.keys(ACCOUNT_TYPE_META).find(
    (key) => key.toLowerCase() === normalized
  );
  return entry || null;
};

const inferNormalBalance = (accountType, providedNormalBalance) => {
  if (providedNormalBalance) return providedNormalBalance;
  const meta = ACCOUNT_TYPE_META[accountType];
  return meta ? meta.normalBalance : null;
};

const inferSubtype = (accountType, providedSubtype) => {
  if (providedSubtype) return providedSubtype;
  const meta = ACCOUNT_TYPE_META[accountType];
  return meta ? meta.defaultSubtype : null;
};

async function logAudit({ userId, tenantId, action, entityId, details }) {
  if (!userId) return;
  await prisma.auditLog.create({
    data: {
      userId,
      tenantId,
      action,
      entityType: 'Account',
      entityId,
      details,
    },
  });
}

async function ensureAccountCodeIsUnique({
  tenantId,
  accountCode,
  excludeAccountId,
}) {
  if (!accountCode) return;

  const existing = await prisma.account.findFirst({
    where: {
      tenantId,
      accountCode,
      NOT: excludeAccountId
        ? {
            id: excludeAccountId,
          }
        : undefined,
    },
    select: { id: true },
  });

  if (existing) {
    throw new Error(
      `Account code ${accountCode} is already in use for this tenant.`
    );
  }
}

async function ensureParentAccountIsValid({
  tenantId,
  parentAccountId,
  currentAccountId,
}) {
  if (!parentAccountId) return null;

  const parentAccount = await prisma.account.findFirst({
    where: {
      id: parentAccountId,
      tenantId,
    },
    select: { id: true, parentAccountId: true },
  });

  if (!parentAccount) {
    throw new Error('Parent account was not found for this tenant.');
  }

  if (currentAccountId && parentAccountId === currentAccountId) {
    throw new Error('An account cannot be its own parent.');
  }

  if (currentAccountId) {
    const descendantIds = await collectDescendants(tenantId, currentAccountId);
    if (descendantIds.has(parentAccountId)) {
      throw new Error(
        'Cannot move an account under one of its own descendants.'
      );
    }
  }

  return parentAccountId;
}

async function collectDescendants(tenantId, accountId) {
  const accounts = await prisma.account.findMany({
    where: { tenantId },
    select: { id: true, parentAccountId: true },
  });

  const childrenMap = new Map();
  accounts.forEach((account) => {
    if (!account.parentAccountId) return;
    const children = childrenMap.get(account.parentAccountId) || [];
    children.push(account.id);
    childrenMap.set(account.parentAccountId, children);
  });

  const visited = new Set();
  const stack = [...(childrenMap.get(accountId) || [])];

  while (stack.length) {
    const current = stack.pop();
    if (visited.has(current)) continue;
    visited.add(current);
    const children = childrenMap.get(current) || [];
    stack.push(...children);
  }

  return visited;
}

export async function createAccount(payload, context = {}) {
  const {
    tenantId,
    accountCode,
    accountName,
    accountType,
    accountSubtype,
    normalBalance,
    parentAccountId,
    description,
  } = payload;

  if (!tenantId) {
    throw new Error('tenantId is required to create an account.');
  }

  if (!accountName) {
    throw new Error('accountName is required to create an account.');
  }

  const sanitizedType = sanitizeAccountType(accountType);

  if (!sanitizedType) {
    throw new Error('accountType must be one of Asset, Liability, Equity, Revenue, Expense.');
  }

  const sanitizedCode = normalizeCode(accountCode);

  await ensureAccountCodeIsUnique({
    tenantId,
    accountCode: sanitizedCode,
  });

  const resolvedParentId = await ensureParentAccountIsValid({
    tenantId,
    parentAccountId,
  });

  const account = await prisma.account.create({
    data: {
      tenantId,
      accountCode: sanitizedCode || null,
      accountName,
      accountType: sanitizedType,
      accountSubtype: inferSubtype(sanitizedType, accountSubtype),
      normalBalance: inferNormalBalance(sanitizedType, normalBalance),
      parentAccountId: resolvedParentId,
      description: description || null,
    },
  });

  await logAudit({
    userId: context.userId,
    tenantId,
    action: 'account.create',
    entityId: account.id,
    details: `Created ${account.accountCode || ''} ${account.accountName}`,
  });

  return account;
}

export async function updateAccount(accountId, payload, context = {}) {
  if (!accountId) throw new Error('accountId is required.');

  const existing = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true, tenantId: true, balance: true },
  });

  if (!existing) {
    throw new Error('Account not found.');
  }

  const updateData = {};

  if (payload.accountName) {
    updateData.accountName = payload.accountName;
  }

  if (payload.accountCode !== undefined) {
    const sanitizedCode = normalizeCode(payload.accountCode);
    await ensureAccountCodeIsUnique({
      tenantId: existing.tenantId,
      accountCode: sanitizedCode,
      excludeAccountId: accountId,
    });
    updateData.accountCode = sanitizedCode;
  }

  if (payload.accountType) {
    const sanitizedType = sanitizeAccountType(payload.accountType);
    if (!sanitizedType) {
      throw new Error(
        'accountType must be one of Asset, Liability, Equity, Revenue, Expense.'
      );
    }

    updateData.accountType = sanitizedType;
    updateData.normalBalance = inferNormalBalance(
      sanitizedType,
      payload.normalBalance
    );
    updateData.accountSubtype = inferSubtype(
      sanitizedType,
      payload.accountSubtype
    );
  } else if (payload.normalBalance) {
    updateData.normalBalance = payload.normalBalance;
  }

  if (payload.accountSubtype) {
    updateData.accountSubtype = payload.accountSubtype;
  }

  if (payload.description !== undefined) {
    updateData.description = payload.description;
  }

  if (payload.parentAccountId !== undefined) {
    updateData.parentAccountId = await ensureParentAccountIsValid({
      tenantId: existing.tenantId,
      parentAccountId: payload.parentAccountId,
      currentAccountId: accountId,
    });
  }

  const account = await prisma.account.update({
    where: { id: accountId },
    data: updateData,
  });

  await logAudit({
    userId: context.userId,
    tenantId: existing.tenantId,
    action: 'account.update',
    entityId: account.id,
    details: `Updated ${account.accountCode || ''} ${account.accountName}`,
  });

  return account;
}

export async function toggleAccountActive(accountId, isActive, context = {}) {
  if (typeof isActive !== 'boolean') {
    throw new Error('isActive must be provided as a boolean.');
  }

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true, tenantId: true, balance: true, isActive: true },
  });

  if (!account) {
    throw new Error('Account not found.');
  }

  if (!isActive) {
    const balance = account.balance || 0;
    if (Math.abs(balance) > FLOAT_TOLERANCE) {
      throw new Error(
        'Accounts with non-zero balances cannot be deactivated. Please zero out the balance first.'
      );
    }
  }

  if (account.isActive === isActive) {
    return account;
  }

  const updated = await prisma.account.update({
    where: { id: accountId },
    data: { isActive },
  });

  await logAudit({
    userId: context.userId,
    tenantId: account.tenantId,
    action: isActive ? 'account.activate' : 'account.deactivate',
    entityId: accountId,
    details: `Account ${accountId} ${isActive ? 'activated' : 'deactivated'}.`,
  });

  return updated;
}

export { ACCOUNT_TYPE_META };












