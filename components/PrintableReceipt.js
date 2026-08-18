// components/PrintableReceipt.js
"use client";
import { tt } from '@/lib/i18n/runtime';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { isMalawiStandardVatRate } from '@/lib/malawiTaxCatalog';
import { taxLineAmount } from '@/lib/documentTaxDisplay';

const QRCodeSVG = dynamic(
  () => import('qrcode.react').then((mod) => mod.QRCodeSVG),
  { ssr: false }
);

const PrintableReceipt = ({ receiptData }) => {
  const { type, payment, invoice, expense, client, payments, totalPaid, isFullyPaid, branding } = receiptData;
  
  // Determine if this is an invoice or expense receipt
  const isExpenseReceipt = !!expense;
  const document = isExpenseReceipt ? expense : invoice;
  const documentNumber = isExpenseReceipt
    ? expense?.reference ||
      expense?.originalReference ||
      (expense?.description ? String(expense.description).slice(0, 48) : 'Expense')
    : invoice?.invoiceNumber || 'N/A';
  const documentType = isExpenseReceipt ? 'Expense' : 'Invoice';
  const documentTotal = isExpenseReceipt ? (expense?.amount || 0) : (invoice?.total || 0);
  
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'MWK'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentMethodName = (paymentOrMethod) => {
    if (paymentOrMethod?.paymentMethodName) return paymentOrMethod.paymentMethodName;
    const method = paymentOrMethod?.paymentMethod || paymentOrMethod;
    if (!method) return 'N/A';
    if (typeof method !== 'string') return 'N/A';
    switch (method.toLowerCase()) {
      case 'cash': return 'Cash';
      case 'bank_transfer': return 'Bank Transfer';
      case 'mobile_money': return 'Mobile Money';
      case 'check': return 'Check';
      case 'credit_card': return 'Credit Card';
      default: return method.length > 20 ? 'Unknown method' : method;
    }
  };

  return (
    <div className="bg-white p-8 max-w-4xl mx-auto" style={{ fontFamily: 'Arial, sans-serif', color: '#000' }}>
      {/* Header with Logo */}
      <div className="flex items-center justify-between border-b-2 border-blue-600 pb-5 mb-8">
        <div className="flex items-center space-x-4">
          {branding?.logoUrl && (
            <img 
              src={branding.logoUrl.startsWith('http') ? branding.logoUrl : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${branding.logoUrl}`}
              alt={branding.name || 'Logo'} 
              className="h-16 w-auto object-contain"
              style={{ maxHeight: '64px' }}
            />
          )}
          <div>
            <div className="text-2xl font-bold text-blue-600">{tt('Payment Receipt')}</div>
            <div className="text-xl text-gray-700">{documentType} #{documentNumber}</div>
          </div>
        </div>
      </div>

      {/* Client Information and Receipt Details - Side by Side */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Client Information */}
        <div>
          <h3 className="text-lg font-semibold text-blue-600 mb-3">{tt('Client Information')}</h3>
          <p><strong>{tt('Name:')}</strong> {client?.name || 'N/A'}</p>
          <p><strong>{tt('Email:')}</strong> {client?.email || 'N/A'}</p>
          <p><strong>{tt('Phone:')}</strong> {client?.phone || 'N/A'}</p>
        </div>

        {type === 'individual' ? (
          /* Receipt Details */
          <div>
            <h3 className="text-lg font-semibold text-blue-600 mb-3">{tt('Receipt Details')}</h3>
            <p><strong>{tt('Receipt Date:')}</strong> {formatDate(payment?.paymentDate)}</p>
            <p><strong>{tt('Payment reference:')}</strong> {payment?.reference || payment?.receiptReference || 'N/A'}</p>
            <p><strong>{documentType} Total:</strong> {formatCurrency(documentTotal)}</p>
          </div>
        ) : (
          /* Receipt Summary */
          <div>
            <h3 className="text-lg font-semibold text-blue-600 mb-3">{tt('Receipt Summary')}</h3>
            <p><strong>{tt('Total Payments:')}</strong> {payments?.length || 0}</p>
            <p><strong>{documentType} Total:</strong> {formatCurrency(documentTotal)}</p>
            <p><strong>{tt('Total Paid:')}</strong> {formatCurrency(totalPaid || 0)}</p>
          </div>
        )}
      </div>

      {type === 'individual' ? (
        <>

          {/* Payment Details */}
          <div className="bg-gray-50 border border-gray-200 p-5 rounded-lg mb-6">
            <div className="bg-blue-600 text-white p-4 rounded-lg mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm opacity-90">{tt('Payment Amount')}</div>
                  <div className="text-2xl font-bold">{formatCurrency(payment?.amount || 0)}</div>
                </div>
                <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                  {payment?.amount >= documentTotal ? tt('Full Payment') : tt('Partial Payment')}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="font-semibold mb-2">
                Payment Method:{' '}
                {getPaymentMethodName(payment) !== 'N/A'
                  ? getPaymentMethodName(payment)
                  : payment?.allocations?.[0]?.paymentAccount?.name || 'N/A'}
              </h4>
              <p>Payment Date: {formatDateTime(payment?.paymentDate)}</p>
              {payment?.reference && <p>Reference: {payment.reference}</p>}
              {payment?.notes && <p>Notes: {payment.notes}</p>}
            </div>

            {payment?.amount < documentTotal ? (
              <div className="bg-yellow-50 border border-yellow-300 p-3 rounded mt-4">
                <p className="text-yellow-800 text-sm m-0">
                  <strong>{tt('Note:')}</strong> This is a partial payment of {formatCurrency(payment?.amount || 0)} 
                  from {documentType.toLowerCase()} total of {formatCurrency(documentTotal)}. 
                  Outstanding balance: {formatCurrency(documentTotal - (payment?.amount || 0))}
                </p>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-300 p-3 rounded mt-4">
                <p className="text-green-800 text-sm m-0">
                  <strong>{tt('Payment Complete:')}</strong> This payment of {formatCurrency(payment?.amount || 0)} 
                  fully settles {documentType.toLowerCase()} #{documentNumber} for {formatCurrency(documentTotal)}.
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Payment Details */}
          <div className="bg-gray-50 border border-gray-200 p-5 rounded-lg mb-6">
            <div className="bg-blue-600 text-white p-4 rounded-lg mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm opacity-90">{tt('Total Amount Paid')}</div>
                  <div className="text-2xl font-bold">{formatCurrency(totalPaid || 0)}</div>
                </div>
                <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                  {isFullyPaid ? tt('Fully Paid') : tt('Partially Paid')}
                </div>
              </div>
            </div>

            <h3 className="text-blue-600 font-semibold mb-4">{tt('Payment History')}</h3>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-100 p-3 font-semibold text-gray-700 border-b border-gray-200">
                <div className="grid grid-cols-4 gap-4">
                  <div>{tt('Date')}</div>
                  <div>{tt('Method')}</div>
                  <div>{tt('Amount')}</div>
                  <div>{tt('Reference')}</div>
                </div>
              </div>
              {(payments || []).map((p, index) => (
                <div key={index} className="p-3 border-b border-gray-200 grid grid-cols-4 gap-4">
                  <div>{formatDateTime(p.paymentDate)}</div>
                  <div>{getPaymentMethodName(p)}</div>
                  <div>{formatCurrency(p.amount)}</div>
                  <div>{p.reference || 'N/A'}</div>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 border border-gray-200 p-5 rounded-lg mt-6">
              <div className="flex justify-between mb-3">
                <span>{documentType} Total:</span>
                <span>{formatCurrency(documentTotal)}</span>
              </div>
              <div className="flex justify-between mb-3">
                <span>{tt('Total Paid:')}</span>
                <span>{formatCurrency(totalPaid || 0)}</span>
              </div>
              <div className="flex justify-between mb-3">
                <span>{tt('Outstanding Balance:')}</span>
                <span>{formatCurrency(documentTotal - (totalPaid || 0))}</span>
              </div>
              <div className="flex justify-between font-bold text-lg text-blue-600 border-t-2 border-blue-600 pt-3 mt-3">
                <span>{tt('Status:')}</span>
                <span>{isFullyPaid ? tt('FULLY PAID') : tt('PARTIALLY PAID')}</span>
              </div>
            </div>

            {!isFullyPaid ? (
              <div className="bg-yellow-50 border border-yellow-300 p-3 rounded mt-4">
                <p className="text-yellow-800 text-sm m-0">
                  <strong>{tt('Outstanding Balance:')}</strong> {formatCurrency(documentTotal - (totalPaid || 0))} 
                  remaining to be paid on this {documentType.toLowerCase()}.
                </p>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-300 p-3 rounded mt-4">
                <p className="text-green-800 text-sm m-0">
                  <strong>{tt('Payment Complete:')}</strong> All payments totaling {formatCurrency(totalPaid || 0)} 
                  fully settle {documentType.toLowerCase()} #{documentNumber}.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* MRA Tax Breakdown by Group (A/B/E) - TC-INV-003, TC-TAX-005/006 */}
      {(() => {
        const positiveTaxBreakdown = (receiptData.taxBreakdown || []).filter(
          (tax) => taxLineAmount(tax) > 0 || Number(tax.totalVAT || 0) > 0,
        );
        if (!positiveTaxBreakdown.length) return null;
        return (
        <div className="mt-6 bg-gray-50 border border-gray-200 p-4 rounded-lg">
          <h4 className="font-semibold text-sm text-gray-700 mb-2">{tt('Tax Summary')}</h4>
          <div className="space-y-1">
            {positiveTaxBreakdown.map((tax, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-gray-600">
                  <span className="inline-block w-6 text-center font-bold text-xs rounded bg-blue-100 text-blue-700 mr-2">
                    {tax.taxRateId || (isMalawiStandardVatRate(tax.taxRate) ? 'A' : tax.taxRate === 0 ? 'B' : 'E')}
                  </span>
                  {tax.taxName || `Tax Group ${tax.taxRateId}`} ({tax.taxRate || 0}%)
                </span>
                <span className="font-medium">{formatCurrency(tax.taxAmount || tax.totalVAT || 0)}</span>
              </div>
            ))}
          </div>
        </div>
        );
      })()}

      {/* Tourism Levy - TC-TAX-006 */}
      {receiptData.levyBreakdown && receiptData.levyBreakdown.length > 0 && (
        <div className="mt-3 bg-amber-50 border border-amber-200 p-4 rounded-lg">
          <h4 className="font-semibold text-sm text-amber-700 mb-2">{tt('Levies')}</h4>
          <div className="space-y-1">
            {receiptData.levyBreakdown.map((levy, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-amber-700">{levy.levyName || 'Tourism Levy'}</span>
                <span className="font-medium text-amber-800">{formatCurrency(levy.totalLevy || levy.amount || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MRA Invoice Number */}
      {receiptData.eisInvoiceNumber && (
        <div className="mt-3 text-center">
          <p className="text-xs text-gray-500">{tt('MRA Invoice:')} <span className="font-mono font-medium text-gray-700">{receiptData.eisInvoiceNumber}</span></p>
        </div>
      )}

      {/* QR Code for EIS verification */}
      {(receiptData.payment?.id || receiptData.invoice?.id || receiptData.expense?.id) && (
        <div className="mt-6 flex flex-col items-center">
          <QRCodeSVG
            value={`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify/${receiptData.invoice?.id || receiptData.payment?.id || receiptData.expense?.id}`}
            size={96}
          />
          <p className="text-xs text-gray-500 mt-1">{tt('Scan to verify')}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-10 text-center text-gray-600 text-sm border-t border-gray-200 pt-5">
        <p>Thank you for your {type === 'individual' ? tt('payment') : tt('payments')}!</p>
        <p>Generated on {new Date().toLocaleString()}</p>
        <p className="mt-4 text-xs text-gray-500">
          {tt('Powered by')} <a href="https://insightbooksafrica.com/" className="text-blue-600 no-underline">{tt('InsightBooks')}</a>
        </p>
      </div>
    </div>
  );
};

export default PrintableReceipt;

