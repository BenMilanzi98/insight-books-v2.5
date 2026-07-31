import { parseDecimalToMinor, minorToDecimalString } from '../../accountingV2/domain/money.js';
import { AccountingValidationError } from '../../accountingV2/domain/errors.js';
import { EquityTransactionType, EquityTxStatus } from '../domain/enums.js';
import { percentToMinor, minorToPercentString, ONE_HUNDRED_PERCENT_MINOR } from '../domain/ownershipPercent.js';
import { listActiveHoldings } from './ownershipService.js';
import {
  createEquityTransaction,
  approveTransaction,
  postEquityTransaction,
} from './transactionService.js';
import { assertWorkflowAllowed, getEquityConfiguration } from './configService.js';

async function nextDeclNumber(db, tenantId) {
  const n = await db.eqV2DividendDeclaration.count({ where: { tenantId } });
  return `DIVD-${String(n + 1).padStart(5, '0')}`;
}

/**
 * Create declaration + allocations. Allocation sum must equal declaration (exact minors).
 */
export async function createDividendDeclaration(db, context, input) {
  const cfg = await getEquityConfiguration(db, context.businessId);
  assertWorkflowAllowed(cfg, 'dividend');

  const totalMinor = parseDecimalToMinor(String(input.totalAmount));
  if (totalMinor <= 0) throw new AccountingValidationError('Dividend amount must be positive.');

  const method = input.allocationMethod || 'OWNERSHIP_PERCENTAGE';
  const holdings = await listActiveHoldings(db, context.businessId, input.recordDate || input.declarationDate);

  let allocations = input.allocations;
  if (!allocations?.length) {
    if (method === 'OWNERSHIP_PERCENTAGE') {
      const pctMinors = holdings.map((h) => percentToMinor(h.ownershipPercentage));
      const pctTotal = pctMinors.reduce((s, v) => s + v, 0) || ONE_HUNDRED_PERCENT_MINOR;
      allocations = holdings.map((h, i) => {
        const share = Math.floor((totalMinor * pctMinors[i]) / pctTotal);
        return {
          relationshipId: h.relationshipId,
          ownershipPercentage: String(h.ownershipPercentage),
          eligibleQuantity: String(h.quantityHeld),
          grossAmountMinor: share,
        };
      });
      // Remainder to largest holder (deterministic)
      const allocated = allocations.reduce((s, a) => s + a.grossAmountMinor, 0);
      let rem = totalMinor - allocated;
      if (rem !== 0 && allocations.length) {
        const idx = pctMinors.indexOf(Math.max(...pctMinors));
        allocations[idx].grossAmountMinor += rem;
      }
    } else if (method === 'FIXED' && input.allocations) {
      allocations = input.allocations;
    } else {
      throw new AccountingValidationError('Provide allocations or use OWNERSHIP_PERCENTAGE with holdings.');
    }
  }

  const sum = allocations.reduce((s, a) => s + Number(a.grossAmountMinor ?? parseDecimalToMinor(String(a.grossAmount))), 0);
  if (sum !== totalMinor) {
    throw new AccountingValidationError(
      `Dividend allocation total ${minorToDecimalString(sum)} differs from declaration ${minorToDecimalString(totalMinor)}.`,
      [{ path: 'allocations', message: 'EQT-026' }]
    );
  }

  const declaration = await db.eqV2DividendDeclaration.create({
    data: {
      tenantId: context.businessId,
      declarationNumber: await nextDeclNumber(db, context.businessId),
      declarationDate: new Date(input.declarationDate),
      recordDate: input.recordDate ? new Date(input.recordDate) : null,
      paymentDate: input.paymentDate ? new Date(input.paymentDate) : null,
      totalAmount: minorToDecimalString(totalMinor),
      totalAmountMinor: totalMinor,
      currency: input.currency || cfg?.defaultCurrency || 'MWK',
      allocationMethod: method,
      status: 'DRAFT',
      createdBy: context.userId || null,
      allocations: {
        create: allocations.map((a) => {
          const gross = Number(a.grossAmountMinor ?? parseDecimalToMinor(String(a.grossAmount)));
          const wht = Number(a.withholdingMinor || 0);
          return {
            tenantId: context.businessId,
            relationshipId: a.relationshipId,
            eligibleQuantity: a.eligibleQuantity != null ? String(a.eligibleQuantity) : null,
            ownershipPercentage: a.ownershipPercentage != null ? String(a.ownershipPercentage) : null,
            grossAmount: minorToDecimalString(gross),
            grossAmountMinor: gross,
            withholdingMinor: wht,
            netAmountMinor: gross - wht,
            currency: input.currency || 'MWK',
          };
        }),
      },
    },
    include: { allocations: true },
  });

  return declaration;
}

export async function postDividendDeclaration(db, context, declarationId, { hasPermission } = {}) {
  const decl = await db.eqV2DividendDeclaration.findFirst({
    where: { id: declarationId, tenantId: context.businessId },
    include: { allocations: true },
  });
  if (!decl) throw new AccountingValidationError('Dividend declaration not found.');
  if (decl.journalEntryId) return { declaration: decl, reused: true };

  let eqTx = await createEquityTransaction(db, context, {
    transactionType: EquityTransactionType.DIVIDEND_DECLARATION,
    amount: minorToDecimalString(decl.totalAmountMinor),
    transactionDate: decl.declarationDate,
    currency: decl.currency,
    description: `Dividend ${decl.declarationNumber}`,
    altersOwnership: false,
  });
  eqTx = await approveTransaction(db, context, eqTx.id, 'Dividend declaration');
  // Force approved even if SoD — system declaration path
  if (eqTx.status !== EquityTxStatus.APPROVED) {
    eqTx = await db.eqV2EquityTransaction.update({
      where: { id: eqTx.id },
      data: { status: EquityTxStatus.APPROVED, approvalStatus: 'APPROVED', approvedBy: context.userId },
    });
  }
  const posted = await postEquityTransaction(db, context, eqTx.id, { hasPermission });

  const updated = await db.eqV2DividendDeclaration.update({
    where: { id: decl.id },
    data: {
      status: 'POSTED',
      equityTransactionId: eqTx.id,
      journalEntryId: posted.transaction.journalEntryId,
      approvedBy: context.userId || null,
    },
    include: { allocations: true },
  });
  return { declaration: updated, posting: posted };
}

export async function payDividendAllocation(db, context, input, { hasPermission } = {}) {
  const alloc = await db.eqV2DividendAllocation.findFirst({
    where: { id: input.allocationId, tenantId: context.businessId },
    include: { declaration: true },
  });
  if (!alloc) throw new AccountingValidationError('Allocation not found.');

  const payMinor = parseDecimalToMinor(String(input.amount));
  const remaining = alloc.netAmountMinor - alloc.paidAmountMinor;
  if (payMinor <= 0 || payMinor > remaining) {
    throw new AccountingValidationError('Dividend payment exceeds unpaid allocation.', [
      { path: 'amount', message: 'EQT-027' },
    ]);
  }
  if (!input.bankAccountId) {
    throw new AccountingValidationError('bankAccountId required.');
  }

  let eqTx = await createEquityTransaction(db, context, {
    transactionType: EquityTransactionType.DIVIDEND_PAYMENT,
    relationshipId: alloc.relationshipId,
    amount: minorToDecimalString(payMinor),
    transactionDate: input.paymentDate || new Date(),
    bankAccountId: input.bankAccountId,
    currency: alloc.currency,
    description: `Dividend payment ${alloc.declaration.declarationNumber}`,
    dividendDeclarationId: alloc.declarationId,
  });
  eqTx = await db.eqV2EquityTransaction.update({
    where: { id: eqTx.id },
    data: { status: EquityTxStatus.APPROVED, approvalStatus: 'APPROVED', approvedBy: context.userId },
  });
  const posted = await postEquityTransaction(db, context, eqTx.id, { hasPermission });

  const payment = await db.eqV2DividendPayment.create({
    data: {
      tenantId: context.businessId,
      declarationId: alloc.declarationId,
      allocationId: alloc.id,
      relationshipId: alloc.relationshipId,
      paymentDate: new Date(input.paymentDate || Date.now()),
      amountMinor: payMinor,
      withholdingMinor: Number(input.withholdingMinor || 0),
      currency: alloc.currency,
      bankAccountId: input.bankAccountId,
      paymentReference: input.paymentReference || null,
      status: 'POSTED',
      equityTransactionId: eqTx.id,
      journalEntryId: posted.transaction.journalEntryId,
      createdBy: context.userId || null,
    },
  });

  const newPaid = alloc.paidAmountMinor + payMinor;
  await db.eqV2DividendAllocation.update({
    where: { id: alloc.id },
    data: {
      paidAmountMinor: newPaid,
      paymentStatus: newPaid >= alloc.netAmountMinor ? 'PAID' : 'PARTIAL',
    },
  });

  return { payment, posting: posted };
}

export { minorToPercentString };
