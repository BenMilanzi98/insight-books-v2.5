/**
 * Equity Transaction lifecycle — create → approve → post via Posting Engine.
 */

import {
  EquityTransactionType,
  EquityTxStatus,
  HIGH_RISK_TYPES,
} from '../domain/enums.js';
import { shareCapitalAndPremium } from '../domain/ownershipPercent.js';
import { parseDecimalToMinor, minorToDecimalString } from '../../accountingV2/domain/money.js';
import { AccountingValidationError } from '../../accountingV2/domain/errors.js';
import {
  postCapitalContributionAccounting,
  postOwnerDrawingAccounting,
} from '../../accountingV2/adapters/remainingAdapters.js';
import { AccountingEventType, AccountingSourceModule } from '../../accountingV2/domain/enums.js';
import { contextFromSession, submitViaCutover, amountString, toIsoDate } from '../../accountingV2/adapters/baseAdapter.js';
import { assertWorkflowAllowed, getEquityConfiguration } from './configService.js';
import { assertActiveRelationship } from './partyService.js';
import { resolveBankOrCashAccount, resolveEquityAccountByPurpose } from './mappingService.js';
import { applyOwnershipFromTransaction } from './ownershipService.js';

async function nextTxnNumber(db, tenantId, prefix) {
  const count = await db.eqV2EquityTransaction.count({ where: { tenantId } });
  return `${prefix}-${String(count + 1).padStart(6, '0')}`;
}

export async function createEquityTransaction(db, context, input) {
  const cfg = await getEquityConfiguration(db, context.businessId);
  const type = input.transactionType;
  if (!Object.values(EquityTransactionType).includes(type)) {
    throw new AccountingValidationError('Unsupported equity transaction type.');
  }

  const workflowMap = {
    [EquityTransactionType.CAPITAL_CONTRIBUTION]: 'contribution',
    [EquityTransactionType.NON_CASH_CONTRIBUTION]: 'contribution',
    [EquityTransactionType.OWNER_DRAWING]: 'drawing',
    [EquityTransactionType.PARTNER_DRAWING]: 'drawing',
    [EquityTransactionType.DIVIDEND_DECLARATION]: 'dividend',
    [EquityTransactionType.DIVIDEND_PAYMENT]: 'dividend',
    [EquityTransactionType.SHARE_ISSUANCE]: 'shareIssuance',
    [EquityTransactionType.SHARE_TRANSFER]: 'shareTransfer',
  };
  if (workflowMap[type]) assertWorkflowAllowed(cfg, workflowMap[type]);

  if (input.relationshipId) {
    await assertActiveRelationship(db, context.businessId, input.relationshipId);
  }

  const amountMinor = parseDecimalToMinor(String(input.amount));
  if (amountMinor <= 0 && type !== EquityTransactionType.SHARE_TRANSFER) {
    throw new AccountingValidationError('Amount must be positive.');
  }

  let premiumAmount = input.premiumAmount || null;
  let shareQuantity = input.shareQuantity || null;
  let nominalValue = input.nominalValue || null;
  let issuePrice = input.issuePrice || null;

  if (type === EquityTransactionType.SHARE_ISSUANCE) {
    const split = shareCapitalAndPremium({
      quantity: input.shareQuantity,
      nominalValue: input.nominalValue,
      issuePrice: input.issuePrice,
    });
    premiumAmount = split.premium;
    // amount = total consideration
    if (!input.amount) {
      input.amount = split.totalConsideration;
    }
  }

  const prefix =
    type.includes('DRAWING') ? 'DRW' : type.includes('DIVIDEND') ? 'DIV' : type.includes('SHARE') ? 'SHR' : 'EQT';

  const requiresApproval =
    HIGH_RISK_TYPES.includes(type) ||
    (type.includes('CONTRIBUTION') && cfg?.requireContributionApproval) ||
    (type.includes('DRAWING') && cfg?.requireDrawingApproval) ||
    (type.includes('DIVIDEND') && cfg?.requireDividendApproval);

  return db.eqV2EquityTransaction.create({
    data: {
      tenantId: context.businessId,
      transactionNumber: await nextTxnNumber(db, context.businessId, prefix),
      transactionType: type,
      relationshipId: input.relationshipId || null,
      shareClassId: input.shareClassId || null,
      transactionDate: new Date(input.transactionDate),
      requestedPostingDate: input.requestedPostingDate
        ? new Date(input.requestedPostingDate)
        : new Date(input.transactionDate),
      amount: String(input.amount),
      amountMinor: parseDecimalToMinor(String(input.amount)),
      currency: input.currency || cfg?.defaultCurrency || 'MWK',
      shareQuantity,
      nominalValue,
      issuePrice,
      premiumAmount,
      description: input.description || null,
      reason: input.reason || null,
      sourceReference: input.sourceReference || null,
      status: requiresApproval ? EquityTxStatus.DRAFT : EquityTxStatus.APPROVED,
      approvalStatus: requiresApproval ? 'REQUIRED' : 'NOT_REQUIRED',
      accountingStatus: 'NOT_POSTED',
      altersOwnership: Boolean(input.altersOwnership),
      effectiveOwnershipDate: input.effectiveOwnershipDate
        ? new Date(input.effectiveOwnershipDate)
        : null,
      bankAccountId: input.bankAccountId || null,
      assetAccountId: input.assetAccountId || null,
      offsetAccountId: input.offsetAccountId || null,
      equityAccountId: input.equityAccountId || null,
      assetId: input.assetId || null,
      liabilityId: input.liabilityId || null,
      createdBy: context.userId || null,
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function submitForApproval(db, context, id, comment) {
  const tx = await requireTx(db, context.businessId, id);
  if (![EquityTxStatus.DRAFT, EquityTxStatus.REJECTED].includes(tx.status)) {
    throw new AccountingValidationError(`Cannot submit in status ${tx.status}.`);
  }
  const updated = await db.eqV2EquityTransaction.update({
    where: { id },
    data: {
      status: EquityTxStatus.PENDING_APPROVAL,
      submittedBy: context.userId || null,
      approvalStatus: 'PENDING',
    },
  });
  await db.eqV2EquityApproval.create({
    data: {
      tenantId: context.businessId,
      equityTransactionId: id,
      action: 'SUBMIT',
      actorUserId: context.userId || 'system',
      comment: comment || null,
    },
  });
  return updated;
}

export async function approveTransaction(db, context, id, comment) {
  const tx = await requireTx(db, context.businessId, id);
  const cfg = await getEquityConfiguration(db, context.businessId);
  if (cfg?.requireSeparateApprover && tx.createdBy && tx.createdBy === context.userId) {
    throw new AccountingValidationError('Separation of duties: creator cannot approve.');
  }
  if (![EquityTxStatus.PENDING_APPROVAL, EquityTxStatus.DRAFT, EquityTxStatus.APPROVED].includes(tx.status)) {
    throw new AccountingValidationError(`Cannot approve in status ${tx.status}.`);
  }
  const updated = await db.eqV2EquityTransaction.update({
    where: { id },
    data: {
      status: EquityTxStatus.APPROVED,
      approvalStatus: 'APPROVED',
      approvedBy: context.userId || null,
      approvedAt: new Date(),
    },
  });
  await db.eqV2EquityApproval.create({
    data: {
      tenantId: context.businessId,
      equityTransactionId: id,
      action: 'APPROVE',
      actorUserId: context.userId || 'system',
      comment: comment || null,
    },
  });
  return updated;
}

export async function previewEquityPosting(db, context, id) {
  const tx = await requireTx(db, context.businessId, id);
  const lines = await buildPostingLines(db, context.businessId, tx);
  const debit = lines.reduce((s, l) => s + parseDecimalToMinor(l.debit || '0'), 0);
  const credit = lines.reduce((s, l) => s + parseDecimalToMinor(l.credit || '0'), 0);
  return {
    transactionId: tx.id,
    transactionType: tx.transactionType,
    transactionDate: tx.transactionDate,
    postingDate: tx.requestedPostingDate || tx.transactionDate,
    currency: tx.currency,
    balanced: debit === credit,
    totalDebit: minorToDecimalString(debit),
    totalCredit: minorToDecimalString(credit),
    lines,
    altersOwnership: tx.altersOwnership,
    warnings: debit !== credit ? ['Journal is unbalanced'] : [],
  };
}

export async function postEquityTransaction(db, context, id, { hasPermission } = {}) {
  const tx = await requireTx(db, context.businessId, id);
  if (tx.accountingStatus === 'POSTED' && tx.journalEntryId) {
    return { transaction: tx, reused: true };
  }
  if (tx.status !== EquityTxStatus.APPROVED && tx.approvalStatus !== 'NOT_REQUIRED') {
    if (tx.status !== EquityTxStatus.APPROVED) {
      throw new AccountingValidationError('Transaction must be approved before posting.');
    }
  }
  // Share transfer without company journal
  if (
    tx.transactionType === EquityTransactionType.SHARE_TRANSFER &&
    !(tx.metadata && tx.metadata.createsCompanyJournal)
  ) {
    await applyOwnershipFromTransaction(db, context, tx);
    const updated = await db.eqV2EquityTransaction.update({
      where: { id },
      data: {
        status: EquityTxStatus.POSTED,
        accountingStatus: 'OWNERSHIP_ONLY',
        postedBy: context.userId || null,
        postedAt: new Date(),
      },
    });
    return { transaction: updated, ownershipOnly: true };
  }

  const lines = await buildPostingLines(db, context.businessId, tx);
  await db.eqV2EquityTransaction.update({
    where: { id },
    data: { status: EquityTxStatus.POSTING, accountingStatus: 'POSTING' },
  });

  let result;
  try {
    result = await submitEquityPosting(db, context, tx, lines, hasPermission);
  } catch (err) {
    await db.eqV2EquityTransaction.update({
      where: { id },
      data: { status: EquityTxStatus.FAILED, accountingStatus: 'FAILED' },
    });
    throw err;
  }

  const journalEntryId = result?.journalEntryId || result?.journal?.id || result?.id || null;
  const eventId = result?.eventId || result?.registryId || result?.accountingEventId || null;

  const updated = await db.eqV2EquityTransaction.update({
    where: { id },
    data: {
      status: EquityTxStatus.POSTED,
      accountingStatus: 'POSTED',
      journalEntryId,
      accountingEventId: eventId,
      postedBy: context.userId || null,
      postedAt: new Date(),
    },
  });

  if (tx.altersOwnership || tx.transactionType === EquityTransactionType.SHARE_ISSUANCE) {
    await applyOwnershipFromTransaction(db, context, updated);
  }

  await db.eqV2EquityApproval.create({
    data: {
      tenantId: context.businessId,
      equityTransactionId: id,
      action: 'POST',
      actorUserId: context.userId || 'system',
      comment: journalEntryId || null,
    },
  });

  return { transaction: updated, posting: result };
}

async function submitEquityPosting(db, context, tx, lines, hasPermission) {
  const can = hasPermission || (() => true);
  const date = tx.requestedPostingDate || tx.transactionDate;
  const amount = minorToDecimalString(tx.amountMinor);

  if (
    [EquityTransactionType.CAPITAL_CONTRIBUTION, EquityTransactionType.NON_CASH_CONTRIBUTION, EquityTransactionType.SHARE_ISSUANCE].includes(
      tx.transactionType
    )
  ) {
    return postCapitalContributionAccounting({
      db,
      tenantId: context.businessId,
      userId: context.userId,
      sourceType: 'EqV2EquityTransaction',
      sourceId: tx.id,
      amount,
      date,
      description: tx.description || tx.transactionType,
      lines,
      currency: tx.currency,
      hasPermission: can,
    });
  }

  if (
    [EquityTransactionType.OWNER_DRAWING, EquityTransactionType.PARTNER_DRAWING].includes(tx.transactionType)
  ) {
    return postOwnerDrawingAccounting({
      db,
      tenantId: context.businessId,
      userId: context.userId,
      drawingId: tx.id,
      amount,
      date,
      description: tx.description || 'Owner drawing',
      lines,
      currency: tx.currency,
      hasPermission: can,
    });
  }

  // Generic equity event via cutover (dividends, loans, reserves, etc.)
  const eventType = mapEventType(tx.transactionType);
  const sessionCtx = contextFromSession({
    tenantId: context.businessId,
    userId: context.userId,
    currency: tx.currency,
  });
  return submitViaCutover({
    db,
    context: sessionCtx,
    moduleKey: AccountingSourceModule.EQUITY,
    eventType,
    hasPermission: can,
    buildEngineInput: async () => ({
      sourceReference: {
        sourceModule: AccountingSourceModule.EQUITY,
        sourceType: 'EqV2EquityTransaction',
        sourceId: tx.id,
        sourceNumber: tx.transactionNumber,
        eventType,
      },
      transactionDate: toIsoDate(date),
      requestedPostingDate: toIsoDate(date),
      currency: tx.currency,
      totalAmount: amountString(amount),
      taxAmount: '0.00',
      description: tx.description || tx.transactionType,
      dimensions: {
        ownerId: tx.relationshipId || undefined,
        shareholderId: tx.relationshipId || undefined,
      },
      metadata: { lines, equityTransactionType: tx.transactionType },
      payload: null,
    }),
  });
}

function mapEventType(type) {
  switch (type) {
    case EquityTransactionType.DIVIDEND_DECLARATION:
      return AccountingEventType.DIVIDEND_DECLARED;
    case EquityTransactionType.DIVIDEND_PAYMENT:
      return AccountingEventType.DIVIDEND_PAID;
    case EquityTransactionType.OWNER_DRAWING:
    case EquityTransactionType.PARTNER_DRAWING:
      return AccountingEventType.OWNER_DRAWING_POSTED;
    default:
      return AccountingEventType.CAPITAL_CONTRIBUTION_POSTED;
  }
}

async function buildPostingLines(db, tenantId, tx) {
  const amt = minorToDecimalString(tx.amountMinor);
  const type = tx.transactionType;

  if (
    type === EquityTransactionType.CAPITAL_CONTRIBUTION ||
    type === EquityTransactionType.NON_CASH_CONTRIBUTION
  ) {
    const debitId =
      tx.assetAccountId ||
      tx.bankAccountId ||
      (await resolveEquityAccountByPurpose(db, tenantId, 'OWNER_CAPITAL').then(() => null));
    // Prefer explicit bank/asset
    const bankId = tx.bankAccountId || tx.assetAccountId;
    if (!bankId) {
      throw new AccountingValidationError('bankAccountId or assetAccountId is required for contributions.');
    }
    await resolveBankOrCashAccount(db, tenantId, bankId);
    const equity =
      (tx.equityAccountId &&
        (await db.account.findFirst({ where: { id: tx.equityAccountId, tenantId } }))) ||
      (await resolveEquityAccountByPurpose(db, tenantId, 'OWNER_CAPITAL'));
    return [
      { accountId: bankId, debit: amt, credit: '0.00', description: tx.description || 'Contribution' },
      { accountId: equity.id, debit: '0.00', credit: amt, description: tx.description || 'Owner capital' },
    ];
  }

  if (type === EquityTransactionType.SHARE_ISSUANCE) {
    const bankId = tx.bankAccountId || tx.assetAccountId;
    if (!bankId) throw new AccountingValidationError('Receiving account required for share issuance.');
    const shareCap =
      (tx.equityAccountId &&
        (await db.account.findFirst({ where: { id: tx.equityAccountId, tenantId } }))) ||
      (await resolveEquityAccountByPurpose(db, tenantId, 'SHARE_CAPITAL'));
    const split = shareCapitalAndPremium({
      quantity: tx.shareQuantity,
      nominalValue: tx.nominalValue,
      issuePrice: tx.issuePrice,
    });
    const lines = [
      { accountId: bankId, debit: split.totalConsideration, credit: '0.00', description: 'Share issue proceeds' },
      { accountId: shareCap.id, debit: '0.00', credit: split.shareCapital, description: 'Share capital' },
    ];
    if (parseDecimalToMinor(split.premium) > 0) {
      const premiumAcct = await resolveEquityAccountByPurpose(db, tenantId, 'SHARE_PREMIUM');
      lines.push({
        accountId: premiumAcct.id,
        debit: '0.00',
        credit: split.premium,
        description: 'Share premium',
      });
    }
    return lines;
  }

  if (type === EquityTransactionType.OWNER_DRAWING || type === EquityTransactionType.PARTNER_DRAWING) {
    const bankId = tx.bankAccountId || tx.assetAccountId;
    if (!bankId) throw new AccountingValidationError('Payment account required for drawings.');
    const drawings = await resolveEquityAccountByPurpose(db, tenantId, 'OWNER_DRAWINGS');
    return [
      { accountId: drawings.id, debit: amt, credit: '0.00', description: tx.description || 'Owner drawing' },
      { accountId: bankId, debit: '0.00', credit: amt, description: tx.description || 'Drawing payment' },
    ];
  }

  if (type === EquityTransactionType.DIVIDEND_DECLARATION) {
    const re = await resolveEquityAccountByPurpose(db, tenantId, 'RETAINED_EARNINGS');
    const payable = await resolveEquityAccountByPurpose(db, tenantId, 'DIVIDENDS_PAYABLE');
    return [
      { accountId: re.id, debit: amt, credit: '0.00', description: 'Dividend declared' },
      { accountId: payable.id, debit: '0.00', credit: amt, description: 'Dividends payable' },
    ];
  }

  if (type === EquityTransactionType.DIVIDEND_PAYMENT) {
    const payable = await resolveEquityAccountByPurpose(db, tenantId, 'DIVIDENDS_PAYABLE');
    const bankId = tx.bankAccountId;
    if (!bankId) throw new AccountingValidationError('bankAccountId required for dividend payment.');
    return [
      { accountId: payable.id, debit: amt, credit: '0.00', description: 'Dividend payment' },
      { accountId: bankId, debit: '0.00', credit: amt, description: 'Dividend paid' },
    ];
  }

  if (type === EquityTransactionType.OWNER_LOAN_ADVANCE) {
    const bankId = tx.bankAccountId;
    const loan = await resolveEquityAccountByPurpose(db, tenantId, 'OWNER_LOAN_LIABILITY');
    if (!bankId) throw new AccountingValidationError('bankAccountId required for owner loan.');
    return [
      { accountId: bankId, debit: amt, credit: '0.00', description: 'Owner loan received' },
      { accountId: loan.id, debit: '0.00', credit: amt, description: 'Owner loan liability' },
    ];
  }

  if (type === EquityTransactionType.OWNER_LOAN_CONVERSION) {
    const loan = await resolveEquityAccountByPurpose(db, tenantId, 'OWNER_LOAN_LIABILITY');
    const equity = await resolveEquityAccountByPurpose(db, tenantId, 'OWNER_CAPITAL');
    return [
      { accountId: loan.id, debit: amt, credit: '0.00', description: 'Convert owner loan' },
      { accountId: equity.id, debit: '0.00', credit: amt, description: 'Owner capital' },
    ];
  }

  if (type === EquityTransactionType.RESERVE_TRANSFER) {
    if (!tx.equityAccountId || !tx.offsetAccountId) {
      throw new AccountingValidationError('Reserve transfer requires source and destination equity accounts.');
    }
    return [
      { accountId: tx.equityAccountId, debit: amt, credit: '0.00', description: tx.description || 'Reserve transfer' },
      { accountId: tx.offsetAccountId, debit: '0.00', credit: amt, description: tx.description || 'Reserve transfer' },
    ];
  }

  throw new AccountingValidationError(`No posting line builder for ${type}.`);
}

async function requireTx(db, tenantId, id) {
  const tx = await db.eqV2EquityTransaction.findFirst({ where: { id, tenantId } });
  if (!tx) {
    throw new AccountingValidationError('Equity transaction not found.');
  }
  return tx;
}

export async function listEquityTransactions(db, tenantId, filters = {}) {
  return db.eqV2EquityTransaction.findMany({
    where: {
      tenantId,
      ...(filters.transactionType ? { transactionType: filters.transactionType } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.relationshipId ? { relationshipId: filters.relationshipId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: filters.limit || 100,
  });
}

export { buildPostingLines, requireTx };
