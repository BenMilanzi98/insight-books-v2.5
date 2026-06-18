// app/api/tax/settle/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { getAccountForPaymentMethod } from '@/lib/paymentMethodAccountMapping';
import { postTaxPayment } from '@/lib/taxCalculationService';
import { applyPayeSettlementToExpenses, isPayeTaxType } from '@/lib/payeExpenseSettlement';

// POST - Settle tax liability by creating an expense record and journal entries
export async function POST(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.amount || !body.date || !body.paymentMethod) {
      return NextResponse.json(
        { error: 'Amount, date, and payment method are required' },
        { status: 400 }
      );
    }

    // Parse amount
    const amount = typeof body.amount === 'string' 
      ? parseFloat(body.amount.replace(/,/g, ''))
      : body.amount;

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than zero' },
        { status: 400 }
      );
    }

    // Use database transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Get payment account using payment method mapping
      const paymentAccount = await getAccountForPaymentMethod(
        user.tenantId,
        body.paymentMethod,
        tx
      );

      // Create the tax settlement expense
      const expense = await tx.expense.create({
        data: {
          description: body.description || `Tax Settlement - ${new Date(body.date).toLocaleDateString()}`,
          amount: amount,
          date: new Date(body.date),
          category: 'Tax Settlement',
          paymentMethod: body.paymentMethod,
          sourceAccountId: paymentAccount.id,
          merchant: body.merchant || 'Tax Authority',
          status: 'Approved', // Tax settlements are automatically approved
          notes: body.notes || 'Automated tax settlement',
          submittedById: user.id,
          tenantId: user.tenantId,
        }
      });

      // Create payment record
      const payment = await tx.payment.create({
        data: {
          amount,
          paymentDate: new Date(body.date),
          paymentMethod: body.paymentMethod,
          reference: `Tax Settlement - ${expense.id}`,
          status: 'Completed',
          tenantId: user.tenantId,
          type: 'tax_settlement',
          sourceAccount: body.paymentMethod || null
        }
      });

      let taxType = null;
      let payeExpenseSettlement = null;
      if (body.taxTypeId) {
        taxType = await tx.taxType.findFirst({
          where: { id: body.taxTypeId, tenantId: user.tenantId },
          select: { id: true, taxId: true, taxName: true, taxCode: true },
        });
        if (!taxType) {
          throw new Error('Tax type not found or access denied');
        }
      }

      // Create journal entries for tax payment if taxTypeId is provided
      let taxTransaction = null;
      if (body.taxTypeId) {
        try {
          console.log('Creating tax payment journal entry:', {
            taxTypeId: body.taxTypeId,
            paymentAmount: amount,
            paymentAccountId: paymentAccount.id,
            paymentDate: body.date
          });
          
          taxTransaction = await postTaxPayment({
            tenantId: user.tenantId,
            userId: user.id,
            taxTypeId: body.taxTypeId,
            paymentAmount: amount,
            paymentAccountId: paymentAccount.id,
            paymentDate: new Date(body.date),
            description: body.description || `Tax Settlement - ${expense.id}`,
            tx,
          });
          
          console.log('✅ Tax payment journal entry created:', {
            transactionId: taxTransaction.id,
            sourceType: taxTransaction.sourceType,
            lines: taxTransaction.lines?.length || 0
          });

          if (isPayeTaxType(taxType)) {
            payeExpenseSettlement = await applyPayeSettlementToExpenses(tx, {
              tenantId: user.tenantId,
              taxTypeId: body.taxTypeId,
              amount,
              settlementDate: new Date(body.date),
              paymentMethod: body.paymentMethod,
              reference: `Tax Settlement - ${expense.id}`,
              taxPeriod: body.taxPeriod || null,
            });
          }
        } catch (taxError) {
          console.error('❌ Error creating tax payment journal entry:', taxError);
          console.error('Tax payment error details:', {
            taxTypeId: body.taxTypeId,
            paymentAmount: amount,
            paymentAccountId: paymentAccount.id,
            error: taxError.message,
            stack: taxError.stack
          });
          // Re-throw the error so the transaction rolls back
          throw new Error(`Failed to create tax payment journal entry: ${taxError.message}`);
        }
      } else {
        console.warn('⚠️ No taxTypeId provided, skipping journal entry creation');
        // If no taxTypeId, we should still create a transaction for accounting purposes
        // But for now, we'll require taxTypeId
        throw new Error('taxTypeId is required to create tax payment journal entries');
      }

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          action: 'TAX_SETTLEMENT_CREATED',
          entityType: 'EXPENSE',
          entityId: expense.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            description: expense.description,
            amount: expense.amount,
            paymentMethod: body.paymentMethod,
            settlementDate: body.date,
            taxPeriod: body.taxPeriod || null,
            taxTypeId: body.taxTypeId || null,
            payeExpenseSettlement,
            automaticSettlement: true
          })
        }
      });

      return { expense, payment, taxTransaction, payeExpenseSettlement };
    });

    // Format response
    return NextResponse.json({
      message: 'Tax settlement recorded successfully',
      settlement: {
        id: result.expense.id,
        description: result.expense.description,
        amount: result.expense.amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        date: result.expense.date.toISOString().split('T')[0],
        paymentMethod: result.expense.paymentMethod,
        status: result.expense.status,
        paymentId: result.payment.id,
        payeExpenseSettlement: result.payeExpenseSettlement || null
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating tax settlement:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record tax settlement. Please try again.' },
      { status: 500 }
    );
  }
}
