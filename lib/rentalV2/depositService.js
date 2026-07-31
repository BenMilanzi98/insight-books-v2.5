import prisma from '@/lib/prisma';
import { addMoney, parseMoney } from '@/lib/money';
import { postRentalCustomerDepositAccounting } from '@/lib/accountingV2/adapters';
import {
  assertDepositNotOverApplied,
  buildDepositApplyLines,
  buildDepositReceiptLines,
  buildDepositRefundLines,
  remainingDeposit,
} from './depositAccounting.js';
import { CONTRACT_STATUS } from './contractState.js';
import { makeDocNumber } from './numbering.js';

export async function createDepositRecord({
  tenantId,
  contractId,
  amount,
  depositType = 'REFUNDABLE_SECURITY',
  idempotencyKey,
}) {
  const contract = await prisma.rentalContract.findFirst({
    where: { id: contractId, tenantId },
  });
  if (!contract) throw new Error('Contract not found');

  if (idempotencyKey) {
    const existing = await prisma.rentalDeposit.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
    });
    if (existing) return existing;
  }

  return prisma.rentalDeposit.create({
    data: {
      tenantId,
      contractId,
      clientId: contract.clientId,
      depositType,
      amount: parseMoney(amount),
      currency: contract.currency || 'MWK',
      status: 'PENDING',
      idempotencyKey: idempotencyKey || `dep-${makeDocNumber('D')}`,
    },
  });
}

async function loadDeposit(tenantId, depositId) {
  const deposit = await prisma.rentalDeposit.findFirst({
    where: { id: depositId, tenantId },
    include: { contract: true },
  });
  if (!deposit) throw new Error('Deposit not found');
  return deposit;
}

function journalIdFrom(posting) {
  return posting?.journalId || posting?.journal?.id || posting?.result?.journalId || null;
}

/**
 * Receive deposit cash → liability (never revenue).
 */
export async function receiveDeposit({
  tenantId,
  userId,
  depositId,
  amount,
  cashAccountId,
  depositLiabilityAccountId,
  date,
  hasPermission,
}) {
  const deposit = await loadDeposit(tenantId, depositId);
  const receiveAmt = parseMoney(amount ?? deposit.amount);
  if (receiveAmt <= 0) throw new Error('Receive amount must be positive');

  const lines = buildDepositReceiptLines({
    cashAccountId,
    depositLiabilityAccountId,
    amount: receiveAmt,
  });

  const posting = await postRentalCustomerDepositAccounting({
    db: prisma,
    tenantId,
    userId,
    depositId: deposit.id,
    amount: receiveAmt,
    date: date || new Date().toISOString().slice(0, 10),
    description: `Rental deposit ${deposit.id}`,
    lines,
    currency: deposit.currency || 'MWK',
    hasPermission: hasPermission || (() => true),
  });

  const updated = await prisma.$transaction(async (tx) => {
    const nextReceived = addMoney(deposit.receivedAmount, receiveAmt);
    const dep = await tx.rentalDeposit.update({
      where: { id: deposit.id },
      data: {
        receivedAmount: nextReceived,
        status: 'HELD',
        journalId: journalIdFrom(posting),
        version: { increment: 1 },
      },
    });
    const contract = await tx.rentalContract.update({
      where: { id: deposit.contractId },
      data: {
        depositReceived: addMoney(deposit.contract.depositReceived, receiveAmt),
        status:
          deposit.contract.status === CONTRACT_STATUS.DEPOSIT_PENDING
            ? CONTRACT_STATUS.READY_FOR_DISPATCH
            : deposit.contract.status,
        version: { increment: 1 },
      },
    });
    return { deposit: dep, contract };
  });

  return { ...updated, posting };
}

/** Refund remaining deposit: Dr Liability / Cr Cash */
export async function refundDeposit({
  tenantId,
  userId,
  depositId,
  amount,
  cashAccountId,
  depositLiabilityAccountId,
  date,
  hasPermission,
}) {
  const deposit = await loadDeposit(tenantId, depositId);
  const rem = remainingDeposit(deposit);
  const amt = parseMoney(amount ?? rem);
  if (amt <= 0) throw new Error('Refund amount must be positive');
  assertDepositNotOverApplied(deposit, amt);

  const lines = buildDepositRefundLines({
    cashAccountId,
    depositLiabilityAccountId,
    amount: amt,
  });

  const posting = await postRentalCustomerDepositAccounting({
    db: prisma,
    tenantId,
    userId,
    depositId: deposit.id,
    amount: amt,
    date: date || new Date().toISOString().slice(0, 10),
    description: `Rental deposit refund ${deposit.id}`,
    lines,
    currency: deposit.currency || 'MWK',
    hasPermission: hasPermission || (() => true),
  });

  const dep = await prisma.rentalDeposit.update({
    where: { id: deposit.id },
    data: {
      refundedAmount: addMoney(deposit.refundedAmount, amt),
      status: remainingDeposit({
        ...deposit,
        refundedAmount: addMoney(deposit.refundedAmount, amt),
      }) <= 0.001
        ? 'REFUNDED'
        : 'HELD',
      version: { increment: 1 },
    },
  });

  return { deposit: dep, posting };
}

/** Apply deposit to AR: Dr Liability / Cr AR */
export async function applyDepositToReceivable({
  tenantId,
  userId,
  depositId,
  amount,
  depositLiabilityAccountId,
  arAccountId,
  date,
  hasPermission,
}) {
  const deposit = await loadDeposit(tenantId, depositId);
  const rem = remainingDeposit(deposit);
  const amt = parseMoney(amount ?? rem);
  if (amt <= 0) throw new Error('Apply amount must be positive');
  assertDepositNotOverApplied(deposit, amt);

  const lines = buildDepositApplyLines({
    depositLiabilityAccountId,
    arAccountId,
    amount: amt,
  });

  const posting = await postRentalCustomerDepositAccounting({
    db: prisma,
    tenantId,
    userId,
    depositId: deposit.id,
    amount: amt,
    date: date || new Date().toISOString().slice(0, 10),
    description: `Apply rental deposit ${deposit.id}`,
    lines,
    currency: deposit.currency || 'MWK',
    hasPermission: hasPermission || (() => true),
  });

  const dep = await prisma.rentalDeposit.update({
    where: { id: deposit.id },
    data: {
      appliedAmount: addMoney(deposit.appliedAmount, amt),
      status: remainingDeposit({
        ...deposit,
        appliedAmount: addMoney(deposit.appliedAmount, amt),
      }) <= 0.001
        ? 'APPLIED'
        : 'HELD',
      version: { increment: 1 },
    },
  });

  return { deposit: dep, posting };
}

/** Forfeit deposit to income: Dr Liability / Cr Forfeit/Other income */
export async function forfeitDeposit({
  tenantId,
  userId,
  depositId,
  amount,
  depositLiabilityAccountId,
  forfeitIncomeAccountId,
  date,
  hasPermission,
}) {
  const deposit = await loadDeposit(tenantId, depositId);
  const rem = remainingDeposit(deposit);
  const amt = parseMoney(amount ?? rem);
  if (amt <= 0) throw new Error('Forfeit amount must be positive');
  assertDepositNotOverApplied(deposit, amt);
  if (!depositLiabilityAccountId || !forfeitIncomeAccountId) {
    throw new Error('depositLiabilityAccountId and forfeitIncomeAccountId required');
  }

  const lines = [
    {
      accountId: depositLiabilityAccountId,
      debit: amt,
      credit: 0,
      description: 'Forfeit customer rental deposit',
    },
    {
      accountId: forfeitIncomeAccountId,
      debit: 0,
      credit: amt,
      description: 'Deposit forfeiture income',
    },
  ];

  const posting = await postRentalCustomerDepositAccounting({
    db: prisma,
    tenantId,
    userId,
    depositId: deposit.id,
    amount: amt,
    date: date || new Date().toISOString().slice(0, 10),
    description: `Forfeit rental deposit ${deposit.id}`,
    lines,
    currency: deposit.currency || 'MWK',
    hasPermission: hasPermission || (() => true),
  });

  const dep = await prisma.rentalDeposit.update({
    where: { id: deposit.id },
    data: {
      forfeitedAmount: addMoney(deposit.forfeitedAmount, amt),
      status: 'FORFEITED',
      version: { increment: 1 },
    },
  });

  return { deposit: dep, posting };
}

export { remainingDeposit, assertDepositNotOverApplied };
