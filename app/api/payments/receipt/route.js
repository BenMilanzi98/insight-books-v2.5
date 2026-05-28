import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { generatePaymentReceiptPdfBuffer } from '@/lib/server-pdf-jspdf';
import { textToMinimalPdf } from '@/lib/fallback-text-pdf';
import { enrichPaymentsWithMethodNames } from '@/lib/userFacingLabels';
import { addMoney, moneyGreaterOrEqual } from '@/lib/money';

async function enrichReceiptData(prisma, tenantId, receiptData) {
  if (!receiptData) return receiptData;
  if (receiptData.payment) {
    const [payment] = await enrichPaymentsWithMethodNames(prisma, tenantId, [receiptData.payment]);
    receiptData.payment = payment;
  }
  if (Array.isArray(receiptData.payments) && receiptData.payments.length) {
    receiptData.payments = await enrichPaymentsWithMethodNames(
      prisma,
      tenantId,
      receiptData.payments
    );
  }
  if (receiptData.expense) {
    receiptData.expense = {
      ...receiptData.expense,
      reference:
        receiptData.expense.reference ||
        receiptData.expense.originalReference ||
        (receiptData.expense.description
          ? String(receiptData.expense.description).slice(0, 80)
          : null),
    };
  }
  return receiptData;
}

// GET - Download receipt data (for client-side PDF generation)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    const expenseId = searchParams.get('expenseId');
    const type = searchParams.get('type') || 'individual';

    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (type === 'individual' && !paymentId && !expenseId) {
      return NextResponse.json(
        { error: 'Payment ID or Expense ID is required for individual receipt' },
        { status: 400 }
      );
    }

    if (type === 'combined' && !expenseId) {
      return NextResponse.json(
        { error: 'Expense ID is required for combined receipt' },
        { status: 400 }
      );
    }

    let receiptData;

    if (type === 'individual') {
      if (expenseId) {
        // Get individual payment with expense details
        const payment = await prisma.payment.findFirst({
          where: {
            id: paymentId,
            tenantId: user.tenantId
          },
          include: {
            expense: {
              include: {
                submittedBy: {
                  select: {
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        });

        if (!payment) {
          return NextResponse.json(
            { error: 'Payment not found' },
            { status: 404 }
          );
        }

        // Get tenant branding information
        const tenant = await prisma.tenant.findUnique({
          where: { id: user.tenantId },
          select: {
            name: true,
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true
          }
        });

        receiptData = {
          type: 'individual',
          payment: {
            id: payment.id,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
            paymentDate: payment.paymentDate.toISOString(),
            reference: payment.reference,
            notes: payment.notes,
            status: payment.status
          },
          expense: payment.expense
            ? {
                id: payment.expense.id,
                amount: payment.expense.amount,
                description: payment.expense.description,
                originalReference: payment.expense.originalReference,
              }
            : null,
          client: {
            name: payment.expense?.submittedBy?.name || 'N/A',
            email: payment.expense?.submittedBy?.email || 'N/A',
            phone: 'N/A'
          },
          branding: tenant ? {
            name: tenant.name,
            logoUrl: tenant.logoUrl,
            primaryColor: tenant.primaryColor,
            secondaryColor: tenant.secondaryColor
          } : null
        };
      } else {
        // Get individual payment with invoice details
        const payment = await prisma.payment.findFirst({
          where: {
            id: paymentId,
            tenantId: user.tenantId
          },
          include: {
            invoice: {
              include: {
                client: true,
                createdBy: {
                  select: {
                    name: true,
                    email: true
                  }
                }
              }
            }
          }
        });

        if (!payment) {
          return NextResponse.json(
            { error: 'Payment not found' },
            { status: 404 }
          );
        }

        // Get tenant branding information
        const tenant = await prisma.tenant.findUnique({
          where: { id: user.tenantId },
          select: {
            name: true,
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true
          }
        });

        receiptData = {
          type: 'individual',
          payment: {
            id: payment.id,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
            paymentDate: payment.paymentDate.toISOString(),
            reference: payment.reference,
            notes: payment.notes,
            status: payment.status
          },
          invoice: payment.invoice ? {
            id: payment.invoice.id,
            invoiceNumber: payment.invoice.invoiceNumber,
            total: payment.invoice.total
          } : null,
          client: payment.invoice?.client || {
            name: 'N/A',
            email: 'N/A',
            phone: 'N/A'
          },
          branding: tenant ? {
            name: tenant.name,
            logoUrl: tenant.logoUrl,
            primaryColor: tenant.primaryColor,
            secondaryColor: tenant.secondaryColor
          } : null
        };
      }
    } else {
      // Get combined payments for expense
      const expense = await prisma.expense.findFirst({
        where: {
          id: expenseId,
          tenantId: user.tenantId
        },
        include: {
          submittedBy: {
            select: {
              name: true,
              email: true
            }
          },
          payments: {
            where: { status: 'Completed' },
            orderBy: { paymentDate: 'desc' }
          }
        }
      });

      if (!expense) {
        return NextResponse.json(
          { error: 'Expense not found' },
          { status: 404 }
        );
      }

      // Get tenant branding information
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: {
          name: true,
          logoUrl: true,
          primaryColor: true,
          secondaryColor: true
        }
      });

      const totalPaid = expense.payments.reduce((sum, payment) => addMoney(sum, payment.amount), 0);
      const isFullyPaid = moneyGreaterOrEqual(totalPaid, expense.amount);

      receiptData = {
        type: 'combined',
        expense: {
          id: expense.id,
          amount: expense.amount
        },
        client: {
          name: expense.submittedBy?.name || 'N/A',
          email: expense.submittedBy?.email || 'N/A',
          phone: 'N/A'
        },
        payments: expense.payments.map(p => ({
          id: p.id,
          amount: p.amount,
          paymentMethod: p.paymentMethod,
          paymentDate: p.paymentDate.toISOString(),
          reference: p.reference,
          notes: p.notes,
          status: p.status
        })),
        totalPaid: totalPaid,
        isFullyPaid: isFullyPaid,
        branding: tenant ? {
          name: tenant.name,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor
        } : null
      };
    }

    receiptData = await enrichReceiptData(prisma, user.tenantId, receiptData);

    // If format=pdf requested, generate server-side PDF
    const format = searchParams.get('format');
    if (format === 'pdf') {
      let buffer;
      try {
        buffer = generatePaymentReceiptPdfBuffer(receiptData);
      } catch (pdfErr) {
        console.error('Payment receipt PDF (jsPDF) failed, falling back to text PDF:', pdfErr?.message || pdfErr);
        const lines = [];
        lines.push('PAYMENT RECEIPT');
        lines.push(
          `${receiptData.type === 'individual' ? 'Payment' : 'Summary'} - ${receiptData.expense ? 'Expense' : 'Invoice'} #${receiptData.invoice?.invoiceNumber || receiptData.expense?.reference || receiptData.expense?.description || ''}`
        );
        lines.push(`Client: ${receiptData.client?.name || 'N/A'}`);
        if (receiptData.type === 'individual' && receiptData.payment) {
          lines.push(`Amount: ${receiptData.payment.amount}`);
          lines.push(`Method: ${receiptData.payment.paymentMethodName || receiptData.payment.paymentMethod}`);
          lines.push(`Date: ${receiptData.payment.paymentDate}`);
        }
        lines.push('');
        lines.push('This PDF is a fallback (reduced formatting).');
        buffer = textToMinimalPdf(lines.join('\n'));
      }
      const safeName = (receiptData.invoice?.invoiceNumber || receiptData.expense?.id || 'receipt')
        .toString().replace(/[^\w.-]+/g, '_');
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="payment-receipt-${safeName}.pdf"`,
        },
      });
    }

    return NextResponse.json({
      receipt: receiptData
    });

  } catch (error) {
    console.error('Error generating receipt:', error);
    return NextResponse.json(
      { error: 'Failed to generate receipt. Please try again.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { paymentId, invoiceId, type } = body;

    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (type === 'individual' && !paymentId) {
      return NextResponse.json(
        { error: 'Payment ID is required for individual receipt' },
        { status: 400 }
      );
    }

    if (type === 'combined' && !invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required for combined receipt' },
        { status: 400 }
      );
    }

    let receiptData;

    if (type === 'individual') {
      // Get individual payment with invoice details
      const payment = await prisma.payment.findFirst({
        where: {
          id: paymentId,
          tenantId: user.tenantId
        },
        include: {
          invoice: {
            include: {
              client: true,
              createdBy: {
                select: {
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      });

      if (!payment) {
        return NextResponse.json(
          { error: 'Payment not found' },
          { status: 404 }
        );
      }

      // Get tenant branding information
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: {
          name: true,
          logoUrl: true,
          primaryColor: true,
          secondaryColor: true
        }
      });

      receiptData = {
        type: 'individual',
        payment: {
          id: payment.id,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          paymentDate: payment.paymentDate.toISOString(),
          reference: payment.reference,
          notes: payment.notes,
          status: payment.status
        },
        invoice: payment.invoice ? {
          id: payment.invoice.id,
          invoiceNumber: payment.invoice.invoiceNumber,
          total: payment.invoice.total
        } : null,
        client: payment.invoice?.client || {
          name: 'N/A',
          email: 'N/A',
          phone: 'N/A'
        },
        isFullPayment: payment.amount >= (payment.invoice?.total || 0),
        isPartialPayment: payment.amount < (payment.invoice?.total || 0),
        branding: tenant ? {
          name: tenant.name,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor
        } : null
      };
    } else {
      // Get all payments for the invoice
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          tenantId: user.tenantId
        },
        include: {
          client: true,
          createdBy: {
            select: {
              name: true,
              email: true
            }
          },
          payments: {
            where: { status: 'Completed' },
            orderBy: { paymentDate: 'asc' }
          }
        }
      });

      if (!invoice) {
        return NextResponse.json(
          { error: 'Invoice not found' },
          { status: 404 }
        );
      }

      // Get tenant branding information
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: {
          name: true,
          logoUrl: true,
          primaryColor: true,
          secondaryColor: true
        }
      });

      const totalPaid = invoice.payments.reduce((sum, p) => addMoney(sum, p.amount), 0);
      const isFullyPaid = moneyGreaterOrEqual(totalPaid, invoice.total);

      receiptData = {
        type: 'combined',
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          total: invoice.total
        },
        client: invoice.client || {
          name: 'N/A',
          email: 'N/A',
          phone: 'N/A'
        },
        payments: invoice.payments.map(p => ({
          id: p.id,
          amount: p.amount,
          paymentMethod: p.paymentMethod,
          paymentDate: p.paymentDate.toISOString(),
          reference: p.reference,
          notes: p.notes,
          status: p.status
        })),
        totalPaid,
        isFullyPaid,
        isPartialPayment: totalPaid > 0 && totalPaid < invoice.total,
        branding: tenant ? {
          name: tenant.name,
          logoUrl: tenant.logoUrl,
          primaryColor: tenant.primaryColor,
          secondaryColor: tenant.secondaryColor
        } : null
      };
    }

    receiptData = await enrichReceiptData(prisma, user.tenantId, receiptData);

    // If format=pdf requested, generate server-side PDF
    if (body.format === 'pdf') {
      let buffer;
      try {
        buffer = generatePaymentReceiptPdfBuffer(receiptData);
      } catch (pdfErr) {
        console.error('Payment receipt PDF (jsPDF) failed, falling back to text PDF:', pdfErr?.message || pdfErr);
        const lines = [];
        lines.push('PAYMENT RECEIPT');
        lines.push(`${receiptData.invoice?.invoiceNumber || ''}`);
        lines.push(`Client: ${receiptData.client?.name || 'N/A'}`);
        lines.push('');
        lines.push('This PDF is a fallback (reduced formatting).');
        buffer = textToMinimalPdf(lines.join('\n'));
      }
      const safeName = (receiptData.invoice?.invoiceNumber || 'receipt')
        .toString().replace(/[^\w.-]+/g, '_');
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="payment-receipt-${safeName}.pdf"`,
        },
      });
    }

    return NextResponse.json({
      receipt: receiptData
    });

  } catch (error) {
    console.error('Error generating payment receipt:', error);
    return NextResponse.json(
      { error: 'Failed to generate receipt' },
      { status: 500 }
    );
  }
}
