import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { generateSimplePaymentReceiptPDF } from '@/lib/simple-pdf-generator';

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
          expense: payment.expense ? {
            id: payment.expense.id,
            amount: payment.expense.amount
          } : null,
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

      const totalPaid = expense.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const isFullyPaid = totalPaid >= expense.amount;

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

    // Return receipt data for client-side PDF generation (like quotations)
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

      const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
      const isFullyPaid = totalPaid >= invoice.total;

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

    // Return receipt data for client-side PDF generation (like quotations)
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
