/**
 * Phase 4: repoint FKs from source Account id → target Account id (same tenant).
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} tenantId
 * @param {string} sourceAccountId
 * @param {string} targetAccountId
 */
export async function remapAccountForeignKeys(tx, tenantId, sourceAccountId, targetAccountId) {
  if (!sourceAccountId || !targetAccountId || sourceAccountId === targetAccountId) return;

  await tx.journalEntry.updateMany({
    where: { tenantId, accountId: sourceAccountId },
    data: { accountId: targetAccountId },
  });

  await tx.journalEntryLine.updateMany({
    where: { accountId: sourceAccountId, journalEntry: { tenantId } },
    data: { accountId: targetAccountId },
  });

  await tx.transactionLine.updateMany({
    where: { accountId: sourceAccountId, transaction: { tenantId } },
    data: { accountId: targetAccountId },
  });

  await tx.expense.updateMany({
    where: { tenantId, expenseAccountId: sourceAccountId },
    data: { expenseAccountId: targetAccountId },
  });
  await tx.expense.updateMany({
    where: { tenantId, sourceAccountId: sourceAccountId },
    data: { sourceAccountId: targetAccountId },
  });

  await tx.recurringExpense.updateMany({
    where: { tenantId, expenseAccountId: sourceAccountId },
    data: { expenseAccountId: targetAccountId },
  });

  await tx.product.updateMany({
    where: { tenantId, incomeAccountId: sourceAccountId },
    data: { incomeAccountId: targetAccountId },
  });
  await tx.product.updateMany({
    where: { tenantId, cogsAccountId: sourceAccountId },
    data: { cogsAccountId: targetAccountId },
  });
  await tx.product.updateMany({
    where: { tenantId, inventoryAccountId: sourceAccountId },
    data: { inventoryAccountId: targetAccountId },
  });

  await tx.taxType.updateMany({
    where: { tenantId, accountId: sourceAccountId },
    data: { accountId: targetAccountId },
  });

  await tx.equityAccount.updateMany({
    where: { tenantId, coaAccountId: sourceAccountId },
    data: { coaAccountId: targetAccountId },
  });

  await tx.expenseCategory.updateMany({
    where: { tenantId, accountId: sourceAccountId },
    data: { accountId: targetAccountId },
  });

  await tx.paymentAccount.updateMany({
    where: { tenantId, coaAccountId: sourceAccountId },
    data: { coaAccountId: targetAccountId },
  });

  await tx.bankAccount.updateMany({
    where: { tenantId, coaAccountId: sourceAccountId },
    data: { coaAccountId: targetAccountId },
  });

  await tx.invoiceItem.updateMany({
    where: { accountId: sourceAccountId, invoice: { tenantId } },
    data: { accountId: targetAccountId },
  });

  await tx.saleItem.updateMany({
    where: { accountId: sourceAccountId, sale: { tenantId } },
    data: { accountId: targetAccountId },
  });

  await tx.budgetItem.updateMany({
    where: { budget: { tenantId }, accountId: sourceAccountId },
    data: { accountId: targetAccountId },
  });

  await tx.accountBalanceHistory.updateMany({
    where: { accountId: sourceAccountId },
    data: { accountId: targetAccountId },
  });

  await tx.bfExpenseBudgetLine.updateMany({
    where: { accountId: sourceAccountId, header: { tenantId } },
    data: { accountId: targetAccountId },
  });

  await tx.bfRevenueForecastLine.updateMany({
    where: { accountId: sourceAccountId, header: { tenantId } },
    data: { accountId: targetAccountId },
  });
}
